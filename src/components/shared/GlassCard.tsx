import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', hoverEffect = false, ...props }) => {
  const baseStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    color: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <motion.div
      style={baseStyle}
      whileHover={hoverEffect ? { 
        y: -5, 
        boxShadow: '0 15px 40px rgba(212, 175, 55, 0.15)',
        border: '1px solid rgba(212, 175, 55, 0.3)'
      } : undefined}
      className={className}
      {...props}
    >
      {/* Subtle top glare effect for premium feel */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: '10%',
        right: '10%',
        height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
        pointerEvents: 'none'
      }} />
      {children}
    </motion.div>
  );
};
