
/**
 * GUMBLEVIP Production Backend Logic with Socket.IO Synchronization
 * Includes full Poker game loop handling.
 */

/*
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.json());
app.use(cors());

// In-Memory Store for Active Poker Rooms
const rooms = new Map<string, any>();

// Helper to get deck or simulated deck
const generateDeck = () => {
  const suits = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'JACK', 'QUEEN', 'KING', 'ACE'];
  const deck: any[] = [];
  suits.forEach(suit => {
    values.forEach(value => {
      deck.push({ 
        code: value[0] + suit[0], 
        image: `https://deckofcardsapi.com/static/img/${value[0]}${suit[0]}.png`,
        value, 
        suit 
      });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId, user }) => {
    socket.join(roomId);
    let room = rooms.get(roomId);
    if (!room) {
      room = {
        id: roomId,
        name: `High Roller Table ${roomId}`,
        players: [],
        pot: 0,
        communityCards: [],
        phase: 'IDLE',
        activeSeat: 0,
        deck: generateDeck()
      };
      rooms.set(roomId, room);
    }

    if (room.players.length >= 8) return socket.emit('error', 'Room is full');
    
    const newPlayer = {
      id: user.email,
      socketId: socket.id,
      name: user.name,
      avatar: user.avatar,
      balance: user.balance,
      seat: room.players.length,
      hand: [],
      bet: 0,
      isFolded: false
    };
    
    room.players.push(newPlayer);
    io.to(roomId).emit('room_state', room);
  });

  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.players.length < 2) return;

    room.deck = generateDeck();
    room.communityCards = [];
    room.pot = 0;
    room.phase = 'PRE_FLOP';
    
    // Deal 2 cards to each player
    room.players.forEach(p => {
      p.hand = [room.deck.pop(), room.deck.pop()];
      p.isFolded = false;
      p.bet = 0;
    });

    room.activeSeat = 0;
    io.to(roomId).emit('room_state', room);
  });

  socket.on('player_action', ({ roomId, action }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players[room.activeSeat];
    if (action.type === 'FOLD') player.isFolded = true;
    if (action.type === 'CALL') {
        const bet = 200; // Mock fixed bet for demo
        player.balance -= bet;
        player.bet += bet;
        room.pot += bet;
    }

    // Advance to next active player or next phase
    room.activeSeat = (room.activeSeat + 1) % room.players.length;
    
    // Logic to check if round finished
    const activePlayers = room.players.filter(p => !p.isFolded);
    if (room.activeSeat === 0) { // Simple turn completion logic
        if (room.phase === 'PRE_FLOP') {
            room.phase = 'FLOP';
            room.communityCards = [room.deck.pop(), room.deck.pop(), room.deck.pop()];
        } else if (room.phase === 'FLOP') {
            room.phase = 'TURN';
            room.communityCards.push(room.deck.pop());
        } else if (room.phase === 'TURN') {
            room.phase = 'RIVER';
            room.communityCards.push(room.deck.pop());
        } else if (room.phase === 'RIVER') {
            room.phase = 'SHOWDOWN';
            // After Showdown, reset to IDLE after 10 seconds
            setTimeout(() => {
                room.phase = 'IDLE';
                io.to(roomId).emit('room_state', room);
            }, 10000);
        }
    }

    io.to(roomId).emit('room_state', room);
  });

  socket.on('disconnect', () => {
    rooms.forEach((room, roomId) => {
      room.players = room.players.filter(p => p.socketId !== socket.id);
      if (room.players.length === 0) rooms.delete(roomId);
      else io.to(roomId).emit('room_state', room);
    });
  });
});

httpServer.listen(3001, () => console.log('Poker Backend Sync Server Active'));
*/
