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

const SOCKET_URL = "https://gumble-backend.onrender.com";

interface PokerProps {
  onGameEnd: (outcome: GameOutcome) => void;
  user: User;
}

const PokerTable: React.FC<{ user: User, onGameEnd: (outcome: GameOutcome) => void, roomId: string, onNavigateToLobby: () => void }> = ({ user, onGameEnd, roomId, onNavigateToLobby }) => {
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
    const socket = io(SOCKET_URL, {
      auth: { token: user.email },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join_room', { roomId, user }));
    socket.on('room_state', (updatedRoom: PokerRoom) => {
      setRoom(updatedRoom);
      setIsLoading(false);
      if (updatedRoom.messages) setMessages(updatedRoom.messages);
      if (updatedRoom.phase === 'SHOWDOWN') evaluateWinners(updatedRoom);
      else setWinnerMessage(null);
    });
    socket.on('new_message', (msg: ChatMessage) => setMessages(prev => [...prev, msg]));
    socket.on('error', (msg: string) => { alert(msg); onNavigateToLobby(); });
    return () => { socket.disconnect(); };
  }, [roomId, user.email, onNavigateToLobby]);

  useEffect(() => {
    if(showMobileChat) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showMobileChat]);

  const evaluateWinners = (currentRoom: PokerRoom) => {
    try {
      if (typeof Hand === 'undefined') return;
      const activePlayers = currentRoom.players.filter(p => !p.isFolded);
      const formatCard = (c: Card) => (c.value === '10' ? '10' : c.value[0]) + c.suit[0].toLowerCase();
      const community = currentRoom.communityCards.map(formatCard);
      const solvedHands = activePlayers.map(p => {
        const fullHand = [...p.hand.map(formatCard), ...community];
        return Hand.solve(fullHand, p.id);
      });
      const winners = Hand.winners(solvedHands);
      if (winners.length > 0) {
        const winningPlayer = activePlayers.find(p => p.id === winners[0].name);
        setWinnerMessage(`${winningPlayer?.name} won with ${winners[0].descr}!`);
        if (winners[0].name === user.email) onGameEnd({ status: GameStatus.WON, amount: currentRoom.pot, message: `Hand of the Dragon! ${winners[0].descr}` });
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

  const getMySeatIndex = () => {
    if (!room || !user) return -1;
    return room.players.findIndex(p => p.id === user.email);
  };

  if (isLoading) return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center gap-6">
      <div className="w-16 h-16 border-4 border-luxury-gold/20 border-t-luxury-gold rounded-full animate-spin" />
      <p className="text-luxury-gold font-cinzel tracking-widest animate-pulse">ENTERING VIP LOUNGE...</p>
    </div>
  );

  const isMyTurn = room?.players[room.activeSeat]?.id === user.email && room.phase !== 'IDLE' && room.phase !== 'SHOWDOWN';
  const mySeatIndex = getMySeatIndex();
  const visualPlayers = room?.players.map(p => {
    const shift = mySeatIndex === -1 ? 0 : mySeatIndex;
    return { ...p, visualSeat: (p.seat - shift + 8) % 8 };
  });

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col lg:flex-row overflow-hidden">
      <div className="relative flex-1 flex items-center justify-center p-2 lg:p-8 overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] to-black">
        <div className="relative w-full max-w-6xl aspect-video bg-[#1a1a1a] rounded-[30px] lg:rounded-[100px] border-4 lg:border-8 border-luxury-gold/20 shadow-2xl flex items-center justify-center select-none">
          <div className="absolute inset-2 lg:inset-4 rounded-[25px] lg:rounded-[90px] bg-[#0f3a20] shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/felt.png')] opacity-30 pointer-events-none" />
          </div>
          <div className="absolute top-[8%] left-[5%] flex gap-2 z-[60]">
             <button onClick={onNavigateToLobby} className="bg-red-900/50 px-3 py-1 rounded-full border border-red-500/20 text-[10px] md:text-xs text-red-200 uppercase font-bold hover:bg-red-900 shadow-lg cursor-pointer">Exit Table</button>
             <div className="bg-black/40 px-3 py-1 rounded-full border border-white/10 flex items-center gap-2">
                <span className="text-[10px] md:text-xs text-luxury-gold font-bold">ID: {room?.id}</span>
                <button onClick={handleInvite} className="text-[10px] md:text-xs text-white hover:text-luxury-gold cursor-pointer">{inviteStatus === 'COPIED' ? '✓' : 'Inv'}</button>
             </div>
          </div>
          <div className="absolute top-[25%] left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
              <span className="text-[10px] text-luxury-gold/60 font-black tracking-[0.3em] uppercase mb-1">Total Pot</span>
              <div className="bg-[#050505]/90 px-8 py-2 rounded-full border border-luxury-gold/50 text-luxury-gold font-cinzel font-bold text-2xl shadow-[0_0_30px_rgba(212,175,55,0.2)]">${room?.pot.toLocaleString()}</div>
              {winnerMessage && <div className="absolute top-16 bg-luxury-gold text-black px-4 py-1 rounded font-bold text-xs animate-bounce whitespace-nowrap z-50 shadow-xl">{winnerMessage}</div>}
          </div>
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 flex gap-2 z-10">
             {room?.communityCards.map((card, i) => (
               <div key={i} className="w-[8%] aspect-[2/3] max-w-[50px] rounded bg-white shadow-xl"><img src={card.image} className="w-full h-full object-cover rounded" /></div>
             ))}
             {Array.from({ length: 5 - (room?.communityCards.length || 0) }).map((_, i) => <div key={i} className="w-[8%] aspect-[2/3] max-w-[50px] rounded border border-white/10 bg-black/20" />)}
          </div>
          {SEAT_POSITIONS.map((pos, visualIndex) => {
              const player = visualPlayers?.find(p => p.visualSeat === visualIndex);
              const isActive = player && room?.activeSeat === player.seat && room?.phase !== 'IDLE' && room?.phase !== 'SHOWDOWN';
              const isMe = player?.id === user.email;
              return (
                  <div key={visualIndex} className="absolute w-[14%] aspect-square flex flex-col items-center justify-center transition-all duration-500" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}>
                      {player ? (
                          <div className={`relative w-full h-full flex flex-col items-center ${isActive ? 'scale-110 z-30' : 'z-20'}`}>
                              <div className="absolute -top-[45%] flex -space-x-4">
                                  {player.hand.length > 0 ? player.hand.map((c, idx) => (
                                      <div key={idx} className={`w-[50%] aspect-[2/3] bg-white rounded-md shadow-2xl transition-transform ${player.isFolded ? 'opacity-40 grayscale' : ''}`}><img src={(isMe || room?.phase === 'SHOWDOWN') ? c.image : 'https://deckofcardsapi.com/static/img/back.png'} className="w-full h-full rounded-md object-cover" /></div>
                                  )) : <div className="w-[50%] aspect-[2/3] border border-white/10 rounded-md bg-black/20" />}
                              </div>
                              <div className={`w-[60%] aspect-square rounded-full overflow-hidden border-2 bg-black ${isActive ? 'border-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.6)]' : 'border-white/20'}`}><img src={player.avatar} className="w-full h-full object-cover" /></div>
                              <div className="mt-1 bg-black/80 backdrop-blur border border-white/10 rounded-md px-2 py-0.5 flex flex-col items-center min-w-[120%]">
                                  <span className="text-[10px] text-white font-bold truncate max-w-[60px]">{isMe ? 'YOU' : player.name}</span>
                                  <span className="text-[9px] text-luxury-gold">${player.balance.toLocaleString()}</span>
                              </div>
                              {player.isDealer && <div className="absolute top-0 right-[10%] w-4 h-4 bg-white text-black rounded-full flex items-center justify-center font-black text-[10px] border border-black z-40">D</div>}
                          </div>
                      ) : <div className="w-8 h-8 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center opacity-30"><span className="text-xs">+</span></div>}
                  </div>
              );
          })}
          {isMyTurn && (
             <div className="absolute bottom-[5%] left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur px-6 py-3 rounded-2xl border border-luxury-gold/30 flex gap-4 z-50 shadow-2xl">
                 <button onClick={() => handleAction('FOLD')} className="px-4 py-2 bg-red-900/30 border border-red-500/50 text-red-200 rounded text-xs font-bold uppercase">Fold</button>
                 <button onClick={() => handleAction('CHECK')} className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded text-xs font-bold uppercase">Check</button>
                 <button onClick={() => handleAction('CALL')} className="px-6 py-2 bg-luxury-gold text-black rounded text-xs font-black uppercase shadow-lg hover:brightness-110">Call</button>
             </div>
          )}
          {room?.phase === 'IDLE' && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                <button onClick={() => socketRef.current?.emit('start_game', { roomId })} disabled={room.players.length < 2} className="px-8 py-3 bg-luxury-gold text-black font-cinzel font-black text-xl rounded shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 transition-all disabled:opacity-50 disabled:grayscale cursor-pointer">DEAL CARDS</button>
             </div>
          )}
        </div>
      </div>
      <button onClick={() => setShowMobileChat(!showMobileChat)} className="lg:hidden absolute bottom-6 right-6 w-12 h-12 bg-luxury-gold text-black rounded-full flex items-center justify-center shadow-2xl z-[150]"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg></button>
      <div className={`absolute inset-y-0 right-0 w-80 bg-[#0f0f0f] border-l border-white/10 z-[140] transform transition-transform duration-300 shadow-2xl lg:relative lg:transform-none lg:flex flex-col ${showMobileChat ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
         <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20"><h3 className="font-cinzel text-luxury-gold text-sm tracking-widest">TABLE CHAT</h3><button onClick={() => setShowMobileChat(false)} className="lg:hidden text-gray-500 hover:text-white">✕</button></div>
         <div className="flex-1 overflow-y-auto p-4 space-y-3">{messages.map((msg, i) => <div key={i} className="flex flex-col gap-1"><span className={`text-[10px] font-bold ${msg.user === 'SYSTEM' ? 'text-green-500' : 'text-luxury-gold'}`}>{msg.user}</span><p className="text-xs text-gray-300 bg-white/5 p-2 rounded break-words border border-white/5">{msg.text}</p></div>)}<div ref={chatEndRef} /></div>
         <form onSubmit={(e) => { e.preventDefault(); if(newMessage.trim()) { socketRef.current?.emit('send_message', { roomId, user: user.name, text: newMessage }); setNewMessage(''); } }} className="p-4 border-t border-white/10 bg-black/40 flex gap-2"><input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type..." className="flex-1 bg-black border border-white/10 rounded px-3 py-2 text-xs text-white focus:border-luxury-gold outline-none" /><button type="submit" className="bg-luxury-gold text-black px-3 py-2 rounded text-xs font-bold hover:bg-yellow-500">SEND</button></form>
      </div>
    </div>
  );
};

const Poker: React.FC<PokerProps> = ({ onGameEnd, user }) => {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const handleCreateRoom = () => setActiveRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  const handleJoinRoom = (roomId: string) => setActiveRoomId(roomId);
  return activeRoomId ? <PokerTable user={user} onGameEnd={onGameEnd} roomId={activeRoomId} onNavigateToLobby={() => setActiveRoomId(null)} /> : <PokerLobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
};

export default Poker;