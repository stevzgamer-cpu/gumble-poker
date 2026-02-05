
import React from 'react';
import { GameOutcome, GameStatus } from '../types';

interface WinLossOverlayProps {
  outcome: GameOutcome;
}

const WinLossOverlay: React.FC<WinLossOverlayProps> = ({ outcome }) => {
  const isWin = outcome.status === GameStatus.WON;
  const isDraw = outcome.status === GameStatus.DRAW;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-in fade-in duration-300">
      <div className={`relative px-12 py-8 rounded-2xl border-2 backdrop-blur-xl flex flex-col items-center gap-4 shadow-[0_0_50px_rgba(0,0,0,0.5)]
        ${isWin ? 'border-luxury-gold bg-luxury-gold/10 shadow-luxury-gold/30' : 
          isDraw ? 'border-blue-400 bg-blue-400/10' : 'border-red-600 bg-red-600/10'}`}>
        
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none opacity-20 rounded-2xl" />
        
        <h2 className={`font-cinzel text-5xl font-bold tracking-widest drop-shadow-lg animate-bounce
          ${isWin ? 'gold-text-gradient' : isDraw ? 'text-blue-400' : 'text-red-600'}`}>
          {outcome.status === GameStatus.WON ? 'VICTORY' : 
           outcome.status === GameStatus.DRAW ? 'DRAW' : 'DEFEAT'}
        </h2>
        
        <p className="text-white font-montserrat font-bold text-2xl tracking-widest">
          {isWin ? `+$${outcome.amount.toLocaleString()}` : 
           isDraw ? '$0.00' : `-$${Math.abs(outcome.amount).toLocaleString()}`}
        </p>
        
        <p className="text-white/60 text-sm font-medium italic">
          {outcome.message}
        </p>
      </div>
    </div>
  );
};

export default WinLossOverlay;
