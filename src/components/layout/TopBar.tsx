import React from 'react';
import { motion } from 'framer-motion';
import { fadeIn, slideUp } from '../../lib/animations/variants';
import { useAuthStore } from '../../stores/auth-store';
import { useWalletStore } from '../../stores/wallet-store';

export const TopBar: React.FC = () => {
  const { user } = useAuthStore();
  const { address, balances } = useWalletStore();
  const isConnected = !!address;

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 48px',
    background: 'rgba(10, 10, 12, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    color: '#fff',
    fontFamily: 'Inter, sans-serif',
    position: 'sticky',
    top: 0,
    zIndex: 40,
    marginLeft: '280px', // Offset for sidebar
  };

  const walletBadgeStyle: React.CSSProperties = {
    background: 'rgba(212, 175, 55, 0.08)',
    border: '1px solid rgba(212, 175, 55, 0.2)',
    color: '#F3E5AB',
    padding: '8px 20px',
    borderRadius: '24px',
    fontSize: '14px',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  };

  const formatAddress = (addr: string) => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;

  return (
    <motion.header 
      style={headerStyle}
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <div>
        <motion.h1 variants={slideUp} style={{ margin: 0, fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          Welcome back, {user?.name || 'Explorer'} ✨
        </motion.h1>
        <motion.p variants={slideUp} style={{ margin: '6px 0 0', color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>
          Here's what's happening with your funds today.
        </motion.p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        {isConnected && address ? (
          <motion.div 
            variants={slideUp} 
            style={walletBadgeStyle}
            whileHover={{ background: 'rgba(212, 175, 55, 0.15)', borderColor: 'rgba(212, 175, 55, 0.4)' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4CAF50', boxShadow: '0 0 10px #4CAF50' }} />
            {formatAddress(address)}
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ color: '#D4AF37', fontWeight: 700 }}>{balances?.ETH || 0} ETH</span>
          </motion.div>
        ) : (
          <motion.button
            variants={slideUp}
            style={{
              ...walletBadgeStyle,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff'
            }}
            whileHover={{ background: 'rgba(255,255,255,0.1)' }}
          >
            Connect Wallet
          </motion.button>
        )}
        
        <motion.div 
          variants={slideUp}
          style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          whileHover={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <span style={{ fontSize: '20px' }}>🔔</span>
          <span style={{ 
            position: 'absolute', 
            top: 10, 
            right: 12, 
            background: '#ff4444', 
            width: 8, 
            height: 8, 
            borderRadius: '50%',
            border: '2px solid #111'
          }} />
        </motion.div>

        <motion.div 
          variants={slideUp}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #F3E5AB 0%, #D4AF37 50%, #AA7C11 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '18px',
            color: '#111',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
          }}
          whileHover={{ scale: 1.05, boxShadow: '0 6px 20px rgba(212, 175, 55, 0.5)' }}
        >
          {user?.name?.charAt(0) || 'U'}
        </motion.div>
      </div>
    </motion.header>
  );
};
