import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { createClient } from 'redis';
import { PokerGame } from './engine/PokerGame'; 
import * as PokerSolver from 'pokersolver';

const Hand = (PokerSolver as any).Hand;
dotenv.config();

const app = express();
app.use(cors() as any);
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// [FIX] The 'as string' forces TypeScript to accept these variables
const MONGO_URI = (process.env.MONGO_URI || "") as string;
const REDIS_URL = (process.env.REDIS_URL || "") as string;

// 1. Connect MongoDB
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Mongo Connected'))
    .catch(e => console.error('❌ Mongo Error', e));
} else {
  console.log("⚠️ MONGO_URI missing");
}

// 2. Connect Redis
// [FIX] We use the forced string variable here
const redis = createClient({ 
    url: REDIS_URL,
    socket: {
        tls: true,
        rejectUnauthorized: false
    }
});

redis.on('error', (err) => console.log('Redis Client Error', err));

(async () => {
    if (REDIS_URL) {
        await redis.connect();
        console.log('✅ Redis Connected');
    } else {
        console.log("⚠️ REDIS_URL missing");
    }
})();

// Helper: Save game to Redis
const saveGame = async (game: PokerGame) => {
  if (!redis.isOpen) return;
  await redis.set(`poker:${game.state.id}`, JSON.stringify(game.state));
};

// Helper: Load game from Redis
const loadGame = async (roomId: string): Promise<PokerGame | null> => {
  if (!redis.isOpen) return null;
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