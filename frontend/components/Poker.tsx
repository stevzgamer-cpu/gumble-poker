import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Card, GameOutcome, GameStatus, PokerPlayer, PokerRoom, User, ChatMessage } from '../types';
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

// Use environment variable with fallback for robust connectivity
// [FIX] Hardcode the Backend URL to ensure it connects on Render
const SOCKET_URL = "https://gumble-backend.onrender.com";
interface PokerProps {
  onGameEnd: (outcome: GameOutcome) => void;
  user: User;
}

const PokerTable: React.FC<{ user: User, onGameEnd: (outcome: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<PokerRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'IDLE' | 'COPIED'>('IDLE');
  const [isLoading, setIsLoading] = useState(true);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(true);
  
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Establishing socket connection without transport restrictions for better compatibility
    const socket = io(SOCKET_URL, {
      auth: { token: user.email }, // Using email as token for this demo
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('GUMBLEVIP: Poker Connection Established');
      socket.emit('join_room', { roomId, user });
    });

    socket.on('room_state', (updatedRoom: PokerRoom) => {
      setRoom(updatedRoom);
      setIsLoading(false);
      if (updatedRoom.messages) setMessages(updatedRoom.messages);
      
      if (updatedRoom.phase === 'SHOWDOWN') {
        evaluateWinners(updatedRoom);
      } else {
        setWinnerMessage(null);
      }
    });

    socket.on('chat_history', (history: ChatMessage[]) => {
      setMessages(history);
    });

    socket.on('new_message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('error', (msg: string) => {
      console.error('Poker Socket Error:', msg);
      alert(msg);
      setIsLoading(false);
      navigate('/poker');
    });

    socket.on('connect_error', (err) => {
      console.error('Poker Connection Error:', err.message);
      // We don't alert here immediately as Socket.IO will retry
    });

    return () => {
      socket.emit('leave_room', { roomId });
      socket.disconnect();
    };
  }, [roomId, user, navigate]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const evaluateWinners = (currentRoom: PokerRoom) => {
    try {
      if (typeof Hand === 'undefined') return;

      const activePlayers = currentRoom.players.filter(p => !p.isFolded);
      
      // Pokersolver expects '10' for tens, and first char for others, plus suit char
      const formatCard = (c: Card) => {
        const val = c.value === '10' ? '10' : c.value[0];
        const suit = c.suit[0].toLowerCase();
        return val + suit;
      };

      const community = currentRoom.communityCards.map(formatCard);
      
      const solvedHands = activePlayers.map(p => {
        const fullHand = [...p.hand.map(formatCard), ...community];
        return Hand.solve(fullHand, p.id);
      });

      const winners = Hand.winners(solvedHands);
      if (winners.length > 0) {
        const winningPlayerId = winners[0].name;
        const winningPlayer = activePlayers.find(p => p.id === winningPlayerId);
        setWinnerMessage(`${winningPlayer?.name} won with ${winners[0].descr}!`);
        
        if (winningPlayerId === user.email) {
            onGameEnd({ 
              status: GameStatus.WON, 
              amount: currentRoom.pot, 
              message: `Royal Victory! ${winners[0].descr}` 
            });
        }
      }
    } catch (e) {
      console.error("GUMBLEVIP Evaluation error:", e);
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    socketRef.current?.emit('send_message', { 
      roomId, 
      user: user.name, 
      text: newMessage 
    });
    setNewMessage('');
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-luxury-gold/20 border-t-luxury-gold rounded-full animate-spin" />
        <p className="font-cinzel text-luxury-gold tracking-widest text-sm animate-pulse uppercase">Syncing with High-Stakes Table...</p>
      </div>
    );
  }

  const isMyTurn = room?.players[room.activeSeat]?.id === user.email && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row gap-4 overflow-hidden animate-in fade-in duration-700">
      
      {/* Table Interface */}
      <div className="relative flex-1 flex flex-col items-center justify-center">
        <div className="relative w-full aspect-[16/9] bg-[#0a3d1d] rounded-[200px] border-[12px] border-luxury-gold/30 shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_120px_rgba(0,0,0,0.9)] flex items-center justify-center overflow-hidden">
          
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-20 pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <h1 className="font-cinzel text-[12vw] text-white font-bold tracking-tighter">GUMBLEVIP</h1>
          </div>

          {/* Table Controls (Exit / Invite) */}
          <div className="absolute top-6 left-10 flex items-center gap-4 z-[60]">
              <div className="bg-[#050505]/80 backdrop-blur-md px-4 py-2 rounded-xl border border-luxury-gold/20 flex items-center gap-4 shadow-xl">
                  <span className="text-[9px] text-luxury-gold font-black uppercase tracking-widest">ID: {room?.id}</span>
                  <button 
                      onClick={handleInvite}
                      className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${inviteStatus === 'COPIED' ? 'bg-green-600 text-white' : 'bg-luxury-gold text-luxury-black hover:brightness-110'}`}
                  >
                      {inviteStatus === 'COPIED' ? 'Link Copied' : 'Invite'}
                  </button>
              </div>
              <button onClick={() => navigate('/poker')} className="p-2 bg-red-900/20 border border-red-500/30 text-red-500 rounded-xl hover:bg-red-900/40 transition-all text-[10px] font-black uppercase tracking-widest">
                  Lobby
              </button>
          </div>

          {/* Community Cards */}
          <div className="flex gap-4 z-10 transition-all duration-500 transform">
             {room?.communityCards.map((card, i) => (
               <div key={i} className="w-14 h-20 md:w-20 md:h-30 rounded-lg border-2 border-luxury-gold/20 shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
                  <img src={card.image} className="w-full h-full object-cover" alt="card" />
               </div>
             ))}
             {Array.from({ length: 5 - (room?.communityCards.length || 0) }).map((_, i) => (
               <div key={i} className="w-14 h-20 md:w-20 md:h-30 rounded-lg border-2 border-white/5 bg-black/30 backdrop-blur-sm" />
             ))}
          </div>

          {/* Pot Display */}
          <div className="absolute top-[65%] flex flex-col items-center gap-2 z-10">
              <span className="text-gray-400 text-[8px] uppercase tracking-[0.3em] font-black">Total Pot</span>
              <div className="bg-[#050505]/90 px-10 py-3 rounded-full border border-luxury-gold/40 text-luxury-gold font-cinzel font-bold text-2xl gold-glow shadow-2xl">
                  ${room?.pot.toLocaleString()}
              </div>
              {winnerMessage && (
                <div className="mt-4 bg-luxury-gold px-6 py-2 rounded-lg text-luxury-black font-black text-[10px] animate-bounce uppercase tracking-widest shadow-2xl">
                  {winnerMessage}
                </div>
              )}
          </div>

          {/* Player Seats */}
          {SEAT_POSITIONS.map((pos, i) => {
              const player = room?.players.find(p => p.seat === i);
              const isActive = room?.activeSeat === i && room?.phase !== 'IDLE' && room?.phase !== 'SHOWDOWN';
              const isMe = player?.id === user.email;
              
              return (
                  <div key={i} className="absolute flex flex-col items-center gap-2" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                      {player ? (
                          <div className={`flex flex-col items-center transition-all duration-500 ${isActive ? 'scale-110' : ''}`}>
                              <div className="flex -space-x-10 mb-2">
                                  {player.hand.length > 0 ? (
                                      player.hand.map((c, idx) => (
                                          <div key={idx} className={`w-12 h-18 rounded border border-luxury-gold/10 shadow-xl overflow-hidden transition-all duration-500 ${player.isFolded ? 'opacity-20 grayscale' : 'hover:z-50 z-20'}`}>
                                              <img src={(isMe || room?.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full object-cover" />
                                          </div>
                                      ))
                                  ) : (
                                      <div className="w-12 h-18 bg-black/20 rounded border border-dashed border-white/5" />
                                  )}
                              </div>

                              <div className={`flex flex-col items-center bg-[#050505]/95 p-3 rounded-2xl border-2 transition-all duration-300 ${isActive ? 'border-luxury-gold shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 'border-white/5 opacity-80'}`}>
                                  <div className="relative">
                                    <img src={player.avatar} className="w-10 h-10 rounded-full border border-luxury-gold/30 object-cover" alt="avatar" />
                                    {player.isDealer && (
                                      <div className="absolute -right-1 -top-1 w-4 h-4 bg-white text-black text-[8px] font-black rounded-full flex items-center justify-center border border-black">D</div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-white font-bold mt-1.5 uppercase tracking-tighter truncate max-w-[80px]">
                                    {isMe ? 'YOU' : player.name}
                                  </span>
                                  <span className="text-[9px] text-luxury-gold font-black">${player.balance.toLocaleString()}</span>
                              </div>
                          </div>
                      ) : (
                          <div className="w-24 h-16 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center opacity-10 hover:opacity-20 cursor-default transition-all">
                             <span className="text-[8px] text-white font-black uppercase tracking-widest">Wait Seat</span>
                          </div>
                      )}
                  </div>
              );
          })}
        </div>

        {/* Action HUD */}
        {isMyTurn && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-luxury-black/95 backdrop-blur-2xl p-6 rounded-[32px] border border-luxury-gold/30 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-50 animate-in slide-in-from-bottom-10">
              <div className="pr-8 border-r border-white/10 mr-4">
                 <span className="text-[9px] text-gray-500 uppercase font-black tracking-widest block mb-1">Current Call</span>
                 <span className="text-xl text-white font-black italic">$200</span>
              </div>
              <div className="flex gap-2">
                  <button onClick={() => handleAction('FOLD')} className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:bg-red-900/20 hover:border-red-500/50 transition-all uppercase text-[10px] tracking-widest">Fold</button>
                  <button onClick={() => handleAction('CHECK')} className="px-8 py-3 bg-white/5 border border-white/10 text-white font-black rounded-xl hover:border-luxury-gold/50 transition-all uppercase text-[10px] tracking-widest">Check</button>
                  <button onClick={() => handleAction('CALL')} className="px-14 py-3 bg-luxury-gold text-luxury-black font-black rounded-xl hover:brightness-110 active:scale-95 transition-all uppercase text-[10px] tracking-widest shadow-xl gold-glow">Call (200)</button>
              </div>
          </div>
        )}

        {/* Start Game Overlay */}
        {room?.phase === 'IDLE' && (
          <div className="absolute inset-0 flex items-center justify-center z-40 bg-[#000000]/20 backdrop-blur-[1px]">
             <button onClick={handleStartGame} disabled={room.players.length < 2} className="px-14 py-5 bg-luxury-gold text-luxury-black font-cinzel font-bold text-2xl rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale gold-glow">
                DEAL THE CARDS ({room.players.length}/2+)
             </button>
          </div>
        )}
      </div>

      {/* VIP Chat Sidebar */}
      <div className={`flex flex-col w-full lg:w-96 bg-[#050505]/80 backdrop-blur-2xl border border-luxury-gold/20 rounded-3xl overflow-hidden transition-all duration-500 flex-shrink-0 ${isChatOpen ? 'h-[400px] lg:h-full' : 'h-16 lg:w-16'}`}>
        <div className="p-5 border-b border-luxury-gold/10 flex items-center justify-between bg-black/40">
          {isChatOpen && (
            <h3 className="font-cinzel text-[10px] text-luxury-gold font-black tracking-[0.2em] uppercase flex items-center gap-3">
              <span className="w-2 h-2 bg-luxury-gold rounded-full animate-pulse"></span>
              High Roller Chat
            </h3>
          )}
          <button onClick={() => setIsChatOpen(!isChatOpen)} className="text-luxury-gold/60 hover:text-luxury-gold transition-colors p-2 font-bold">
            {isChatOpen ? '−' : '+'}
          </button>
        </div>

        {isChatOpen && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-luxury-gold/20">
              {messages.map((msg, i) => {
                const isMe = msg.user === user.name;
                return (
                  <div key={i} className={`flex flex-col gap-1.5 animate-in slide-in-from-right-4 duration-300 ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 px-1">
                      {!isMe && <span className="text-[9px] text-luxury-gold font-black uppercase tracking-tighter">{msg.user}</span>}
                      <span className="text-[7px] text-gray-600 font-bold">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className={`text-[11px] leading-relaxed max-w-[90%] px-4 py-3 rounded-2xl border shadow-lg ${
                      isMe 
                        ? 'bg-luxury-gold/10 border-luxury-gold/30 text-white rounded-tr-none' 
                        : 'bg-white/5 border-white/10 text-gray-300 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </p>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-5 border-t border-luxury-gold/10 bg-black/40 flex gap-3">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Talk to the table..."
                className="flex-1 bg-luxury-black border border-white/10 rounded-2xl px-5 py-3 text-[11px] text-white focus:outline-none focus:border-luxury-gold/50 placeholder:text-gray-700 transition-all"
              />
              <button 
                type="submit" 
                disabled={!newMessage.trim()}
                className="w-12 h-12 flex items-center justify-center bg-luxury-gold text-luxury-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-30 disabled:grayscale"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
              </button>
            </form>
          </>
        )}
      </div>

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