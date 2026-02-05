
import React, { useState } from 'react';

interface DepositModalProps {
  onClose: () => void;
  onDeposit: (amount: number) => void;
}

const DepositModal: React.FC<DepositModalProps> = ({ onClose, onDeposit }) => {
  const [amount, setAmount] = useState<string>('');
  const [status, setStatus] = useState<'IDLE' | 'PENDING' | 'SUCCESS'>('IDLE');

  const cryptoAddresses = [
    { type: 'BTC', address: 'bc1qluxurygumblevip777vipaddressdemo', icon: '₿' },
    { type: 'USDT (ERC20)', address: '0xVIPGUMBLE777ADDRESSFORDEPOSITONLY', icon: '💵' },
  ];

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    alert('Address copied to clipboard!');
  };

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    setStatus('PENDING');
    // Simulate backend verification
    setTimeout(() => {
      onDeposit(numAmount);
      setStatus('SUCCESS');
      setTimeout(() => {
        onClose();
      }, 2000);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="max-w-md w-full bg-[#0a0a0a] border border-luxury-gold/30 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">✕</button>
        
        <h2 className="font-cinzel text-3xl gold-text-gradient font-bold text-center">CRYPTO DEPOSIT</h2>
        
        <div className="flex flex-col gap-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">1. Choose Currency & Copy Address</p>
          <div className="space-y-3">
            {cryptoAddresses.map((crypto) => (
              <div key={crypto.type} className="bg-black/40 border border-white/5 p-4 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{crypto.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{crypto.type}</span>
                    <span className="text-[10px] text-gray-500 truncate max-w-[180px]">{crypto.address}</span>
                  </div>
                </div>
                <button 
                  onClick={() => handleCopy(crypto.address)}
                  className="px-3 py-1 bg-luxury-gold/10 text-luxury-gold text-[10px] font-bold uppercase rounded border border-luxury-gold/30 hover:bg-luxury-gold/20 transition-all"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-white/5 pt-6">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">2. Confirm Sent Amount</p>
          <div className="relative">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter USD equivalent"
              className="w-full bg-black border border-white/10 text-luxury-gold font-bold px-4 py-4 rounded-xl focus:outline-none focus:border-luxury-gold transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={status !== 'IDLE' || !amount}
            className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all gold-glow
              ${status === 'SUCCESS' ? 'bg-green-600 text-white' : 'bg-luxury-gold text-luxury-black hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale'}`}
          >
            {status === 'IDLE' && 'Confirm Deposit'}
            {status === 'PENDING' && 'Verifying Transaction...'}
            {status === 'SUCCESS' && 'Payment Confirmed!'}
          </button>
          <p className="text-[8px] text-gray-600 text-center italic">Funds are typically credited after 1 blockchain confirmation.</p>
        </div>
      </div>
    </div>
  );
};

export default DepositModal;
