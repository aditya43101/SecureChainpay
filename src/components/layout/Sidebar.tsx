import React from 'react';
import { motion } from 'framer-motion';
import { slideInRight, staggerContainer } from '../../lib/animations/variants';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'wallet', label: 'My Wallet', icon: '💼' },
  { id: 'transactions', label: 'Transactions', icon: '🔄' },
  { id: 'cards', label: 'Virtual Cards', icon: '💳' },
  { id: 'investments', label: 'Staking', icon: '📈' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export const Sidebar: React.FC = () => {
  const sidebarStyle: React.CSSProperties = {
    width: '280px',
    height: '100vh',
    background: 'rgba(10, 10, 12, 0.95)',
    borderRight: '1px solid rgba(255, 255, 255, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    padding: '32px 24px',
    color: '#fff',
    fontFamily: 'Inter, sans-serif',
    position: 'fixed',
    left: 0,
    top: 0,
    zIndex: 50,
  };

  const logoStyle: React.CSSProperties = {
    fontSize: '22px',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #D4AF37 0%, #F3E5AB 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '56px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    letterSpacing: '-0.5px',
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.6)',
    transition: 'all 0.3s ease',
  };

  return (
    <motion.aside 
      style={sidebarStyle}
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
    >
      <motion.div style={logoStyle} variants={slideInRight}>
        <div style={{ 
          width: 32, 
          height: 32, 
          background: 'linear-gradient(135deg, #D4AF37 0%, #AA7C11 100%)', 
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)'
        }} />
        SecureChain Pay
      </motion.div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item, index) => (
          <motion.div
            key={item.id}
            variants={slideInRight}
            style={{
              ...itemStyle,
              ...(index === 0 ? { background: 'rgba(212, 175, 55, 0.1)', color: '#D4AF37' } : {})
            }}
            whileHover={{ 
              background: 'rgba(212, 175, 55, 0.05)', 
              color: '#D4AF37',
              x: 4
            }}
          >
            <span style={{ fontSize: '20px' }}>{item.icon}</span>
            {item.label}
          </motion.div>
        ))}
      </nav>
      
      <div style={{ marginTop: 'auto' }}>
        <motion.div
          variants={slideInRight}
          style={{
            ...itemStyle,
            color: 'rgba(255, 80, 80, 0.8)',
            marginTop: '24px'
          }}
          whileHover={{ background: 'rgba(255, 50, 50, 0.1)', x: 4 }}
        >
          <span style={{ fontSize: '20px' }}>🚪</span> Logout
        </motion.div>
      </div>
    </motion.aside>
  );
};
