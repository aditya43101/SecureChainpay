'use client';

import React from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  message?: string;
  subMessage?: string;
}

export default function SplashScreen({
  message = 'INITIALIZING SECURE LEDGER...',
  subMessage = 'Non-Custodial Cryptographic Settlement',
}: SplashScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070D] text-white select-none overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] md:w-[500px] md:h-[500px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] bg-yellow-400/15 rounded-full blur-[70px] pointer-events-none animate-pulse" />

      <div className="relative flex flex-col items-center z-10 px-6 max-w-sm text-center">
        {/* Animated Emblem Container */}
        <div className="relative flex items-center justify-center w-28 h-28 md:w-32 md:h-32 mb-8">
          {/* Outer Rotating Cyber Ring */}
          <div className="absolute inset-0 rounded-full border border-amber-500/20 border-t-amber-400/80 border-r-yellow-300/60 animate-spin [animation-duration:3s]" />
          
          {/* Inner Counter-Rotating Dashed Ring */}
          <div className="absolute inset-2 rounded-full border border-dashed border-amber-400/30 animate-spin [animation-duration:8s] [animation-direction:reverse]" />
          
          {/* Pulsing Core Glow */}
          <div className="absolute inset-4 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-300/10 blur-md animate-pulse" />

          {/* Golden Shield Logo */}
          <div className="relative w-16 h-16 md:w-20 md:h-20 drop-shadow-[0_0_24px_rgba(234,179,8,0.55)] transition-transform duration-700 ease-out hover:scale-105">
            <Image
              src="/logo.svg"
              alt="SecureChain Pay Logo"
              width={80}
              height={80}
              priority
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Brand Typography */}
        <div className="space-y-1 mb-6">
          <div className="flex items-center justify-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h1 className="text-xl md:text-2xl font-extrabold tracking-wider bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 bg-clip-text text-transparent">
              SECURECHAIN PAY
            </h1>
          </div>
          <p className="text-[11px] md:text-xs tracking-widest text-amber-200/60 uppercase font-medium">
            {subMessage}
          </p>
        </div>

        {/* Glowing Progress Track */}
        <div className="w-48 md:w-56 h-1.5 bg-neutral-900/90 rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-inner mb-3">
          <div className="h-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400 rounded-full animate-[progress_1.8s_ease-in-out_infinite] shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
        </div>

        {/* Status Message */}
        <p className="text-[10px] md:text-[11px] font-mono tracking-wider text-neutral-400 flex items-center justify-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
          {message}
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            width: 5%;
            transform: translateX(-100%);
          }
          50% {
            width: 70%;
            transform: translateX(40%);
          }
          100% {
            width: 100%;
            transform: translateX(110%);
          }
        }
      `}</style>
    </div>
  );
}
