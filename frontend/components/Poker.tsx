import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, GameOutcome, GameStatus, PokerPlayer, PokerRoom, User, ChatMessage } from '../types';
import PokerLobby from './PokerLobby';

declare const Hand: any;

const SEAT_POSITIONS = [
  { x: 50, y: 88 },  // 0: Bottom (You)
  { x: 15, y: 75 },  // 1: Bottom Left
  { x: 5, y: 50 },   // 2: Left
  { x: 15, y: 25 },  // 3: Top Left
  { x: 50, y: 12 },  // 4: Top
  { x: 85, y: 25 },  // 5: Top Right
  { x: 95, y: 50 },  // 6: Right
  { x: 85, y: 75 },  // 7: Bottom Right
];

// [FIX] HARDCODED BACKEND URL
const SOCKET_URL = "https://gumble-backend.onrender.com";

const PokerTable: React.FC<{ 
  user: User, 
  onGameEnd: (outcome: GameOutcome) => void, 
  roomId: string, 
  onNavigateToLobby: () => void 
}> = ({ user, onGameEnd, roomId, onNavigateToLobby }) => {
  const [room, setRoom] = useState<PokerRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'IDLE' | 'COPIED'>('IDLE');
  const [isLoading, setIsLoading] = useState(true);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // [FIX] Added connection options for stability
    const socket = io(SOCKET_URL, {
      auth: { token: user.email },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 10000, 
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log("Connected to Poker Server!");
      socket.emit('join_room', { roomId, user });
    });

    socket.on('connect_error', (err) => {
        console.error("Connection Failed:", err);
        alert("Cannot reach Game Server. Please check if the Backend is running.");
        setIsLoading(false);
        onNavigateToLobby();
    });

    socket.on('room_state', (updatedRoom: PokerRoom) => {
      setRoom(updatedRoom);
      setIsLoading(false);
      if (updatedRoom.messages) setMessages(updatedRoom.messages);
      if (updatedRoom.phase === 'SHOWDOWN') evaluateWinners(updatedRoom);
      else setWinnerMessage(null);
    });

    socket.on('new_message', (msg: ChatMessage) => setMessages(prev => [...prev, msg]));

    socket.on('error', (msg: string) => { 
        alert(msg); 
        setIsLoading(false);
        onNavigateToLobby(); 
    });

    return () => { 
        socket.emit('leave_room', { roomId }); 
        socket.disconnect(); 
    };
  }, [roomId, user.email, onNavigateToLobby]);

  useEffect(() => {
    if(showMobileChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showMobileChat]);

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
        setWinnerMessage(`${player?.name} won with ${winners[0].descr}!`);
        if (winnerId === user.email) onGameEnd({ status: GameStatus.WON, amount: currentRoom.pot, message: `Win! ${winners[0].descr}` });
      }
    } catch (e) { console.error(e); }
  };

  const handleAction = (type: 'FOLD' | 'CHECK' | 'CALL' | 'RAISE', amount = 0) => {
    socketRef.current?.emit('player_action', { roomId, action: { type, amount } });
  };

  const handleInvite = () => {
    const url = `${window.location.origin}/#/table/${roomId}`;
    navigator.clipboard.writeText(url);
    setInviteStatus('COPIED');
    setTimeout(() => setInviteStatus('IDLE'), 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    socketRef.current?.emit('send_message', { roomId, user: user.name, text: newMessage });
    setNewMessage('');
  };

  const getMySeatIndex = () => {
    if (!room || !user) return -1;
    return room.players.findIndex(p => p.id === user.email);
  };

  if (isLoading) return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 border-4 border-luxury-gold/20 border-t-luxury-gold rounded-full animate-spin" />
        <p className="font-cinzel text-luxury-gold animate-pulse tracking-widest">Connecting to Table...</p>
    </div>
  );

  const isMyTurn = room?.players[room.activeSeat]?.id === user.email && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';
  const mySeatIndex = getMySeatIndex();
  
  const visualPlayers = room?.players.map(p => {
    const shift = mySeatIndex === -1 ? 0 : mySeatIndex;
    return { ...p, visualSeat: (p.seat - shift + 8) % 8 };
  });

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2 md:p-8 animate-in fade-in">
      <div className="relative w-full max-w-7xl aspect-video bg-[#1a1a1a] rounded-[30px] lg:rounded-[150px] border-4 lg:border-8 border-luxury-gold/20 shadow-2xl flex items-center justify-center select-none">
        
        {/* Felt Background */}
        <div className="absolute inset-2 lg:inset-4 rounded-[25px] lg:rounded-[140px] bg-[#0f3a20] shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none" />
        </div>

        {/* Top Info Bar */}
        <div className="absolute top-[8%] left-[5%] flex gap-2 z-[60]">
           <button onClick={onNavigateToLobby} className="bg-red-900/50 px-3 py-1 rounded-full border border-red-500/20 text-[10px] md:text-xs text-red-200 uppercase font-bold hover:bg-red-900 shadow-lg cursor-pointer">Exit</button>
           <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
              <span className="text-[10px] md:text-xs text-luxury-gold font-bold">ID: {room?.id}</span>
              <button onClick={handleInvite} className="text-[10px] md:text-xs text-white hover:text-luxury-gold cursor-pointer">{inviteStatus === 'COPIED' ? '✓' : 'Inv'}</button>
           </div>
        </div>

        {/* Pot and Info (High Center) */}
        <div className="absolute top-[25%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10 w-full pointer-events-none">
          <span className="text-[10px] text-luxury-gold/60 font-black tracking-[0.3em] uppercase mb-1">Total Pot</span>
          <div className="bg-[#050505]/90 px-8 py-2 rounded-full border border-luxury-gold/50 text-luxury-gold font-cinzel font-bold text-xl md:text-2xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">
            ${room?.pot.toLocaleString()}
          </div>
          {winnerMessage && <div className="mt-4 bg-luxury-gold text-black px-4 py-2 rounded font-bold text-xs animate-bounce whitespace-nowrap z-50 shadow-xl pointer-events-auto">{winnerMessage}</div>}
        </div>

        {/* Community Cards */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 flex gap-2 z-10">
           {room?.communityCards.map((c, i) => (
             <div key={i} className="w-[8vw] max-w-[80px] aspect-[2/3] rounded bg-white shadow-xl animate-in zoom-in duration-300">
                <img src={c.image} className="w-full h-full object-cover" />
             </div>
           ))}
           {Array.from({ length: 5 - (room?.communityCards.length || 0) }).map((_, i) => (
             <div key={i} className="w-[8vw] max-w-[80px] aspect-[2/3] rounded border border-white/10 bg-black/20" />
           ))}
        </div>

        {/* Seats */}
        {SEAT_POSITIONS.map((pos, visualIndex) => {
          const player = visualPlayers?.find(p => p.visualSeat === visualIndex);
          const isActive = player && room?.activeSeat === player.seat && room?.phase !== 'IDLE' && room?.phase !== 'SHOWDOWN';
          const isMe = player?.id === user.email;
          
          return (
            <div key={visualIndex} className="absolute w-[16%] aspect-square flex flex-col items-center justify-center transition-all duration-500" 
                 style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
              
              {player ? (
                <div className={`relative w-full h-full flex flex-col items-center ${isActive ? 'scale-110 z-30' : 'z-20'}`}>
                  {/* Cards */}
                  <div className="absolute -top-[40%] flex -space-x-4">
                    {player.hand.length > 0 ? player.hand.map((c, idx) => (
                      <div key={idx} className={`w-[60%] aspect-[2/3] bg-white rounded-md shadow-2xl transition-transform ${player.isFolded ? 'opacity-40 grayscale' : ''}`}>
                        <img src={(isMe || room?.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full rounded-md object-cover" />
                      </div>
                    )) : <div className="w-[60%] aspect-[2/3] border border-white/10 rounded-md bg-black/20" />}
                  </div>

                  {/* Avatar */}
                  <div className={`w-[65%] aspect-square rounded-full overflow-hidden border-2 bg-black ${isActive ? 'border-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.6)]' : 'border-white/20'}`}>
                    <img src={player.avatar} className="w-full h-full object-cover" />
                  </div>
                  
                  {/* Info */}
                  <div className="mt-1 bg-black/80 backdrop-blur border border-white/10 rounded-md px-2 py-0.5 flex flex-col items-center min-w-[120%]">
                    <span className="text-[10px] md:text-xs text-white font-bold truncate max-w-[60px]">{isMe ? 'YOU' : player.name}</span>
                    <span className="text-[9px] md:text-xs text-luxury-gold font-black">${player.balance.toLocaleString()}</span>
                  </div>
                  {player.isDealer && <div className="absolute top-0 right-[5%] w-5 h-5 bg-white text-black rounded-full flex items-center justify-center font-black text-[10px] border border-black z-40 shadow-md">D</div>}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center opacity-30"><span className="text-xs">+</span></div>
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

      {/* Start Game Button */}
      {room?.phase === 'IDLE' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <button onClick={() => socketRef.current?.emit('start_game', { roomId })} disabled={room.players.length < 2} className="px-10 py-4 bg-luxury-gold text-black font-cinzel font-black text-lg md:text-2xl rounded-2xl shadow-2xl gold-glow hover:scale-105 transition-all disabled:opacity-30">
            START GAME ({room.players.length}/2+)
          </button>
        </div>
      )}

      {/* Chat System */}
      <button onClick={() => setShowMobileChat(!showMobileChat)} className="lg:hidden absolute bottom-6 right-6 w-12 h-12 bg-luxury-gold text-black rounded-full flex items-center justify-center shadow-2xl z-[150]">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
      </button>

      <div className={`absolute inset-y-0 right-0 w-80 bg-[#0f0f0f] border-l border-white/10 z-[140] transform transition-transform duration-300 shadow-2xl lg:relative lg:transform-none lg:flex flex-col ${showMobileChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
         <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20"><h3 className="font-cinzel text-luxury-gold text-sm tracking-widest">TABLE CHAT</h3><button onClick={() => setShowMobileChat(false)} className="lg:hidden text-gray-500 hover:text-white">✕</button></div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3">{messages.map((msg, i) => <div key={i} className="flex flex-col gap-1"><span className={`text-[10px] font-bold ${msg.user === 'SYSTEM' ? 'text-green-500' : 'text-luxury-gold'}`}>{msg.user}</span><p className="text-xs text-gray-300 bg-white/5 p-2 rounded break-words border border-white/5">{msg.text}</p></div>)}<div ref={chatEndRef} /></div>
         <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-black/40 flex gap-2">
            <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type..." className="flex-1 bg-black border border-white/10 rounded px-3 py-2 text-xs text-white focus:border-luxury-gold outline-none" />
            <button type="submit" className="bg-luxury-gold text-black px-3 py-2 rounded text-xs font-bold hover:bg-yellow-500">SEND</button>
         </form>
      </div>
    </div>
  );
};

const Poker: React.FC<{ user: User, onGameEnd: (o: GameOutcome) => void }> = ({ user, onGameEnd }) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const handleCreateRoom = () => setActiveRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  const handleJoinRoom = (roomId: string) => setActiveRoomId(roomId);
  return activeRoomId ? <PokerTable user={user} onGameEnd={onGameEnd} roomId={activeRoomId} onNavigateToLobby={() => setActiveRoomId(null)} /> : <PokerLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
};

export default Poker;