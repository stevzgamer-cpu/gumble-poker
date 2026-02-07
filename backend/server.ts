import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createClient } from 'redis'; // <-- PROOF: USING REDIS
import { PokerGame } from './engine/PokerGame';
import * as PokerSolver from 'pokersolver';

const Hand = (PokerSolver as any).Hand;
dotenv.config();

const app = express();
app.use(cors() as any);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// [FIX] MONGO CONNECTION
const MONGO_URI = process.env.MONGO_URI as string;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Mongo Connected'))
    .catch(e => console.error('❌ Mongo Error', e));
}

// [FIX] REDIS CONNECTION
// This is the line that makes it a "Pro System"
const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect().then(() => console.log('✅ Redis Connected'));

// Helper: Save game to Redis Cloud
const saveGame = async (game: PokerGame) => {
  await redis.set(`poker:${game.state.id}`, JSON.stringify(game.state));
};

// Helper: Load game from Redis Cloud
const loadGame = async (roomId: string): Promise<PokerGame | null> => {
  const data = await redis.get(`poker:${roomId}`);
  if (!data) return null;
  return PokerGame.fromState(JSON.parse(data));
};

io.on('connection', (socket) => {
  
  socket.on('join_room', async ({ roomId, user }) => {
    socket.join(roomId);
    
    let game = await loadGame(roomId);
    if (!game) {
      game = new PokerGame(roomId); 
    }
    
    game.addPlayer(user, socket.id);
    await saveGame(game);
    io.to(roomId).emit('room_state', game.state);
  });

  socket.on('start_game', async ({ roomId }) => {
    const game = await loadGame(roomId);
    if (!game) return;

    game.startGame();
    await saveGame(game);
    io.to(roomId).emit('room_state', game.state);
  });

  socket.on('player_action', async ({ roomId, playerId, action }) => {
    const game = await loadGame(roomId);
    if (!game) return;

    const success = game.processAction(playerId, action);
    if (success) {
      
      // Check for Winner
      if (game.state.phase === 'SHOWDOWN' || game.state.players.filter(p => !p.isFolded).length === 1) {
         await handleWin(game, roomId);
      } else {
         await saveGame(game);
         io.to(roomId).emit('room_state', game.state);
      }
    }
  });
});

async function handleWin(game: PokerGame, roomId: string) {
  const active = game.state.players.filter(p => !p.isFolded);
  let winners: any[] = [];

  if (active.length === 1) {
    winners = [{ name: active[0].id, descr: 'Opponents Folded' }];
  } else {
    const hands = active.map(p => {
       const fmt = p.hand.map(c => (c.value == '10' ? 'T' : c.value[0]) + c.suit[0].toLowerCase());
       const comm = game.state.communityCards.map(c => (c.value == '10' ? 'T' : c.value[0]) + c.suit[0].toLowerCase());
       return Hand.solve([...fmt, ...comm], p.id);
    });
    winners = Hand.winners(hands);
  }

  const share = Math.floor(game.state.pot / winners.length);
  
  for (const w of winners) {
     const player = game.state.players.find(p => p.id === w.name || p.id === w.id);
     if (player) {
        player.balance += share;
        const msg = { user: 'SYSTEM', text: `${player.name} wins $${share.toLocaleString()} (${w.descr || 'Fold'})`, timestamp: Date.now() };
        game.state.messages.push(msg);
     }
  }

  game.state.pot = 0;
  await saveGame(game);
  io.to(roomId).emit('room_state', game.state);

  setTimeout(async () => {
    const g = await loadGame(roomId);
    if(g) {
        g.state.phase = 'IDLE';
        g.state.communityCards = [];
        g.state.players.forEach(p => { p.hand = []; p.bet = 0; p.isFolded = false; });
        await saveGame(g);
        io.to(roomId).emit('room_state', g.state);
    }
  }, 6000);
}

const PORT = process.env.PORT || 10000;
httpServer.listen(Number(PORT), '0.0.0.0', () => console.log(`🚀 Pro Backend Active: ${PORT}`));