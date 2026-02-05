
import React from 'react';
import { GameType } from '../types';

interface SidebarProps {
  activeGame: GameType;
  onSelect: (game: GameType) => void;
  isOpen: boolean;
  toggle: () => void;
  onOpenDeposit: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeGame, onSelect, isOpen, toggle, onOpenDeposit }) => {
  const games = [
    { type: GameType.BLACKJACK, label: 'Blackjack', icon: '♠️' },
    { type: GameType.POKER, label: 'Poker', icon: '🃏' },
    { type: GameType.MINES, label: 'Mines', icon: '💣' },
    { type: GameType.DRAGON_TOWER, label: 'Dragon Tower', icon: '🏰' },
    { type: GameType.KENO, label: 'Keno', icon: '🎰' },
  ];

  return (
    <div className={`${isOpen ? 'w-64' : 'w-20'} h-full bg-[#0a0a0a] border-r border-luxury-gold/20 transition-all duration-300 flex flex-col z-50`}>
      <div className="p-6 flex items-center justify-between">
        <h1 className={`font-cinzel text-xl gold-text-gradient font-bold ${!isOpen && 'hidden'}`}>GUMBLEVIP</h1>
        <button onClick={toggle} className="text-luxury-gold p-1 hover:bg-luxury-gold/10 rounded transition-colors">
          {isOpen ? '◀' : '▶'}
        </button>
      </div>

      <nav className="flex-1 mt-4 px-3 space-y-2">
        {games.map((game) => (
          <button
            key={game.type}
            onClick={() => onSelect(game.type)}
            className={`w-full flex items-center gap-4 p-3 rounded-lg transition-all duration-300 group
              ${activeGame === game.type 
                ? 'bg-luxury-gold/20 border border-luxury-gold/40 text-luxury-gold shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                : 'hover:bg-luxury-gold/5 text-gray-400 hover:text-white'}`}
          >
            <span className="text-2xl">{game.icon}</span>
            <span className={`font-medium whitespace-nowrap overflow-hidden transition-all ${isOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0'}`}>
              {game.label}
            </span>
          </button>
        ))}
      </nav>

      <div className="px-3 pb-8">
        <button 
          onClick={onOpenDeposit}
          className={`w-full bg-luxury-gold text-luxury-black font-bold rounded-xl py-3 transition-all hover:brightness-110 active:scale-95 flex items-center justify-center gap-2 gold-glow ${!isOpen && 'px-0'}`}
        >
          <span className="text-xl">💰</span>
          {isOpen && <span className="uppercase tracking-widest text-xs">Deposit</span>}
        </button>
      </div>

      <div className="p-4 border-t border-luxury-gold/10 text-[10px] text-gray-600 uppercase tracking-widest text-center">
        {isOpen ? 'Exclusive VIP Platform' : 'VIP'}
      </div>
    </div>
  );
};

export default Sidebar;
