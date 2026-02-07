import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Card, PokerPlayer, PokerRoom } from './types';
import * as PokerSolver from 'pokersolver';

const Hand = (PokerSolver as any).Hand;
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json() as any);
app.use(cors() as any);

const MONGO_URI = process.env.MONGO_URI || '';
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('GUMBLEVIP: MongoDB Connected'))
    .catch((err) => console.error('GUMBLEVIP: MongoDB Error', err));
}

const rooms = new Map<string, PokerRoomInternal>();

interface PokerRoomInternal extends PokerRoom {
  deck: Card[];
  dealerIndex: number;
  lastRaiserIndex: number;
  minRaise: number;
  timerHandle?: any;
  playersActedThisRound: Set<string>;
}

const createDeck = (): Card[] => {
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
  const deck: Card[] = [];
  suits.forEach(suit => {
    values.forEach(value => {
      deck.push({
        code: `${value === '10' ? '10' : value[0]}${suit[0]}`,
        image: `https://deckofcardsapi.com/static/img/${value === '10' ? '0' : value[0]}${suit[0]}.png`,
        value,
        suit
      });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

const broadcastRoom = (roomId: string) => {
  const room = rooms.get(roomId);
  if (room) {
    const { deck, timerHandle, ...publicRoom } = room;
    io.to(roomId).emit('room_state', publicRoom);
  }
};

const startTimer = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.timerHandle) clearTimeout(room.timerHandle);

  room.timerHandle = setTimeout(() => {
    const activePlayer = room.players[room.activeSeat];
    if (activePlayer) {
      processAction(roomId, activePlayer.id, { type: 'FOLD' });
    }
  }, 30000);
};

const advancePhase = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  room.playersActedThisRound.clear();
  room.players.forEach(p => p.bet = 0);
  room.currentBet = 0;
  room.minRaise = 100;

  if (room.phase === 'PRE_FLOP') {
    room.phase = 'FLOP';
    room.communityCards = [room.deck.pop()!, room.deck.pop()!, room.deck.pop()!];
  } else if (room.phase === 'FLOP') {
    room.phase = 'TURN';
    room.communityCards.push(room.deck.pop()!);
  } else if (room.phase === 'TURN') {
    room.phase = 'RIVER';
    room.communityCards.push(room.deck.pop()!);
  } else {
    room.phase = 'SHOWDOWN';
    evaluateWinners(roomId);
    return;
  }

  let nextSeat = (room.dealerIndex + 1) % room.players.length;
  while (room.players[nextSeat].isFolded || room.players[nextSeat].balance === 0) {
    nextSeat = (nextSeat + 1) % room.players.length;
  }
  room.activeSeat = nextSeat;
  room.lastRaiserIndex = -1; 
  startTimer(roomId);
  broadcastRoom(roomId);
};

const evaluateWinners = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.timerHandle) clearTimeout(room.timerHandle);

  const activePlayers = room.players.filter(p => !p.isFolded);
  
  if (activePlayers.length === 1) {
    // Fold Win
    const winner = activePlayers[0];
    winner.balance += room.pot;
    // IMPORTANT: Send specific text format so frontend detects win
    const winMsg = { user: 'SYSTEM', text: `${winner.name} wins $${room.pot.toLocaleString()} (Others Folded)`, timestamp: Date.now() };
    room.messages.push(winMsg);
    io.to(roomId).emit('new_message', winMsg);
  } else {
    // Showdown
    const format = (c: Card) => (c.value === '10' ? 'T' : c.value[0]) + c.suit[0].toLowerCase();
    const community = room.communityCards.map(format);
    const hands = activePlayers.map(p => Hand.solve([...p.hand.map(format), ...community], p.id));
    const winners = Hand.winners(hands);
    const share = Math.floor(room.pot / winners.length);

    winners.forEach((w: any) => {
      const p = room.players.find(pl => pl.id === w.name);
      if (p) {
        p.balance += share;
        const winMsg = { user: 'SYSTEM', text: `${p.name} wins $${share.toLocaleString()} with ${w.descr}`, timestamp: Date.now() };
        room.messages.push(winMsg);
        io.to(roomId).emit('new_message', winMsg);
      }
    });
  }

  room.pot = 0;
  broadcastRoom(roomId);
  setTimeout(() => resetRoom(roomId), 5000);
};

const resetRoom = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;
  room.phase = 'IDLE';
  room.communityCards = [];
  room.players.forEach(p => { p.hand = []; p.bet = 0; p.isFolded = false; });
  broadcastRoom(roomId);
};

const processAction = (roomId: string, playerId: string, action: { type: string, amount?: number }) => {
  const room = rooms.get(roomId);
  if (!room || room.phase === 'IDLE' || room.phase === 'SHOWDOWN') return;

  const player = room.players[room.activeSeat];
  if (player.id !== playerId) return;

  if (action.type === 'FOLD') {
    player.isFolded = true;
  } else if (action.type === 'CHECK') {
    if (player.bet < room.currentBet) return;
  } else if (action.type === 'CALL') {
    const diff = room.currentBet - player.bet;
    const actual = Math.min(diff, player.balance);
    player.balance -= actual;
    player.bet += actual;
    room.pot += actual;
  } else if (action.type === 'RAISE') {
    const raiseTo = action.amount || (room.currentBet + room.minRaise);
    const toPay = raiseTo - player.bet;
    if (player.balance < toPay || raiseTo < room.currentBet + room.minRaise) return;
    
    room.minRaise = raiseTo - room.currentBet;
    room.currentBet = raiseTo;
    player.balance -= toPay;
    player.bet += toPay;
    room.pot += toPay;
    room.lastRaiserIndex = room.activeSeat;
  }

  room.playersActedThisRound.add(player.id);

  const activePlayerCount = room.players.filter(p => !p.isFolded && p.balance > 0).length;
  
  // If only one player left, they win
  if (room.players.filter(p => !p.isFolded).length === 1) {
      evaluateWinners(roomId);
      return;
  }

  const everyoneActed = room.players.filter(p => !p.isFolded).every(p => 
    room.playersActedThisRound.has(p.id) && (p.bet === room.currentBet || p.balance === 0)
  );

  if (everyoneActed) {
    advancePhase(roomId);
  } else {
    let next = (room.activeSeat + 1) % room.players.length;
    while (room.players[next].isFolded || (room.players[next].balance === 0 && room.players[next].bet === room.currentBet)) {
      next = (next + 1) % room.players.length;
    }
    room.activeSeat = next;
    startTimer(roomId);
    broadcastRoom(roomId);
  }
};

io.on('connection', (socket: Socket) => {
  socket.on('join_room', ({ roomId, user }) => {
    socket.join(roomId);
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId, name: 'VIP Lounge', isPrivate: false, players: [], pot: 0, communityCards: [],
        phase: 'IDLE', activeSeat: 0, minBuyIn: 1000, currentBet: 0,
        deck: [], dealerIndex: 0, lastRaiserIndex: 0, minRaise: 100, playersActedThisRound: new Set(), messages: []
      };
      rooms.set(roomId, room);
    }
    if (!room.players.find(p => p.id === user.email)) {
      room.players.push({ ...user, id: user.email, hand: [], bet: 0, isFolded: false, isDealer: false, seat: room.players.length });
    }
    broadcastRoom(roomId);
  });

  socket.on('player_action', ({ roomId, playerId, action }) => {
    processAction(roomId, playerId, action);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.players.length < 2) return;
    room.deck = createDeck();
    room.pot = 0;
    room.phase = 'PRE_FLOP';
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    room.players.forEach((p, i) => {
      p.hand = [room.deck.pop()!, room.deck.pop()!];
      p.isFolded = false;
      p.bet = 0;
      p.isDealer = i === room.dealerIndex;
    });

    const sb = (room.dealerIndex + 1) % room.players.length;
    const bb = (room.dealerIndex + 2) % room.players.length;
    room.players[sb].balance -= 50; room.players[sb].bet = 50;
    room.players[bb].balance -= 100; room.players[bb].bet = 100;
    room.pot = 150; room.currentBet = 100;
    room.activeSeat = (bb + 1) % room.players.length;
    room.playersActedThisRound.clear();
    startTimer(roomId);
    broadcastRoom(roomId);
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(Number(PORT), '0.0.0.0', () => console.log('GUMBLE Backend Ready'));