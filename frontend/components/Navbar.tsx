
import React from 'react';
import { User } from '../types';

interface NavbarProps {
  user: User;
  onOpenDeposit: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, onOpenDeposit }) => {
  return (
    <header className="h-16 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-luxury-gold/10 flex items-center justify-between px-8 z-40 sticky top-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-luxury-black px-4 py-1.5 rounded-full border border-luxury-gold/30 shadow-inner">
          <span className="text-luxury-gold font-bold">$</span>
          <span className="text-luxury-gold font-montserrat font-bold text-lg tracking-wider">
            {user.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button 
          onClick={onOpenDeposit}
          className="bg-luxury-gold text-luxury-black px-6 py-1.5 rounded-full font-bold text-sm hover:brightness-110 transition-all shadow-lg active:scale-95 uppercase tracking-tighter"
        >
          Deposit
        </button>
      </div>

      <div className="flex items-center gap-3 group cursor-pointer" onClick={() => {
        if(confirm("Logout of GUMBLEVIP?")) {
           localStorage.removeItem('gumble_user');
           window.location.reload();
        }
      }}>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-white group-hover:text-luxury-gold transition-colors">{user.name}</p>
          <p className="text-[10px] text-luxury-gold/60 uppercase tracking-widest font-bold">Gold Member</p>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-luxury-gold p-0.5 overflow-hidden transition-transform group-hover:scale-105">
          <img src={user.avatar} alt="Profile" className="w-full h-full object-cover rounded-full" />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
