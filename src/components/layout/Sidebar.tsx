'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { slideInRight, staggerContainer } from '../../lib/animations/variants';
import { useWalletStore } from '@/stores/wallet-store';

import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

const navItems = [
  { id: 'dashboard', label: 'Overview', icon: '📊', path: '/dashboard' },
  { id: 'wallet', label: 'My Wallet', icon: '💼', path: '/wallet' },
  { id: 'explorer', label: 'Block Explorer', icon: '🔗', path: '/explorer' },
  { id: 'transactions', label: 'Transactions', icon: '🔄', path: '/transactions' },
  { id: 'trade', label: 'Trade Crypto', icon: '💱', path: '/trade' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/settings' },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const transactions = useWalletStore((state) => state.transactions);
  const blockCount = transactions.length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

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
    background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
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
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
          borderRadius: '10px',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
        }} />
        SecureChain Pay
      </motion.div>
      
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/dashboard');
          return (
            <Link href={item.path} key={item.id} style={{ textDecoration: 'none' }}>
              <motion.div
                variants={slideInRight}
                style={{
                  ...itemStyle,
                  ...(isActive ? { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' } : {})
                }}
                whileHover={{ 
                  background: 'rgba(16, 185, 129, 0.05)', 
                  color: '#10b981',
                  x: 4
                }}
                className="relative"
              >
                <span style={{ fontSize: '20px' }}>{item.icon}</span>
                {item.label}
                {item.id === 'explorer' && blockCount > 0 && (
                  <span className="absolute right-4 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                    {blockCount} Blocks
                  </span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>
      
      <div style={{ marginTop: 'auto' }}>
        <motion.div
          onClick={handleLogout}
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
