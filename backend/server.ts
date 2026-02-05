import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { Card, PokerPlayer, PokerRoom } from './types';

dotenv.config();

// 1. CHAT INTERFACE
interface ChatMessage {
  user: string;
  text: string;
  timestamp: number;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.json() as any);
// Fix for line 28: Cast to any to resolve "Argument of type 'NextHandleFunction' is not assignable to parameter of type 'PathParams'"
app.use(cors() as any);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || '';
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('GUMBLEVIP: MongoDB Connected'))
    .catch((err) => console.error('GUMBLEVIP: MongoDB Error', err));
}

// In-Memory Room Store - Extended to include deck and messages
const rooms = new Map<string, PokerRoom & { deck: Card[], messages: ChatMessage[] }>();

// Deck Utility
const createDeck = (): Card[] => {
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
  const deck: Card[] = [];
  suits.forEach(suit => {
    values.forEach(value => {
      deck.push({
        code: `${value[0]}${suit[0]}`,
        image: `https://deckofcardsapi.com/static/img/${value === '10' ? '0' : value[0]}${suit[0]}.png`,
        value,
        suit
      });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

io.on('connection', (socket: Socket) => {
  console.log(`Socket Connected: ${socket.id}`);

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
        messages: [] // Initialize message history
      };
      rooms.set(roomId, room);
    }

    if (room.players.length >= 8) {
      socket.emit('error', 'This table is at capacity.');
      return;
    }

    // Check if player already exists in room (handle reconnects)
    const existingPlayerIndex = room.players.findIndex(p => p.id === user.email);
    const newPlayer: PokerPlayer = {
      id: user.email,
      name: user.name,
      avatar: user.avatar,
      balance: user.balance,
      hand: [],
      bet: 0,
      isFolded: false,
      isDealer: room.players.length === 0,
      seat: existingPlayerIndex !== -1 ? room.players[existingPlayerIndex].seat : room.players.length
    };
    (newPlayer as any).socketId = socket.id; // Store socket ID for cleanup

    if (existingPlayerIndex !== -1) {
        room.players[existingPlayerIndex] = newPlayer;
    } else {
        room.players.push(newPlayer);
    }

    io.to(roomId).emit('room_state', room);
    // Send existing messages to the joining player
    socket.emit('chat_history', room.messages);
    console.log(`${user.name} joined room ${roomId} (Socket: ${socket.id})`);
  });

  // 2. REAL-TIME CHAT HANDLER
  socket.on('send_message', ({ roomId, user, text }: { roomId: string, user: string, text: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const newMessage: ChatMessage = {
      user,
      text,
      timestamp: Date.now()
    };

    room.messages.push(newMessage);
    // Keep history manageable (last 50 messages)
    if (room.messages.length > 50) room.messages.shift();

    io.to(roomId).emit('new_message', newMessage);
  });

  socket.on('start_game', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.players.length < 2) return;

    room.deck = createDeck();
    room.communityCards = [];
    room.pot = 0;
    room.phase = 'PRE_FLOP';
    room.activeSeat = 0;

    room.players.forEach((p: PokerPlayer) => {
      p.hand = [room!.deck.pop()!, room!.deck.pop()!];
      p.isFolded = false;
      p.bet = 0;
    });

    io.to(roomId).emit('room_state', room);
  });

  socket.on('player_action', ({ roomId, action }: { roomId: string, action: { type: string, amount?: number } }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const currentPlayer = room.players[room.activeSeat];
    if (action.type === 'FOLD') currentPlayer.isFolded = true;
    if (action.type === 'CALL') {
      const callAmount = 200; // Simulated big blind
      currentPlayer.balance -= callAmount;
      currentPlayer.bet += callAmount;
      room.pot += callAmount;
    }

    // Phase Advancement Logic
    room.activeSeat = (room.activeSeat + 1) % room.players.length;
    
    // Check if round should advance
    if (room.activeSeat === 0) {
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
        // Auto-reset after showdown
        setTimeout(() => {
          const updatedRoom = rooms.get(roomId);
          if (updatedRoom) {
            updatedRoom.phase = 'IDLE';
            io.to(roomId).emit('room_state', updatedRoom);
          }
        }, 8000);
      }
    }

    io.to(roomId).emit('room_state', room);
  });

  socket.on('leave_room', ({ roomId }: { roomId: string }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.players = room.players.filter((p: any) => p.socketId !== socket.id);
      if (room.players.length === 0) rooms.delete(roomId);
      else io.to(roomId).emit('room_state', room);
    }
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Socket Disconnected: ${socket.id}`);
    rooms.forEach((room, roomId) => {
      const playerIndex = room.players.findIndex((p: any) => p.socketId === socket.id);
      if (playerIndex !== -1) {
        room.players.splice(playerIndex, 1);
        if (room.players.length === 0) rooms.delete(roomId);
        else io.to(roomId).emit('room_state', room);
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`GUMBLEVIP Backend Active on 0.0.0.0:${PORT}`);
});