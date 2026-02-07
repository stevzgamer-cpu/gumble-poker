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

interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

interface PokerRoomInternal extends PokerRoom {
  deck: Card[];
  messages: ChatMessage[];
  dealerIndex: number;
  minRaise: number;
  lastRaiserIndex: number;
  actionStartTime: number;
  timerHandle?: any;
}

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

const TURN_TIME = 30000; // 30 seconds per turn

const broadcastRoom = (roomId: string) => {
  const room = rooms.get(roomId);
  if (room) {
    const { deck, timerHandle, ...publicRoom } = room;
    io.to(roomId).emit('room_state', publicRoom);
  }
};

const handleNextTurn = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.timerHandle) clearTimeout(room.timerHandle);

  // LOGIC FIX: Round ends ONLY if everyone active has matched the bet
  const activePlayers = room.players.filter(p => !p.isFolded && p.balance > 0);
  const everyoneMatched = activePlayers.every(p => p.bet === room.currentBet);
  
  // If everyone matched AND we are back to the aggressor (or everyone checked), advance.
  // Special case: If only one person is left, they win immediately.
  const activeCount = room.players.filter(p => !p.isFolded).length;
  if (activeCount < 2) {
      evaluateWinners(roomId);
      return;
  }

  // If everyone acted and bets are equal, go to next phase
  // We check if the current player is the last one who needed to act
  let nextSeat = (room.activeSeat + 1) % room.players.length;
  
  // Skip folded/all-in players
  let attempts = 0;
  while ((room.players[nextSeat].isFolded || room.players[nextSeat].balance === 0) && attempts < room.players.length) {
    nextSeat = (nextSeat + 1) % room.players.length;
    attempts++;
  }

  // If we wrapped around to the last raiser (or dealer if no raise) AND everyone matched:
  if (everyoneMatched && (room.activeSeat === room.lastRaiserIndex || (room.currentBet === 0 && attempts >= activeCount))) {
      advancePhase(roomId);
      return;
  }

  // Otherwise, give turn to next player
  room.activeSeat = nextSeat;
  room.actionStartTime = Date.now(); // Start Timer
  broadcastRoom(roomId);

  // Auto-Fold Timer
  room.timerHandle = setTimeout(() => {
    const afkPlayerId = room.players[nextSeat].id;
    console.log(`Auto-folding player ${afkPlayerId}`);
    processAction(roomId, afkPlayerId, { type: 'FOLD' });
  }, TURN_TIME);
};

const advancePhase = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Reset bets for new round
  room.players.forEach(p => p.bet = 0);
  room.currentBet = 0;
  room.minRaise = 100;
  
  // Reveal Cards based on phase
  if (room.phase === 'PRE_FLOP') {
    room.phase = 'FLOP';
    room.communityCards = [room.deck.pop()!, room.deck.pop()!, room.deck.pop()!];
  } else if (room.phase === 'FLOP') {
    room.phase = 'TURN';
    room.communityCards.push(room.deck.pop()!);
  } else if (room.phase === 'TURN') {
    room.phase = 'RIVER';
    room.communityCards.push(room.deck.pop()!);
  } else if (room.phase === 'RIVER') {
    room.phase = 'SHOWDOWN';
    evaluateWinners(roomId);
    return;
  }

  // Reset turn to player left of dealer
  let nextSeat = (room.dealerIndex + 1) % room.players.length;
  while (room.players[nextSeat].isFolded || room.players[nextSeat].balance === 0) {
      nextSeat = (nextSeat + 1) % room.players.length;
  }
  
  room.activeSeat = nextSeat;
  room.lastRaiserIndex = nextSeat; // Reset aggressor to first actor
  room.actionStartTime = Date.now();
  
  broadcastRoom(roomId);
};

const evaluateWinners = (roomId: string) => {
  const room = rooms.get(roomId);
  if (!room) return;

  const activePlayers = room.players.filter(p => !p.isFolded);
  
  if (activePlayers.length === 1) {
    // Fold Win
    const winner = activePlayers[0];
    winner.balance += room.pot;
    room.messages.push({ user: 'SYSTEM', text: `${winner.name} wins $${room.pot.toLocaleString()} (Others Folded)`, timestamp: Date.now() });
  } else {
    // Showdown
    const formatCard = (c: Card) => {
      const val = c.value === '10' ? 'T' : c.value[0];
      return val + c.suit[0].toLowerCase();
    };

    const community = room.communityCards.map(formatCard);
    const hands = activePlayers.map(p => {
      const fullHand = [...p.hand.map(formatCard), ...community];
      return Hand.solve(fullHand, p.id); // Hand.solve returns object with .name (id) and .descr
    });

    const winners = Hand.winners(hands); // Returns array of winning hands
    const share = Math.floor(room.pot / winners.length);

    winners.forEach((w: any) => {
      // pokersolver uses the 'name' property to store ID
      const player = room.players.find(p => p.id === w.name); 
      if (player) {
        player.balance += share;
        room.messages.push({ user: 'SYSTEM', text: `${player.name} wins $${share.toLocaleString()} with ${w.descr}`, timestamp: Date.now() });
      }
    });
  }

  room.pot = 0;
  broadcastRoom(roomId);

  // New Game Delay
  setTimeout(() => {
    room.phase = 'IDLE';
    room.communityCards = [];
    room.players.forEach(p => { p.hand = []; p.bet = 0; p.isFolded = false; });
    broadcastRoom(roomId);
  }, 8000);
};

const processAction = (roomId: string, playerId: string, action: { type: string, amount?: number }) => {
  const room = rooms.get(roomId);
  if (!room || room.phase === 'IDLE' || room.phase === 'SHOWDOWN') return;

  // STRICT TURN CHECK
  const player = room.players[room.activeSeat];
  if (player.id !== playerId) return; 

  if (action.type === 'FOLD') {
    player.isFolded = true;
    room.messages.push({ user: 'SYSTEM', text: `${player.name} folds`, timestamp: Date.now() });
  } else if (action.type === 'CHECK') {
    if (player.bet < room.currentBet) return; 
    room.messages.push({ user: 'SYSTEM', text: `${player.name} checks`, timestamp: Date.now() });
  } else if (action.type === 'CALL') {
    const callAmount = room.currentBet - player.bet;
    const actualCall = Math.min(callAmount, player.balance);
    player.balance -= actualCall;
    player.bet += actualCall;
    room.pot += actualCall;
    room.messages.push({ user: 'SYSTEM', text: `${player.name} calls $${actualCall.toLocaleString()}`, timestamp: Date.now() });
  } else if (action.type === 'RAISE') {
    const raiseAmount = action.amount || room.minRaise;
    const totalNewBet = room.currentBet + raiseAmount;
    const toPay = totalNewBet - player.bet;

    if (player.balance < toPay) return;

    player.balance -= toPay;
    player.bet += toPay;
    room.pot += toPay;
    room.minRaise = raiseAmount;
    room.currentBet = totalNewBet;
    room.lastRaiserIndex = room.activeSeat; // Update aggressor
    room.messages.push({ user: 'SYSTEM', text: `${player.name} raises to $${totalNewBet.toLocaleString()}`, timestamp: Date.now() });
  }

  handleNextTurn(roomId);
};

io.on('connection', (socket: Socket) => {
  socket.on('join_room', ({ roomId, user }: { roomId: string, user: any }) => {
    socket.join(roomId);
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: `High Roller Lounge ${roomId.slice(0, 3)}`,
        isPrivate: false,
        players: [],
        pot: 0,
        communityCards: [],
        phase: 'IDLE',
        activeSeat: 0,
        minBuyIn: 1000,
        deck: createDeck(),
        messages: [],
        dealerIndex: 0,
        currentBet: 0,
        minRaise: 100,
        lastRaiserIndex: 0,
        actionStartTime: 0
      };
      rooms.set(roomId, room);
    }

    const existingPlayer = room.players.find(p => p.id === user.email);
    if (!existingPlayer) {
      const newPlayer = {
        id: user.email,
        name: user.name,
        avatar: user.avatar,
        balance: user.balance,
        hand: [],
        bet: 0,
        isFolded: false,
        isDealer: room.players.length === 0,
        seat: room.players.length
      };
      (newPlayer as any).socketId = socket.id; 
      room.players.push(newPlayer);
    } else {
      (existingPlayer as any).socketId = socket.id;
    }

    broadcastRoom(roomId);
    socket.emit('chat_history', room.messages);
  });

  socket.on('start_game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.players.length < 2 || room.phase !== 'IDLE') return;

    room.deck = createDeck();
    room.communityCards = [];
    room.pot = 0;
    room.phase = 'PRE_FLOP';
    
    room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
    room.players.forEach((p, i) => {
      p.isDealer = i === room.dealerIndex;
      p.hand = [room.deck.pop()!, room.deck.pop()!];
      p.isFolded = false;
      p.bet = 0;
    });

    const sbIndex = (room.dealerIndex + 1) % room.players.length;
    const bbIndex = (room.dealerIndex + 2) % room.players.length;
    
    room.players[sbIndex].balance -= 50;
    room.players[sbIndex].bet = 50;
    room.players[bbIndex].balance -= 100;
    room.players[bbIndex].bet = 100;
    room.pot = 150;
    room.currentBet = 100;
    room.minRaise = 100;

    room.activeSeat = (bbIndex + 1) % room.players.length;
    room.lastRaiserIndex = bbIndex; // Big Blind starts as aggressor
    
    handleNextTurn(roomId);
  });

  socket.on('player_action', ({ roomId, action }: { roomId: string, action: { type: string, amount?: number } }) => {
    processAction(roomId, (socket.handshake.auth.token || ''), action);
  });

  socket.on('send_message', ({ roomId, user, text }: { roomId: string, user: string, text: string }) => {
    const room = rooms.get(roomId);
    if (room) {
      const msg = { user, text, timestamp: Date.now() };
      room.messages.push(msg);
      io.to(roomId).emit('new_message', msg);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex((p: any) => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) rooms.delete(roomId);
        else broadcastRoom(roomId);
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`GUMBLEVIP Backend Active on 0.0.0.0:${PORT}`);
});