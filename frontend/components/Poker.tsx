import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameOutcome, GameStatus, PokerRoom, User } from '../types';
import PokerLobby from './PokerLobby';
import { Copy, LogOut } from 'lucide-react'; // Make sure you have lucide-react or use text

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
        // [FEATURE] Re-join on refresh (Persistency)
        socketRef.current?.emit('join_room', { roomId, user });
    });

    socketRef.current.on('room_state', (state: PokerRoom) => {
        setRoom(state);
        
        // Win Logic
        if (state.messages && state.messages.length > 0) {
            const lastMsg = state.messages[state.messages.length - 1];
            if (lastMsg.user === 'SYSTEM' && lastMsg.text.includes(user.name) && lastMsg.text.includes('wins')) {
                const amountMatch = lastMsg.text.match(/\$(\d+(?:,\d+)*)/);
                if (amountMatch) {
                    const amount = parseInt(amountMatch[1].replace(/,/g, ''));
                    // Only trigger if timestamp is recent (prevents double pay on refresh)
                    if (Date.now() - lastMsg.timestamp < 5000) {
                        onGameEnd({ status: GameStatus.WON, amount: amount, message: lastMsg.text });
                    }
                }
            }
        }
    });

    return () => { socketRef.current?.disconnect(); };
  }, [roomId, user, onGameEnd]);

  const handleLeave = () => {
      socketRef.current?.emit('leave_room', { roomId, userId: user.email });
      onExit();
  };

  const handleInvite = () => {
      navigator.clipboard.writeText(window.location.href);
      alert("Room Link Copied!");
  };

  const handleAction = (type: string, amount?: number) => {
    socketRef.current?.emit('player_action', { roomId, playerId: user.email, action: { type, amount } });
  };

  const handleStart = () => socketRef.current?.emit('start_game', { roomId });

  if (!room) return <div className="h-full w-full flex items-center justify-center text-luxury-gold font-cinzel text-xl animate-pulse">CONNECTING TO TABLE...</div>;

  const myPlayer = room.players.find(p => p.id === user.email);
  const mySeat = myPlayer?.seat ?? 0;

  return (
    <div className="relative w-full h-full bg-luxury-black overflow-hidden flex items-center justify-center font-montserrat select-none">
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-50">
        <button onClick={handleInvite} className="bg-luxury-gold/20 p-2 rounded-full border border-luxury-gold/50 text-luxury-gold hover:bg-luxury-gold/40 transition">
            <span className="text-xs font-bold">INVITE</span>
        </button>
        <button onClick={handleLeave} className="bg-red-500/20 p-2 rounded-full border border-red-500/50 text-red-500 hover:bg-red-500/40 transition">
            <span className="text-xs font-bold">LEAVE</span>
        </button>
      </div>

      {/* The Poker Table */}
      <div className="relative w-[95vw] aspect-[1.8/1] max-w-[1200px] bg-[#071a0f] rounded-[200px] border-[15px] border-[#2a2a2a] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center">
        
        {/* Table Felt Branding */}
        <div className="absolute opacity-10 font-cinzel text-6xl text-white font-black select-none pointer-events-none">GUMBLE VIP</div>

        {/* Pot */}
        <div className="absolute top-[28%] flex flex-col items-center z-20">
          <div className="bg-black/60 border border-luxury-gold/30 px-6 py-1 rounded-full text-luxury-gold font-cinzel text-2xl shadow-lg backdrop-blur-md">
            ${room.pot.toLocaleString()}
          </div>
          {room.messages.length > 0 && (
             <div className="mt-2 text-[10px] text-yellow-200/80 animate-fade-out">{room.messages[room.messages.length-1].text}</div>
          )}
        </div>

        {/* Community Cards */}
        <div className="absolute top-[45%] flex gap-2 z-10">
          {room.communityCards.map((c, i) => (
            <img key={i} src={c.image} className="w-[8vw] max-w-[70px] rounded shadow-xl animate-in zoom-in" />
          ))}
        </div>

        {/* Players */}
        {room.players.map((p) => {
          const visualSeatIdx = (p.seat - mySeat + 8) % 8;
          const pos = SEAT_POSITIONS[visualSeatIdx];
          const isTurn = room.activeSeat === p.seat && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';

          return (
            <div key={p.id} className="absolute flex flex-col items-center w-[20vw] max-w-[120px]" style={{ top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)' }}>
              
              {/* Turn Timer Bar */}
              {isTurn && (
                  <div className="w-full h-1 bg-gray-800 rounded-full mb-1 overflow-hidden">
                      <div className="h-full bg-luxury-gold animate-[timer_15s_linear_forwards] w-full" />
                  </div>
              )}

              {/* Avatar & Info */}
              <div className={`relative flex flex-col items-center bg-black/90 p-2 rounded-xl border ${isTurn ? 'border-luxury-gold shadow-[0_0_15px_#d4af37]' : 'border-white/10'}`}>
                <img src={p.avatar} className="w-8 h-8 md:w-12 md:h-12 rounded-full mb-1" />
                <span className="text-[10px] text-white font-bold truncate w-full text-center">{p.name}</span>
                <span className="text-[9px] text-luxury-gold">${p.balance.toLocaleString()}</span>
                {p.isDealer && <div className="absolute -top-2 -right-2 bg-white text-black text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">D</div>}
              </div>

              {/* Cards */}
              <div className="flex -space-x-4 -mt-2 z-10">
                {p.hand.length > 0 && !p.isFolded ? (
                    p.id === user.email || room.phase === 'SHOWDOWN' ? (
                        p.hand.map((c, i) => <img key={i} src={c.image} className="w-8 md:w-12 rounded shadow-md" />)
                    ) : (
                        <>
                            <div className="w-8 md:w-12 aspect-[2/3] bg-blue-900 rounded border border-white/20" />
                            <div className="w-8 md:w-12 aspect-[2/3] bg-blue-900 rounded border border-white/20" />
                        </>
                    )
                ) : null}
              </div>

              {/* Action Badge */}
              {p.bet > 0 && <div className="mt-1 text-[9px] bg-luxury-gold text-black px-2 rounded-full font-bold">${p.bet}</div>}
              {p.isFolded && <div className="mt-1 text-[9px] bg-red-900/80 text-white px-2 rounded-full">FOLD</div>}
            </div>
          );
        })}
      </div>

      {/* Control Panel (Bottom) */}
      <div className="fixed bottom-0 w-full bg-gradient-to-t from-black via-black/95 to-transparent p-4 pb-8 flex flex-col items-center z-50">
        {room.phase === 'IDLE' || room.phase === 'SHOWDOWN' ? (
            <button onClick={handleStart} className="px-12 py-3 bg-luxury-gold text-black font-cinzel font-bold text-lg rounded-full shadow-lg hover:scale-105 transition">
                START NEXT HAND
            </button>
        ) : room.activeSeat === mySeat ? (
            <div className="flex flex-col gap-3 w-full max-w-md">
                <div className="flex justify-between text-xs text-luxury-gold uppercase font-bold px-2">
                    <span>Your Turn (15s)</span>
                    <span>Raise: ${raiseAmount}</span>
                </div>
                <input type="range" min={room.minRaise + room.currentBet} max={myPlayer?.balance} step={50} value={raiseAmount} onChange={(e) => setRaiseAmount(Number(e.target.value))} className="w-full accent-luxury-gold h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" />
                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleAction('FOLD')} className="bg-red-900/50 border border-red-500/30 text-white py-3 rounded-xl font-bold hover:bg-red-900 transition">FOLD</button>
                    {room.currentBet <= (myPlayer?.bet || 0) ? (
                        <button onClick={() => handleAction('CHECK')} className="bg-blue-900/50 border border-blue-500/30 text-white py-3 rounded-xl font-bold hover:bg-blue-900 transition">CHECK</button>
                    ) : (
                        <button onClick={() => handleAction('CALL')} className="bg-luxury-gold text-black py-3 rounded-xl font-bold hover:bg-yellow-400 transition">CALL ${room.currentBet - (myPlayer?.bet || 0)}</button>
                    )}
                    <button onClick={() => handleAction('RAISE', raiseAmount)} className="border border-luxury-gold text-luxury-gold py-3 rounded-xl font-bold hover:bg-luxury-gold/10 transition">RAISE</button>
                </div>
            </div>
        ) : (
            <div className="text-gray-400 text-xs animate-pulse font-bold tracking-widest">WAITING FOR ACTION...</div>
        )}
      </div>

      <style>{`
        @keyframes timer { from { width: 100%; } to { width: 0%; } }
        @keyframes fade-out { 0% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
    </div>
  );
};

const Poker: React.FC<{ user: User, onGameEnd: (outcome: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  // [FIX] Changed ID to ensure fresh table
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  
  if (activeRoomId) return <PokerTable user={user} roomId={activeRoomId} onExit={() => setActiveRoomId(null)} onGameEnd={onGameEnd} />;
  return <PokerLobby onCreateRoom={() => setActiveRoomId("ROYAL-780")} onJoinRoom={setActiveRoomId} />;
};

export default Poker;