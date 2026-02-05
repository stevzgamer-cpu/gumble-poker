import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { io, Socket } from 'socket.io-client';
import { GameType, User, GameOutcome, ChatMessage } from './types';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Blackjack from './components/Blackjack';
import Mines from './components/Mines';
import DragonTower from './components/DragonTower';
import Keno from './components/Keno';
import Poker from './components/Poker';
import WinLossOverlay from './components/WinLossOverlay';
import DepositModal from './components/DepositModal';

// --- CONFIGURATION ---
const GOOGLE_CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com";
const API_URL = import.meta.env.VITE_API_URL || "https://gumble-backend.onrender.com";

const App: React.FC = () => {
  // --- STATE ---
  const [activeGame, setActiveGame] = useState<GameType>(GameType.BLACKJACK);
  const [user, setUser] = useState<User | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  
  // Chat State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // --- AUTH & PERSISTENCE ---
  useEffect(() => {
    const savedUser = localStorage.getItem('gumble_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  // --- SOCKET CONNECTION (Chat Logic) ---
  useEffect(() => {
    if (user) {
      const newSocket = io(API_URL);
      setSocket(newSocket);

      // Join a global "Lobby" room for chat
      newSocket.emit('join_room', { roomId: 'lobby', user });

      // Listen for incoming messages
      newSocket.on('new_message', (msg: ChatMessage) => {
        setMessages((prev) => [...prev, msg]);
      });

      // Load history if sent
      newSocket.on('chat_history', (history: ChatMessage[]) => {
        setMessages(history);
      });

      return () => { newSocket.disconnect(); };
    }
  }, [user]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (socket && newMessage.trim() && user) {
      socket.emit('send_message', { roomId: 'lobby', user: user.name, text: newMessage });
      setNewMessage("");
    }
  };

  // --- HANDLERS ---
  const handleLoginSuccess = async (credentialResponse: any) => {
    const decoded: any = jwtDecode(credentialResponse.credential);
    const newUser: User = {
      name: decoded.name,
      email: decoded.email,
      avatar: decoded.picture,
      balance: 10000.00 
    };
    
    // Restore balance if exists
    const existingData = localStorage.getItem(`gumble_balance_${newUser.email}`);
    if (existingData) newUser.balance = parseFloat(existingData);
    else localStorage.setItem(`gumble_balance_${newUser.email}`, newUser.balance.toString());

    setUser(newUser);
    localStorage.setItem('gumble_user', JSON.stringify(newUser));
  };

  const updateBalance = useCallback((amount: number) => {
    setUser(prev => {
      if (!prev) return null;
      const newBalance = prev.balance + amount;
      localStorage.setItem(`gumble_balance_${prev.email}`, newBalance.toString());
      const updatedUser = { ...prev, balance: newBalance };
      localStorage.setItem('gumble_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const handleGameEnd = (gameOutcome: GameOutcome) => {
    setOutcome(gameOutcome);
    updateBalance(gameOutcome.amount);
    setTimeout(() => setOutcome(null), 3000);
  };

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="h-screen w-screen bg-luxury-black flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-luxury-gold/20 rounded-3xl p-12 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50" />
            <h1 className="font-cinzel text-5xl gold-text-gradient font-bold tracking-tighter">GUMBLEVIP</h1>
            <p className="text-gray-500 font-montserrat uppercase tracking-[0.3em] text-[10px] text-center">Exclusive High-Stakes Luxury Casino</p>
            <div className="w-full flex flex-col gap-4 mt-4">
              <GoogleLogin onSuccess={handleLoginSuccess} onError={() => console.log('Login Failed')} theme="filled_black" shape="pill" size="large" width="100%" />
            </div>
            <p className="text-gray-600 text-[9px] uppercase tracking-widest mt-4">Safe & Secure Authentication</p>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  // --- MAIN APP UI ---
  return (
    <div className="flex h-screen bg-luxury-black text-white font-montserrat overflow-hidden">
      {/* LEFT: Sidebar */}
      <Sidebar 
        activeGame={activeGame} 
        onSelect={setActiveGame} 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenDeposit={() => setIsDepositModalOpen(true)}
      />
      
      {/* CENTER: Game Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Navbar user={user} onOpenDeposit={() => setIsDepositModalOpen(true)} />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] to-luxury-black">
          <div className="w-full h-full max-w-7xl flex items-center justify-center">
            {activeGame === GameType.BLACKJACK && <Blackjack onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.MINES && <Mines onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.DRAGON_TOWER && <DragonTower onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.KENO && <Keno onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.POKER && <Poker onGameEnd={handleGameEnd} user={user} />}
          </div>
        </div>

        {outcome && <WinLossOverlay outcome={outcome} />}
        {isDepositModalOpen && (
          <DepositModal onClose={() => setIsDepositModalOpen(false)} onDeposit={(amount) => updateBalance(amount)} />
        )}
      </main>

      {/* RIGHT: Chat Box (New Feature) */}
      <div className="w-80 border-l border-white/10 bg-[#0f0f0f] flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-white/5">
          <h3 className="font-cinzel text-luxury-gold text-lg tracking-widest text-center">VIP LOUNGE</h3>
        </div>
        
        {/* Messages Area */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className="flex flex-col animate-fade-in">
              <span className="text-[10px] text-luxury-gold/70 font-bold mb-0.5">{msg.user}</span>
              <div className="bg-white/5 p-2 rounded-r-lg rounded-bl-lg text-sm text-gray-200 break-words border border-white/5">
                {msg.text}
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <p className="text-center text-gray-600 text-xs italic mt-10">Welcome to the High Roller Lounge.<br/>Say hello!</p>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-[#0a0a0a]">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-luxury-gold/50 transition-colors"
            />
            <button 
              onClick={handleSendMessage}
              className="bg-luxury-gold text-black px-4 py-2 rounded text-xs font-bold hover:bg-yellow-500 transition-colors"
            >
              SEND
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default App;