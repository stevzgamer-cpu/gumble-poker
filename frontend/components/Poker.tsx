import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, GameOutcome, GameStatus, PokerPlayer, PokerRoom, User } from '../types';
import PokerLobby from './PokerLobby';

declare const Hand: any;

const SEAT_POSITIONS = [
  { x: 50, y: 88 },  { x: 22, y: 80 },  { x: 10, y: 50 },  { x: 22, y: 20 },
  { x: 50, y: 12 },  { x: 78, y: 20 },  { x: 90, y: 50 },  { x: 78, y: 80 },
];

const getSocketUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:10000';
  return window.location.origin;
};

const SOCKET_URL = getSocketUrl();

const PokerTable: React.FC<{ 
  user: User, 
  onGameEnd: (outcome: GameOutcome) => void, 
  roomId: string, 
  onNavigateToLobby: () => void 
}> = ({ user, onGameEnd, roomId, onNavigateToLobby }) => {
  const [room, setRoom] = useState<PokerRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [winnerMsg, setWinnerMsg] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      auth: { token: user.email },
      transports: ['websocket', 'polling']
    } as any);
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('join_room', { roomId, user }));
    socket.on('room_state', (updatedRoom: PokerRoom) => {
      setRoom(updatedRoom);
      setIsLoading(false);
      if (updatedRoom.phase === 'SHOWDOWN') evaluateWinners(updatedRoom);
      else setWinnerMsg(null);
    });
    socket.on('error', (msg: string) => { alert(msg); onNavigateToLobby(); });

    return () => { socket.emit('leave_room', { roomId }); socket.disconnect(); };
  }, [roomId, user.email, onNavigateToLobby]);

  const evaluateWinners = (currentRoom: PokerRoom) => {
    try {
      if (typeof Hand === 'undefined') return;
      const active = currentRoom.players.filter(p => !p.isFolded);
      const fmt = (c: Card) => (c.value === '10' ? '10' : c.value[0]) + c.suit[0].toLowerCase();
      const community = currentRoom.communityCards.map(fmt);
      const solved = active.map(p => {
        const full = [...p.hand.map(fmt), ...community];
        return Hand.solve(full, p.id);
      });
      const winners = Hand.winners(solved);
      if (winners.length > 0) {
        const winnerId = winners[0].name;
        const player = active.find(p => p.id === winnerId);
        setWinnerMsg(`${player?.name} won with ${winners[0].descr}!`);
        if (winnerId === user.email) onGameEnd({ status: GameStatus.WON, amount: currentRoom.pot, message: `Win! ${winners[0].descr}` });
      }
    } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="h-full w-full flex items-center justify-center font-cinzel text-luxury-gold animate-pulse">Establishing Connection...</div>;

  const isMyTurn = room?.players[room.activeSeat]?.id === user.email && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 animate-in fade-in">
      <div className="relative w-full max-w-5xl aspect-[16/9] bg-[#0a3d1d] rounded-[200px] border-[10px] border-luxury-gold/30 shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_120px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 pointer-events-none" />
        
        {/* Pot and Info */}
        <div className="absolute top-[60%] flex flex-col items-center z-10">
          <span className="text-gray-400 text-[8px] uppercase tracking-widest font-black">Pot</span>
          <div className="bg-black/90 px-6 py-2 md:px-10 md:py-3 rounded-full border border-luxury-gold/40 text-luxury-gold font-cinzel font-bold text-sm md:text-2xl gold-glow shadow-2xl">
            ${room?.pot.toLocaleString()}
          </div>
          {winnerMsg && <div className="mt-2 bg-luxury-gold px-4 py-1 rounded text-luxury-black font-black text-[8px] uppercase tracking-widest">{winnerMsg}</div>}
        </div>

        {/* Community Cards */}
        <div className="flex gap-2 z-10">
           {room?.communityCards.map((c, i) => (
             <div key={i} className="w-10 h-14 md:w-20 md:h-28 rounded-md md:rounded-lg border border-luxury-gold/20 shadow-xl overflow-hidden animate-in zoom-in">
                <img src={c.image} className="w-full h-full object-cover" />
             </div>
           ))}
           {Array.from({ length: 5 - (room?.communityCards.length || 0) }).map((_, i) => (
             <div key={i} className="w-10 h-14 md:w-20 md:h-28 rounded-md md:rounded-lg bg-black/30 border border-white/5" />
           ))}
        </div>

        {/* Seats */}
        {SEAT_POSITIONS.map((pos, i) => {
          const player = room?.players.find(p => p.seat === i);
          const active = room?.activeSeat === i && room?.phase !== 'IDLE' && room?.phase !== 'SHOWDOWN';
          const isMe = player?.id === user.email;
          return (
            <div key={i} className="absolute flex flex-col items-center gap-1" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
              {player ? (
                <div className={`flex flex-col items-center transition-all ${active ? 'scale-110' : 'scale-90 md:scale-100 opacity-80'}`}>
                  <div className="flex -space-x-4 md:-space-x-10 mb-1">
                    {player.hand.length > 0 ? player.hand.map((c, idx) => (
                      <div key={idx} className={`w-8 h-12 md:w-12 md:h-18 rounded border border-luxury-gold/10 shadow-xl overflow-hidden ${player.isFolded && 'opacity-30'}`}>
                        <img src={(isMe || room?.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full object-cover" />
                      </div>
                    )) : <div className="w-8 h-12 md:w-12 md:h-18 bg-black/20 rounded border border-dashed border-white/10" />}
                  </div>
                  <div className={`flex flex-col items-center bg-[#050505]/95 p-1.5 md:p-3 rounded-xl border ${active ? 'border-luxury-gold shadow-lg' : 'border-white/5'}`}>
                    <img src={player.avatar} className="w-6 h-6 md:w-10 md:h-10 rounded-full border border-luxury-gold/30" />
                    <span className="text-[6px] md:text-[9px] text-white font-bold mt-1 uppercase truncate max-w-[40px] md:max-w-[70px]">{isMe ? 'YOU' : player.name}</span>
                    <span className="text-[5px] md:text-[8px] text-luxury-gold font-black">${player.balance.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="w-12 h-8 md:w-20 md:h-14 border border-dashed border-white/5 rounded-xl opacity-10" />
              )}
            </div>
          );
        })}
      </div>

      {isMyTurn && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:gap-4 bg-luxury-black/95 backdrop-blur-2xl p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-luxury-gold/30 shadow-2xl z-50 w-[95%] md:w-auto overflow-hidden">
          <div className="pr-4 border-r border-white/10 mr-2 md:mr-4 hidden sm:block">
            <span className="text-[8px] text-gray-500 uppercase font-black">Bet to Call</span>
            <span className="text-sm md:text-xl text-white font-black italic block">${(room?.currentBet || 0).toLocaleString()}</span>
          </div>
          <div className="flex gap-2 flex-1">
            <button onClick={() => socketRef.current?.emit('player_action', { roomId, action: { type: 'FOLD' } })} className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white font-black rounded-xl text-[8px] md:text-[10px] uppercase">Fold</button>
            <button onClick={() => socketRef.current?.emit('player_action', { roomId, action: { type: 'CHECK' } })} className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 text-white font-black rounded-xl text-[8px] md:text-[10px] uppercase">Check</button>
            <button onClick={() => socketRef.current?.emit('player_action', { roomId, action: { type: 'CALL' } })} className="flex-[2] px-6 py-2.5 bg-luxury-gold text-luxury-black font-black rounded-xl text-[8px] md:text-[10px] uppercase gold-glow">Call</button>
          </div>
        </div>
      )}

      {room?.phase === 'IDLE' && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/40 backdrop-blur-sm">
          <button onClick={() => socketRef.current?.emit('start_game', { roomId })} disabled={room.players.length < 2} className="px-10 py-4 bg-luxury-gold text-luxury-black font-cinzel font-bold text-lg md:text-2xl rounded-2xl shadow-2xl gold-glow hover:scale-105 transition-all disabled:opacity-30">
            START GAME ({room.players.length}/2+)
          </button>
        </div>
      )}
    </div>
  );
};

const Poker: React.FC<{ user: User, onGameEnd: (o: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  if (activeRoomId) return <PokerTable user={user} onGameEnd={onGameEnd} roomId={activeRoomId} onNavigateToLobby={() => setActiveRoomId(null)} />;
  return <PokerLobby onCreateRoom={() => setActiveRoomId(Math.random().toString(36).substring(2, 8).toUpperCase())} onJoinRoom={setActiveRoomId} />;
};

export default Poker;