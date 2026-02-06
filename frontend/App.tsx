import React, { useState, useEffect, useCallback } from 'react';
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

const App: React.FC = () => {
  const [activeGame, setActiveGame] = useState<GameType>(GameType.BLACKJACK);
  const [user, setUser] = useState<User | null>(null);
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('gumble_user');
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    const newUser: User = {
      name: name,
      email: email,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
      balance: parseFloat(localStorage.getItem(`gumble_balance_${email}`) || '10000')
    };
    setUser(newUser);
    localStorage.setItem('gumble_user', JSON.stringify(newUser));
  };

  const updateBalance = useCallback((amount: number) => {
    setUser(prev => {
      if (!prev) return null;
      const nb = prev.balance + amount;
      localStorage.setItem(`gumble_balance_${prev.email}`, nb.toString());
      const up = { ...prev, balance: nb };
      localStorage.setItem('gumble_user', JSON.stringify(up));
      return up;
    });
  }, []);

  const handleGameEnd = (go: GameOutcome) => {
    setOutcome(go);
    updateBalance(go.amount);
    setTimeout(() => setOutcome(null), 3000);
  };

  if (!user) {
    return (
      <div className="h-screen w-screen bg-luxury-black flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0a0a0a] border border-luxury-gold/20 rounded-3xl p-10 flex flex-col items-center gap-8 shadow-2xl relative">
          <h1 className="font-cinzel text-5xl gold-text-gradient font-bold tracking-tighter">GUMBLEVIP</h1>
          <form onSubmit={handleManualLogin} className="w-full flex flex-col gap-4">
            <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black border border-white/10 text-white px-6 py-4 rounded-2xl focus:border-luxury-gold transition-all" required />
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-white/10 text-white px-6 py-4 rounded-2xl focus:border-luxury-gold transition-all" required />
            <button type="submit" className="w-full bg-luxury-gold text-luxury-black font-cinzel font-bold py-4 rounded-2xl uppercase tracking-widest hover:scale-105 transition-all gold-glow">Enter Lounge</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-luxury-black text-white font-montserrat overflow-hidden relative">
      <Sidebar 
        activeGame={activeGame} 
        onSelect={(g) => { setActiveGame(g); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
        isOpen={isSidebarOpen} 
        toggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenDeposit={() => setIsDepositModalOpen(true)}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <Navbar user={user} onOpenDeposit={() => setIsDepositModalOpen(true)} />
        <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_center,_#1a1a1a,_#050505)] flex items-center justify-center p-2">
            {activeGame === GameType.BLACKJACK && <Blackjack onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.MINES && <Mines onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.DRAGON_TOWER && <DragonTower onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.KENO && <Keno onGameEnd={handleGameEnd} balance={user.balance} />}
            {activeGame === GameType.POKER && <Poker onGameEnd={handleGameEnd} user={user} />}
        </div>
        {outcome && <WinLossOverlay outcome={outcome} />}
        {isDepositModalOpen && <DepositModal onClose={() => setIsDepositModalOpen(false)} onDeposit={updateBalance} />}
      </main>
    </div>
  );
};

export default App;