
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { GameType, User, GameStatus, GameOutcome } from './types';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Blackjack from './components/Blackjack';
import Mines from './components/Mines';
import DragonTower from './components/DragonTower';
import Keno from './components/Keno';
import Poker from './components/Poker';
import WinLossOverlay from './components/WinLossOverlay';
import DepositModal from './components/DepositModal';

const GOOGLE_CLIENT_ID = "67123336647-b00rcsb6ni8s8unhi3qqg0bk6l2es62l.apps.googleusercontent.com";

const App: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameType>(GameType.BLACKJACK);
  const [user, setUser] = useState<User | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  // Persistence Simulation (In a real app, this would be an API call to verify the session)
  useEffect(() => {
    const savedUser = localStorage.getItem('gumble_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLoginSuccess = async (credentialResponse: any) => {
    const decoded: any = jwtDecode(credentialResponse.credential);
    
    // Simulate backend call to verify and sync with MongoDB
    const newUser: User = {
      name: decoded.name,
      email: decoded.email,
      avatar: decoded.picture,
      balance: 10000.00 // Default starting balance for new users
    };

    // Check if user exists in local storage to keep balance persistent for the demo
    const existingData = localStorage.getItem(`gumble_balance_${newUser.email}`);
    if (existingData) {
      newUser.balance = parseFloat(existingData);
    } else {
      localStorage.setItem(`gumble_balance_${newUser.email}`, newUser.balance.toString());
    }

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
    setTimeout(() => {
      setOutcome(null);
    }, 3000);
  };

  if (!user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <div className="h-screen w-screen bg-luxury-black flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0a0a0a] border border-luxury-gold/20 rounded-3xl p-12 flex flex-col items-center gap-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-luxury-gold to-transparent opacity-50" />
            <h1 className="font-cinzel text-5xl gold-text-gradient font-bold tracking-tighter">GUMBLEVIP</h1>
            <p className="text-gray-500 font-montserrat uppercase tracking-[0.3em] text-[10px] text-center">Exclusive High-Stakes Luxury Casino</p>
            
            <div className="w-full flex flex-col gap-4 mt-4">
              <GoogleLogin
                onSuccess={handleLoginSuccess}
                onError={() => console.log('Login Failed')}
                theme="filled_black"
                shape="pill"
                size="large"
                width="100%"
              />
            </div>
            
            <p className="text-gray-600 text-[9px] uppercase tracking-widest mt-4">Safe & Secure Authentication</p>
          </div>
        </div>
      </GoogleOAuthProvider>
    );
  }

  return (
    <div className="flex h-screen bg-luxury-black text-white font-montserrat overflow-hidden">
      <Sidebar 
        activeGame={activeGame} 
        onSelect={setActiveGame} 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenDeposit={() => setIsDepositModalOpen(true)}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Navbar user={user} onOpenDeposit={() => setIsDepositModalOpen(true)} />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1a1a] to-luxury-black">
          <div className="w-full max-w-7xl">
            {activeGame === GameType.BLACKJACK && <Blackjack onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.MINES && <Mines onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.DRAGON_TOWER && <DragonTower onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.KENO && <Keno onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.POKER && <Poker onGameEnd={handleGameEnd} user={user} />}
          </div>
        </div>

        {outcome && <WinLossOverlay outcome={outcome} />}
        {isDepositModalOpen && (
          <DepositModal 
            onClose={() => setIsDepositModalOpen(false)} 
            onDeposit={(amount) => updateBalance(amount)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
