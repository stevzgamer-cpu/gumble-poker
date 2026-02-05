
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Card, GameOutcome, GameStatus, PokerPlayer, PokerRoom, User } from '../types';
import PokerLobby from './PokerLobby';

// The 'Hand' global is provided by the pokersolver script in index.html
declare const Hand: any;

const SEAT_POSITIONS = [
  { x: 50, y: 88 },  // Bottom (You)
  { x: 22, y: 80 },  // Bottom Left
  { x: 10, y: 50 },  // Left
  { x: 22, y: 20 },  // Top Left
  { x: 50, y: 12 },  // Top
  { x: 78, y: 20 },  // Top Right
  { x: 90, y: 50 },  // Right
  { x: 78, y: 80 },  // Bottom Right
];

const SOCKET_URL = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;

interface PokerProps {
  onGameEnd: (outcome: GameOutcome) => void;
  user: User;
}

const PokerTable: React.FC<{ user: User, onGameEnd: (outcome: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<PokerRoom | null>(null);
  const [inviteStatus, setInviteStatus] = useState<'IDLE' | 'COPIED'>('IDLE');
  const [isLoading, setIsLoading] = useState(true);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('gumble_user') }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', { roomId, user });
    });

    socket.on('room_state', (updatedRoom: PokerRoom) => {
      setRoom(updatedRoom);
      setIsLoading(false);
      
      // If showdown, evaluate locally for UI feedback (Server should ultimately decide)
      if (updatedRoom.phase === 'SHOWDOWN') {
        evaluateWinners(updatedRoom);
      } else {
        setWinnerMessage(null);
      }
    });

    socket.on('player_joined', (newPlayer: PokerPlayer) => {
      setRoom(prev => {
        if (!prev) return null;
        if (prev.players.find(p => p.id === newPlayer.id)) return prev;
        return { ...prev, players: [...prev.players, newPlayer] };
      });
    });

    socket.on('player_left', (playerId: string) => {
      setRoom(prev => {
        if (!prev) return null;
        return { ...prev, players: prev.players.filter(p => p.id !== playerId) };
      });
    });

    socket.on('error', (msg: string) => {
      alert(msg);
      navigate('/');
    });

    return () => {
      socket.emit('leave_room', { roomId });
      socket.disconnect();
    };
  }, [roomId, user, navigate]);

  const evaluateWinners = (currentRoom: PokerRoom) => {
    try {
      const activePlayers = currentRoom.players.filter(p => !p.isFolded);
      const community = currentRoom.communityCards.map(c => c.value[0] + c.suit[0].toLowerCase());
      
      const hands = activePlayers.map(p => {
        const fullHand = [...p.hand.map(c => c.value[0] + c.suit[0].toLowerCase()), ...community];
        return Hand.solve(fullHand, p.id);
      });

      const winners = Hand.winners(hands);
      if (winners.length > 0) {
        const winningPlayerId = winners[0].name; // pokersolver returns name passed in solve()
        const winningPlayer = activePlayers.find(p => p.id === winningPlayerId);
        setWinnerMessage(`${winningPlayer?.name} won with ${winners[0].descr}!`);
        
        if (winningPlayerId === user.email) {
            onGameEnd({ status: GameStatus.WON, amount: currentRoom.pot, message: `You won with ${winners[0].descr}!` });
        }
      }
    } catch (e) {
      console.error("Evaluation error:", e);
    }
  };

  const handleAction = (type: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount = 0) => {
    socketRef.current?.emit('player_action', { roomId, action: { type, amount } });
  };

  const handleInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}#/table/${room.id}`;
    navigator.clipboard.writeText(url);
    setInviteStatus('COPIED');
    setTimeout(() => setInviteStatus('IDLE'), 2000);
  };

  const handleStartGame = () => {
    socketRef.current?.emit('start_game', { roomId });
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-luxury-gold/20 border-t-luxury-gold rounded-full animate-spin" />
        <p className="font-cinzel text-luxury-gold tracking-widest text-sm animate-pulse">SYNCING WITH TABLE...</p>
      </div>
    );
  }

  const myPlayer = room?.players.find(p => p.id === user.email);
  const isMyTurn = room?.players[room.activeSeat]?.id === user.email && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';

  return (
    <div className="relative w-full aspect-[16/9] max-h-[85vh] flex items-center justify-center p-4 animate-in fade-in duration-1000">
      <div className="relative w-full h-full bg-[#0a3d1d] rounded-[200px] border-[12px] border-luxury-gold/30 shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_120px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
        
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none" />
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
            <h1 className="font-cinzel text-[12vw] text-white font-bold tracking-tighter">GUMBLEVIP</h1>
        </div>

        {/* Invite & Table Info */}
        <div className="absolute top-8 left-8 flex items-center gap-4 z-[60]">
            <div className="bg-black/60 px-4 py-2 rounded-xl border border-luxury-gold/20 flex items-center gap-4">
                <span className="text-[10px] text-luxury-gold font-bold uppercase tracking-widest">Table: {room?.name}</span>
                <button 
                    onClick={handleInvite}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${inviteStatus === 'COPIED' ? 'bg-green-600 text-white' : 'bg-luxury-gold text-luxury-black hover:brightness-110'}`}
                >
                    {inviteStatus === 'COPIED' ? 'Link Copied!' : 'Invite Friend'}
                </button>
            </div>
            <button onClick={() => navigate('/')} className="p-2 bg-red-900/20 border border-red-500/30 text-red-500 rounded-xl hover:bg-red-900/40 transition-all text-xs font-bold uppercase tracking-widest">
                Exit
            </button>
        </div>

        {/* Community Cards */}
        <div className="flex gap-4 z-10 transition-all duration-500 transform">
           {room?.communityCards.map((card, i) => (
             <div key={i} className="w-16 h-24 md:w-24 md:h-36 rounded-lg border-2 border-luxury-gold/20 shadow-xl overflow-hidden animate-in slide-in-from-top-4">
                <img src={card.image} className="w-full h-full object-cover" alt="card" />
             </div>
           ))}
           {Array.from({ length: 5 - (room?.communityCards.length || 0) }).map((_, i) => (
             <div key={i} className="w-16 h-24 md:w-24 md:h-36 rounded-lg border-2 border-white/5 bg-black/10 backdrop-blur-sm shadow-inner" />
           ))}
        </div>

        {/* Pot HUD */}
        <div className="absolute top-[62%] flex flex-col items-center gap-2 z-10">
            <div className="flex flex-col items-center gap-0.5">
                <span className="text-gray-500 text-[8px] uppercase tracking-[0.3em] font-bold">Total Pot</span>
                <div className="bg-black/60 px-8 py-3 rounded-full border border-luxury-gold/30 text-luxury-gold font-cinzel font-bold text-2xl gold-glow shadow-2xl transition-all">
                    ${room?.pot.toLocaleString() || '0'}
                </div>
                {winnerMessage && (
                  <div className="mt-4 bg-luxury-gold px-6 py-2 rounded-full text-luxury-black font-bold text-xs animate-bounce uppercase tracking-widest shadow-xl">
                    {winnerMessage}
                  </div>
                )}
            </div>
        </div>

        {/* Seats */}
        {SEAT_POSITIONS.map((pos, i) => {
            const player = room?.players.find(p => p.seat === i);
            const isActive = room?.activeSeat === i && room?.phase !== 'IDLE' && room?.phase !== 'SHOWDOWN';
            const isMe = player?.id === user.email;
            
            return (
                <div key={i} className="absolute transition-all duration-700 flex flex-col items-center gap-3" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                    
                    {player ? (
                        <>
                            <div className="flex -space-x-8 mb-1 scale-90 md:scale-100">
                                {player.hand.length > 0 ? (
                                    player.hand.map((c, idx) => (
                                        <div key={idx} className={`w-12 h-16 md:w-16 md:h-24 rounded border border-white/10 shadow-lg overflow-hidden transition-all duration-500 ${player.isFolded ? 'opacity-20 grayscale scale-75' : 'hover:z-50 z-20 hover:-translate-y-2'}`}>
                                            <img src={(isMe || room?.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full object-cover" />
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex -space-x-12 opacity-30">
                                        <div className="w-12 h-16 md:w-16 md:h-24 bg-black/40 rounded border border-white/5" />
                                        <div className="w-12 h-16 md:w-16 md:h-24 bg-black/40 rounded border border-white/5" />
                                    </div>
                                )}
                            </div>

                            <div className={`flex flex-col items-center bg-[#0a0a0a]/90 backdrop-blur-md border-2 rounded-2xl p-4 w-40 shadow-2xl transition-all duration-300 ${isActive ? 'border-luxury-gold scale-110 gold-glow z-40' : 'border-white/5 opacity-80'}`}>
                                <div className="flex flex-col items-center gap-2.5 w-full">
                                    <div className="relative">
                                      <img src={player.avatar} className="w-12 h-12 rounded-full border-2 border-luxury-gold/40 object-cover shadow-lg" alt="avatar" />
                                      {player.isDealer && (
                                        <div className="absolute -right-1 -top-1 w-5 h-5 bg-white text-luxury-black rounded-full border border-luxury-black flex items-center justify-center text-[10px] font-bold shadow-md">D</div>
                                      )}
                                    </div>
                                    <div className="flex flex-col items-center text-center w-full min-w-0">
                                        <span className="text-[11px] text-white font-bold truncate w-full leading-none mb-1 uppercase tracking-tighter">{isMe ? 'YOU' : player.name}</span>
                                        <span className="text-[10px] text-luxury-gold font-bold tracking-wider">${player.balance.toLocaleString()}</span>
                                    </div>
                                </div>
                                {isActive && (
                                    <div className="w-full h-1 bg-gray-900 rounded-full mt-3 overflow-hidden">
                                        <div className="h-full bg-luxury-gold animate-[turnTimer_15s_linear]" />
                                    </div>
                                )}
                                {player.bet > 0 && (
                                    <div className="absolute -top-10 bg-luxury-gold/20 border border-luxury-gold/40 rounded-full px-4 py-1 text-[10px] text-luxury-gold font-bold gold-glow">
                                        Bet: ${player.bet.toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center w-36 h-20 rounded-2xl border-2 border-dashed border-white/10 bg-black/5 hover:border-luxury-gold/20 hover:bg-black/20 transition-all cursor-pointer group">
                             <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest group-hover:text-luxury-gold/60 transition-colors">Seat Available</span>
                        </div>
                    )}
                </div>
            );
        })}
      </div>

      {/* Action Controls */}
      {isMyTurn && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-[#0a0a0a]/95 backdrop-blur-2xl px-12 py-8 rounded-[40px] border border-luxury-gold/30 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 animate-in slide-in-from-bottom-20 duration-500">
            <div className="flex flex-col gap-1.5 mr-10 border-r border-white/10 pr-10">
               <span className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">To Call</span>
               <span className="text-3xl text-white font-black italic">${(room.pot * 0.1).toLocaleString()}</span>
            </div>
            
            <div className="flex gap-4">
                <button onClick={() => handleAction('FOLD')} className="h-16 px-10 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-red-600/10 hover:border-red-500/40 transition-all uppercase tracking-[0.1em] text-sm">
                    Fold
                </button>
                <button onClick={() => handleAction('CHECK')} className="h-16 px-10 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-luxury-gold/10 hover:border-luxury-gold/40 transition-all uppercase tracking-[0.1em] text-sm">
                    Check
                </button>
                <button onClick={() => handleAction('CALL')} className="h-16 px-14 bg-luxury-gold text-luxury-black font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.1em] text-sm gold-glow">
                    Call
                </button>
            </div>
        </div>
      )}

      {/* Lobby Overlay */}
      {room?.phase === 'IDLE' && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-luxury-card border border-luxury-gold/30 p-10 rounded-3xl text-center shadow-2xl animate-in zoom-in duration-300 max-w-sm">
                <div className="w-16 h-16 bg-luxury-gold/10 rounded-full flex items-center justify-center text-3xl mx-auto mb-6 border border-luxury-gold/20">🃏</div>
                <h3 className="font-cinzel text-3xl text-white font-bold mb-4">Table Ready</h3>
                <div className="bg-black/40 rounded-xl p-4 mb-8 border border-white/5">
                   <p className="text-[10px] text-luxury-gold font-bold uppercase mb-2">Players Joined</p>
                   <div className="flex justify-center -space-x-2">
                      {room.players.map((p, i) => (
                        <img key={i} src={p.avatar} className="w-8 h-8 rounded-full border border-luxury-black shadow-lg" title={p.name} />
                      ))}
                   </div>
                </div>
                <div className="flex flex-col gap-3">
                    <button onClick={handleStartGame} disabled={room.players.length < 2} className="w-full py-4 bg-luxury-gold text-luxury-black font-bold rounded-2xl uppercase tracking-widest text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all gold-glow disabled:opacity-30 disabled:grayscale">
                        Deal Cards ({room.players.length} Players)
                    </button>
                    <button onClick={handleInvite} className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl uppercase tracking-widest text-xs hover:bg-white/10 transition-all">
                        Invite More Friends
                    </button>
                </div>
            </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes turnTimer {
          from { width: 100%; background-color: #d4af37; }
          to { width: 0%; background-color: #ef4444; }
        }
      ` }} />
    </div>
  );
};

const PokerMain: React.FC<PokerProps> = ({ onGameEnd, user }) => {
  const navigate = useNavigate();

  const handleCreateRoom = (isPrivate: boolean) => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/table/${roomId}`);
  };

  const handleJoinRoom = (roomId: string) => {
    navigate(`/table/${roomId}`);
  };

  return (
    <Routes>
      <Route path="/" element={<PokerLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />} />
      <Route path="/table/:roomId" element={<PokerTable user={user} onGameEnd={onGameEnd} />} />
    </Routes>
  );
};

const Poker: React.FC<PokerProps> = (props) => {
  return (
    <HashRouter>
      <PokerMain {...props} />
    </HashRouter>
  );
};

export default Poker;
