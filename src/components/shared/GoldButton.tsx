import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GoldButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  variant?: 'solid' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export const GoldButton: React.FC<GoldButtonProps> = ({ 
  children, 
  variant = 'solid', 
  fullWidth = false,
  ...props 
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '14px 28px',
      borderRadius: '12px',
      fontWeight: 600,
      fontSize: '16px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s ease',
      border: 'none',
      outline: 'none',
      fontFamily: 'Inter, sans-serif',
      width: fullWidth ? '100%' : 'auto',
      position: 'relative',
      overflow: 'hidden',
    };

    if (variant === 'solid') {
      return {
        ...base,
        background: 'linear-gradient(135deg, #F3E5AB 0%, #D4AF37 50%, #AA7C11 100%)',
        color: '#111111',
        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.25)',
      };
    }
    
    if (variant === 'outline') {
      return {
        ...base,
        background: 'transparent',
        border: '1px solid #D4AF37',
        color: '#D4AF37',
      };
    }
    
    return {
      ...base,
      background: 'transparent',
      color: '#D4AF37',
    };
  };

  return (
    <motion.button
      style={getStyles()}
      whileHover={{ 
        scale: 1.02, 
        boxShadow: variant === 'solid' ? '0 8px 25px rgba(212, 175, 55, 0.4)' : 'none'
      }}
      whileTap={{ scale: 0.97 }}
      {...props}
    >
      {children}
    </motion.button>
  );
};
