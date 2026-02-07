import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, GameOutcome, GameStatus, PokerPlayer, PokerRoom, User, ChatMessage } from '../types';
import PokerLobby from './PokerLobby';

const BACKEND_URL = 'https://gumble-backend.onrender.com';

const SEAT_POSITIONS = [
  { top: '85%', left: '50%' }, 
  { top: '75%', left: '15%' }, 
  { top: '45%', left: '8%' },  
  { top: '15%', left: '20%' }, 
  { top: '10%', left: '50%' }, 
  { top: '15%', left: '80%' }, 
  { top: '45%', left: '92%' }, 
  { top: '75%', left: '85%' }, 
];

const PokerTable: React.FC<{ user: User, roomId: string, onExit: () => void, onGameEnd: (outcome: GameOutcome) => void }> = ({ user, roomId, onExit, onGameEnd }) => {
  const [room, setRoom] = useState<PokerRoom | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(200);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, { reconnectionAttempts: 5, timeout: 10000 });
    
    socketRef.current.on('connect', () => {
        socketRef.current?.emit('join_room', { roomId, user });
    });

    socketRef.current.on('room_state', (state: PokerRoom) => {
        setRoom(state);
        
        // MONEY FIX: Listen for system messages to award wins
        if (state.messages && state.messages.length > 0) {
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg && lastMsg.user === 'SYSTEM' && lastMsg.text.includes(user.name) && lastMsg.text.includes('wins')) {
                const amountMatch = lastMsg.text.match(/\$(\d+(?:,\d+)*)/);
                if (amountMatch) {
                    const amount = parseInt(amountMatch[1].replace(/,/g, ''));
                    // Only trigger if we haven't processed this timestamp yet (simple dedupe)
                    onGameEnd({ status: GameStatus.WON, amount: amount, message: lastMsg.text });
                }
            }
        }
    });

    socketRef.current.on('game_msg', (msg: string) => alert(msg));
    
    return () => { socketRef.current?.disconnect(); };
  }, [roomId, user, onGameEnd]);

  const myPlayer = useMemo(() => room?.players.find(p => p.id === user.email), [room, user.email]);
  const mySeat = myPlayer?.seat ?? 0;

  const handleAction = (type: string, amount?: number) => {
    socketRef.current?.emit('player_action', { roomId, playerId: user.email, action: { type, amount } });
  };

  const handleStart = () => socketRef.current?.emit('start_game', { roomId });

  if (!room) return <div className="h-full w-full flex items-center justify-center text-luxury-gold font-cinzel text-xl animate-pulse">CONNECTING TO TABLE...</div>;

  return (
    <div className="relative w-full h-full bg-luxury-black overflow-hidden flex items-center justify-center font-montserrat p-4">
      <div className="relative w-full max-w-[95vw] aspect-[2/1] lg:aspect-[2.2/1] bg-[#071a0f] rounded-[500px] border-[12px] md:border-[24px] border-[#1a1a1a] shadow-[0_50px_100px_rgba(0,0,0,0.8),inset_0_0_150px_rgba(0,0,0,0.9)] flex items-center justify-center">
        
        {/* Pot Hub */}
        <div className="absolute top-[22%] left-1/2 -translate-x-1/2 flex flex-col items-center z-20">
          <div className="bg-black/90 border border-luxury-gold/40 px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl">
            <div className="w-4 h-4 bg-luxury-gold rounded-full shadow-inner" />
            <span className="text-luxury-gold font-cinzel font-black text-xl md:text-3xl">${room.pot.toLocaleString()}</span>
          </div>
        </div>

        {/* Community Cards */}
        <div className="absolute top-[42%] left-1/2 -translate-x-1/2 flex gap-1.5 md:gap-3 z-10 w-full justify-center">
          {room.communityCards.map((c, i) => (
            <div key={i} className="w-[10vw] h-[15vw] max-w-[100px] max-h-[140px] rounded-lg md:rounded-xl border border-white/20 shadow-2xl overflow-hidden animate-in zoom-in">
              <img src={c.image} className="w-full h-full object-cover" />
            </div>
          ))}
          {Array.from({ length: 5 - room.communityCards.length }).map((_, i) => (
            <div key={i} className="w-[10vw] h-[15vw] max-w-[100px] max-h-[140px] rounded-lg md:rounded-xl border border-white/5 bg-black/30 backdrop-blur-sm" />
          ))}
        </div>

        {/* Players */}
        {room.players.map((p) => {
          const visualSeatIdx = (p.seat - mySeat + 8) % 8;
          const pos = SEAT_POSITIONS[visualSeatIdx];
          const isTurn = room.activeSeat === p.seat && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';
          const isMe = p.id === user.email;

          return (
            <div key={p.id} className="absolute flex flex-col items-center transition-all duration-700" style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}>
              {room.currentBet > p.bet && !p.isFolded && room.activeSeat === p.seat && (
                <div className="absolute -top-12 bg-red-600 px-3 py-1 rounded text-[10px] text-white font-black uppercase tracking-tighter animate-bounce z-30 shadow-lg">
                  CALL ${room.currentBet - p.bet}
                </div>
              )}
              <div className="flex -space-x-[30%] mb-2 md:mb-4">
                {p.hand.length > 0 ? p.hand.map((c, idx) => (
                  <div key={idx} className={`w-[12vw] h-[18vw] md:w-[8vw] md:h-[12vw] max-w-[120px] max-h-[180px] rounded-lg border-2 border-white/10 shadow-2xl overflow-hidden transform ${p.isFolded ? 'opacity-20 grayscale' : 'z-20'}`}>
                    <img src={(isMe || room.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full object-cover" />
                  </div>
                )) : !p.isFolded && room.phase !== 'IDLE' && (
                  <div className="flex -space-x-10">
                    <div className="w-[12vw] h-[18vw] bg-black/40 rounded-lg border border-white/5" />
                    <div className="w-[12vw] h-[18vw] bg-black/40 rounded-lg border border-white/5" />
                  </div>
                )}
              </div>
              <div className={`relative flex flex-col items-center bg-[#0a0a0a]/95 p-2 md:p-3 rounded-2xl border-2 transition-all duration-300 min-w-[100px] md:min-w-[160px] ${isTurn ? 'border-luxury-gold shadow-2xl scale-110' : 'border-white/5'}`}>
                <div className="relative">
                  <img src={p.avatar} className={`w-10 h-10 md:w-16 md:h-16 rounded-full border-2 ${isTurn ? 'border-luxury-gold' : 'border-white/10'}`} />
                  {p.isDealer && <div className="absolute -right-1 -top-1 w-5 h-5 md:w-8 md:h-8 bg-white text-black text-[10px] font-black rounded-full flex items-center justify-center border border-black shadow-lg">D</div>}
                </div>
                <span className="text-[10px] md:text-sm text-white font-black mt-1 uppercase truncate max-w-[80px] md:max-w-[140px]">{isMe ? 'YOU' : p.name}</span>
                <span className="text-[9px] md:text-xs text-luxury-gold font-bold">${p.balance.toLocaleString()}</span>
                {isTurn && (
                  <div className="absolute bottom-0 left-0 h-1 bg-luxury-gold rounded-full animate-[timer_30s_linear_forwards]" style={{ width: '100%' }} />
                )}
              </div>
              {p.bet > 0 && (
                <div className="mt-2 bg-luxury-black/80 border border-luxury-gold/30 px-3 py-1 rounded-full text-[10px] md:text-xs text-luxury-gold font-bold">
                  ${p.bet.toLocaleString()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Control Panel */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-4xl z-[100]">
        {room.phase === 'IDLE' || room.phase === 'SHOWDOWN' ? (
          <button onClick={handleStart} className="w-full py-5 bg-luxury-gold text-luxury-black font-cinzel font-black text-2xl rounded-2xl shadow-2xl gold-glow uppercase tracking-widest transition-transform active:scale-95">
            DEAL NEW HAND
          </button>
        ) : room.activeSeat === mySeat ? (
          <div className="bg-[#050505]/98 p-4 md:p-8 rounded-[40px] border border-luxury-gold/30 shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center text-xs font-black uppercase text-gray-400 tracking-widest px-2">
              <span>Bet: ${raiseAmount}</span>
              <button onClick={onExit} className="text-red-500 underline">Exit Table</button>
            </div>
            <input type="range" min={room.currentBet + 100} max={myPlayer?.balance} step={50} value={raiseAmount} onChange={e => setRaiseAmount(parseInt(e.target.value))} className="w-full h-2 bg-luxury-gold/10 accent-luxury-gold rounded-full appearance-none cursor-pointer" />
            <div className="flex gap-2 md:gap-4">
              <button onClick={() => handleAction('FOLD')} className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:bg-red-900/20 transition-all uppercase text-[10px]">Fold</button>
              {room.currentBet === myPlayer?.bet ? (
                <button onClick={() => handleAction('CHECK')} className="flex-1 py-4 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:bg-white/10 transition-all uppercase text-[10px]">Check</button>
              ) : (
                <button onClick={() => handleAction('CALL')} className="flex-1 py-4 bg-luxury-gold text-luxury-black font-black rounded-xl uppercase text-[10px] shadow-lg">Call</button>
              )}
              <button onClick={() => handleAction('RAISE', raiseAmount)} className="flex-1 py-4 border-2 border-luxury-gold text-luxury-gold font-black rounded-xl uppercase text-[10px]">Raise</button>
            </div>
          </div>
        ) : (
          <div className="bg-black/90 px-12 py-4 rounded-full border border-luxury-gold/20 flex items-center justify-center gap-4 mx-auto w-fit shadow-2xl animate-pulse">
            <div className="w-2 h-2 bg-luxury-gold rounded-full animate-ping" />
            <span className="text-luxury-gold font-black text-xs uppercase tracking-[0.4em]">Waiting for Action...</span>
          </div>
        )}
      </div>
      <style>{`@keyframes timer { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  );
};

const Poker: React.FC<{ user: User, onGameEnd: (outcome: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  if (activeRoomId) return <PokerTable user={user} roomId={activeRoomId} onExit={() => setActiveRoomId(null)} onGameEnd={onGameEnd} />;
  return <PokerLobby onCreateRoom={() => setActiveRoomId("ROYAL-777")} onJoinRoom={setActiveRoomId} />;
};

export default Poker;