import React, { useState } from 'react';

interface PokerLobbyProps {
  onCreateRoom: (isPrivate: boolean) => void;
  onJoinRoom: (roomId: string) => void;
}

const PokerLobby: React.FC<PokerLobbyProps> = ({ onCreateRoom, onJoinRoom }) => {
  const [joinId, setJoinId] = useState('');

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#0a0a0a] to-black">
      
      {/* Brand Header */}
      <div className="mb-12 text-center">
        <h1 className="font-cinzel text-5xl md:text-7xl text-luxury-gold font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">
          GUMBLE<span className="text-white">VIP</span>
        </h1>
        <p className="text-luxury-gold/60 text-[10px] md:text-xs uppercase tracking-[0.5em] mt-2">
          High Stakes Texas Hold'em
        </p>
      </div>

      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 px-4">
        
        {/* Create Room Card */}
        <div className="group relative bg-gradient-to-br from-white/5 to-transparent border border-luxury-gold/20 p-8 rounded-[32px] flex flex-col items-center justify-center gap-6 transition-all duration-500 hover:border-luxury-gold/60 hover:shadow-[0_0_40px_rgba(212,175,55,0.1)] hover:-translate-y-2">
          <div className="absolute inset-0 bg-luxury-gold/5 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="w-20 h-20 bg-luxury-gold/10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-500 border border-luxury-gold/20">
            <span className="text-4xl">♠️</span>
          </div>
          
          <div className="text-center z-10">
            <h2 className="font-cinzel text-2xl text-white font-bold mb-2">Create Table</h2>
            <p className="text-gray-400 text-xs leading-relaxed max-w-[200px]">
              Host your own high-stakes game. You control the dealer button.
            </p>
          </div>

          <button 
            onClick={() => onCreateRoom(false)}
            className="w-full py-4 bg-luxury-gold text-luxury-black font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white hover:scale-105 transition-all shadow-lg z-10"
          >
            Start New Game
          </button>
        </div>

        {/* Join Room Card */}
        <div className="group relative bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center gap-6 transition-all duration-500 hover:border-white/30 hover:shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:-translate-y-2">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-500 border border-white/10">
            <span className="text-4xl">🚪</span>
          </div>
          
          <div className="text-center z-10">
            <h2 className="font-cinzel text-2xl text-white font-bold mb-2">Join Table</h2>
            <p className="text-gray-400 text-xs leading-relaxed max-w-[200px]">
              Enter a Room ID to take an open seat at an existing table.
            </p>
          </div>
          
          <div className="w-full flex flex-col gap-3 z-10">
            <input 
              type="text" 
              placeholder="ENTER ROOM ID"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value.toUpperCase())}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-center text-white font-mono text-lg tracking-widest focus:outline-none focus:border-luxury-gold transition-colors placeholder:text-gray-700"
            />
            <button 
              onClick={() => joinId && onJoinRoom(joinId)}
              disabled={!joinId}
              className="w-full py-4 bg-white/10 text-white font-black uppercase tracking-widest text-xs rounded-xl hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Sit Down
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PokerLobby;