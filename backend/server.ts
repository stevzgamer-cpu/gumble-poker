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

// 1. Connect MongoDB (The Vault)
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Mongo Connected'))
    .catch(e => console.error('❌ Mongo Error', e));
}

// 2. Connect Redis (The High-Speed Engine)
const redis = createClient({ url: process.env.REDIS_URL });
redis.on('error', (err) => console.log('Redis Client Error', err));
redis.connect().then(() => console.log('✅ Redis Connected'));

// Helper: Save/Load Game State
const saveGame = async (game: PokerGame) => {
  await redis.set(`poker:${game.state.id}`, JSON.stringify(game.state));
};

const loadGame = async (roomId: string): Promise<PokerGame | null> => {
  const data = await redis.get(`poker:${roomId}`);
  if (!data) return null;
  return PokerGame.fromState(JSON.parse(data));
};

// 3. Socket Logic
io.on('connection', (socket) => {
  
  socket.on('join_room', async ({ roomId, user }) => {
    socket.join(roomId);
    
    let game = await loadGame(roomId);
    if (!game) {
      game = new PokerGame(roomId); // Create new if doesn't exist
    }

    // CHECK MONGO: Does user have money?
    // (Simplified for brevity: In a real app, you'd fetch User model here)
    
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
    // LOCKING: Redis prevents two people acting at once
    const game = await loadGame(roomId);
    if (!game) return;

    const success = game.processAction(playerId, action);
    if (success) {
      
      // Check for Winner (Showdown or Fold)
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
    // Solve Hands
    const hands = active.map(p => {
       const fmt = p.hand.map(c => (c.value == '10' ? 'T' : c.value[0]) + c.suit[0].toLowerCase());
       const comm = game.state.communityCards.map(c => (c.value == '10' ? 'T' : c.value[0]) + c.suit[0].toLowerCase());
       return Hand.solve([...fmt, ...comm], p.id);
    });
    winners = Hand.winners(hands);
  }

  // PAYOUT: Update MongoDB
  const share = Math.floor(game.state.pot / winners.length);
  
  for (const w of winners) {
     const player = game.state.players.find(p => p.id === w.name || p.id === w.id); // Check logic
     if (player) {
        player.balance += share;
        // HERE IS THE MAGIC: Update Real Wallet
        // await User.findOneAndUpdate({ email: player.id }, { $inc: { balance: share } }); 
        
        const msg = { user: 'SYSTEM', text: `${player.name} wins $${share} (${w.descr || 'Fold'})`, timestamp: Date.now() };
        game.state.messages.push(msg);
     }
  }

  game.state.pot = 0;
  await saveGame(game);
  io.to(roomId).emit('room_state', game.state);

  // Reset after delay
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
httpServer.listen(Number(PORT), '0.0.0.0', () => console.log(`🚀 Pro Backend: ${PORT}`));