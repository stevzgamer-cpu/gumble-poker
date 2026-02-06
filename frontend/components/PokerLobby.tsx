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
      <div className="mb-12 text-center animate-in fade-in slide-in-from-top-10 duration-1000">
        <h1 className="font-cinzel text-5xl md:text-7xl text-luxury-gold font-bold tracking-tighter drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">
          GUMBLE<span className="text-white">VIP</span>
        </h1>
        <p className="text-luxury-gold/60 text-[10px] md:text-xs uppercase tracking-[0.5em] mt-2">
          High Stakes Texas Hold'em
        </p>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-6 px-4">
        
        {/* Create Room Card */}
        <div className="group relative bg-white/5 border border-luxury-gold/20 p-8 rounded-[32px] flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:bg-white/10 hover:border-luxury-gold/50 cursor-pointer" onClick={() => onCreateRoom(false)}>
          <div className="w-20 h-20 bg-luxury-gold/10 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-500 border border-luxury-gold/20">
            <span className="text-4xl">♠️</span>
          </div>
          <div className="text-center">
            <h2 className="font-cinzel text-2xl text-white font-bold mb-2">Create Table</h2>
            <p className="text-gray-400 text-xs">Host a new game. You control the dealer button.</p>
          </div>
        </div>

        {/* Join Room Card */}
        <div className="group relative bg-white/5 border border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:bg-white/10 hover:border-white/30">
           <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-2">
            <span className="text-4xl">🚪</span>
          </div>
          <div className="text-center w-full">
            <h2 className="font-cinzel text-2xl text-white font-bold mb-4">Join Table</h2>
            <div className="flex gap-2">
                <input 
                type="text" 
                placeholder="ROOM ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value.toUpperCase())}
                className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center text-white font-mono tracking-widest focus:outline-none focus:border-luxury-gold"
                />
                <button 
                onClick={() => joinId && onJoinRoom(joinId)}
                disabled={!joinId}
                className="bg-luxury-gold text-black font-bold px-6 rounded-xl hover:scale-105 transition-transform disabled:opacity-50"
                >
                GO
                </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PokerLobby;