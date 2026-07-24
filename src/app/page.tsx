'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  ShieldCheck, Zap, Globe, ChevronRight, Settings, FileText, 
  Wallet, RefreshCw, TrendingUp, CreditCard, ArrowRightLeft,
  Activity, Clock, Box, Lock, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants: any = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <div className="flex-1 bg-brand-dark flex flex-col relative overflow-hidden w-full">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-brand-gold/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-gold/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between z-50 glass-panel rounded-b-2xl relative mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-brand-gold" />
          <span className="text-xl font-bold tracking-tight text-white">
            SecureChain<span className="text-brand-gold">Pay</span>
          </span>
        </div>
        <div className="flex items-center gap-6 hidden md:flex">
          <Link href="/login?mode=login" className="text-gray-300 hover:text-white transition-colors font-medium text-sm">
            Login
          </Link>
          <Link href="/login?mode=register">
            <button className="px-4 py-2 bg-brand-gold text-brand-dark rounded-full font-bold text-sm hover:bg-yellow-400 transition-colors shadow-glow">
              Sign Up
            </button>
          </Link>
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          <button className="text-gray-300 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <Link href="/login">
            <Button className="bg-transparent border border-brand-gold/50 text-brand-gold hover:bg-brand-gold/10 shadow-glow transition-all flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Connect Wallet
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-6 z-10 w-full max-w-7xl mx-auto pb-20">
        
        {/* Header Section */}
        <motion.div 
          className="flex flex-col items-center pt-10 pb-8 text-center relative z-20"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square bg-brand-gold/10 blur-[150px] rounded-full pointer-events-none -z-10" />
          
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel mb-8 border border-brand-gold/30 shadow-[0_0_20px_rgba(255,215,0,0.15)]">
            <span className="flex h-2.5 w-2.5 rounded-full bg-brand-gold animate-pulse"></span>
            <span className="text-sm font-bold text-brand-gold tracking-widest uppercase">SecureChain Pay v2.4 Enterprise</span>
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-6xl md:text-8xl font-extrabold text-white mb-8 tracking-tight leading-tight max-w-5xl">
            The Future of <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-gold via-yellow-200 to-brand-gold">Web3 Payments</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-xl md:text-2xl text-gray-300 max-w-4xl leading-relaxed mb-6 font-light">
            SecureChain Pay is a revolutionary payment gateway designed to bridge the gap between traditional finance and decentralized infrastructure. 
            Empowering businesses globally with zero gas fees and instant settlements.
          </motion.p>
          
          <motion.p variants={itemVariants} className="text-lg text-neutral-400 max-w-3xl mb-12">
            Join thousands of merchants leveraging our Account Abstraction (ERC-4337) technology for seamless, secure transactions on the Polygon network.
          </motion.p>
          
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-4 w-full">
            <Link href="/login?mode=login" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-10 py-5 rounded-full bg-white text-black hover:bg-neutral-200 font-extrabold text-lg shadow-xl hover:scale-105 transition-transform duration-300">
                Sign In to Dashboard
              </button>
            </Link>
            <Link href="/login?mode=register" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-10 py-5 rounded-full bg-brand-gold text-brand-dark hover:bg-yellow-400 font-extrabold text-lg shadow-[0_0_30px_rgba(255,215,0,0.4)] hover:scale-105 transition-transform duration-300">
                Create an Account
              </button>
            </Link>
          </motion.div>

          {/* Stats Banner to Fill Space */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-20 border-t border-b border-brand-gold/20 py-8 glass-panel rounded-3xl">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-white mb-2">$500M+</span>
              <span className="text-sm text-brand-gold tracking-widest uppercase">Processed Volume</span>
            </div>
            <div className="flex flex-col items-center border-y md:border-y-0 md:border-x border-brand-gold/20 py-4 md:py-0">
              <span className="text-4xl font-black text-white mb-2">0</span>
              <span className="text-sm text-brand-gold tracking-widest uppercase">Gas Fees Paid</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-white mb-2">99.99%</span>
              <span className="text-sm text-brand-gold tracking-widest uppercase">API Uptime</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Advantages & Benefits Section */}
      <section className="py-24 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-brand-gold/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              Enterprise-Grade <span className="text-brand-gold">Advantages</span>
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto text-lg">
              Designed for modern businesses, SecureChain Pay offers unmatched benefits over traditional finance and legacy crypto infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Benefit 1 */}
            <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-brand-gold/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="text-brand-gold w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Zero Gas Fees</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Powered by Account Abstraction (ERC-4337), we sponsor all transaction gas fees. Your users never need to hold native tokens to pay for gas.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-brand-gold/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Clock className="text-brand-gold w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Instant Settlement</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Experience sub-second transaction finality on the Polygon network. Say goodbye to the T+2 settlement delays of traditional banking.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-brand-gold/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ShieldCheck className="text-brand-gold w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Bank-Grade Security</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Multi-sig treasury management, AES-256-GCM encryption, and SOC2 Type II compliance ensure your funds and data are always secure.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="glass-card p-8 rounded-3xl border border-white/5 hover:border-brand-gold/30 transition-all duration-300 group">
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Globe className="text-brand-gold w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Global Reach</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Accept payments from anywhere in the world without exorbitant cross-border FX fees. Seamless fiat ramps in 150+ countries.
              </p>
            </div>
          </div>
        </div>
      </section>

        {/* How It Works Section */}
        <section className="py-24 relative overflow-hidden mt-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
                How It <span className="text-brand-gold">Works</span>
              </h2>
              <p className="text-neutral-400 max-w-2xl mx-auto text-lg">
                Our infrastructure handles the complexity of blockchain payments so you don't have to.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-brand-gold/0 via-brand-gold/30 to-brand-gold/0 -translate-y-1/2 -z-10"></div>
              
              {[
                { step: "1", title: "Customer Checkout", desc: "User pays in their preferred crypto or fiat currency. Our Account Abstraction layer intercepts the transaction." },
                { step: "2", title: "Zero Gas Processing", desc: "Our Paymaster sponsors the gas fees. The smart contract validates and routes the funds instantly on Polygon." },
                { step: "3", title: "Merchant Settlement", desc: "Funds settle directly into your non-custodial enterprise wallet or convert automatically to fiat via our ramps." }
              ].map((item, i) => (
                <div key={i} className="glass-card p-8 rounded-3xl border border-white/5 flex flex-col items-center text-center relative hover:border-brand-gold/30 transition-all duration-300">
                  <div className="w-16 h-16 rounded-full bg-brand-dark border-2 border-brand-gold flex items-center justify-center text-2xl font-black text-brand-gold mb-6 shadow-[0_0_20px_rgba(255,215,0,0.2)]">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-neutral-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Developer Integration Section */}
        <section className="py-24 relative overflow-hidden border-t border-white/5 bg-black/20 rounded-3xl mb-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-6">
                  Built for <span className="text-brand-gold">Developers</span>
                </h2>
                <p className="text-neutral-400 text-lg mb-8 leading-relaxed">
                  Integrate Web3 payments into your application with just a few lines of code. Our powerful SDKs support React, Node.js, Python, and more.
                </p>
                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-brand-gold" />
                    <span>Drop-in UI components for React and Next.js</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-brand-gold" />
                    <span>Webhooks for real-time transaction updates</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-brand-gold" />
                    <span>Comprehensive API documentation and Sandbox</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button className="bg-brand-gold text-brand-dark hover:bg-yellow-400 font-bold px-6 py-6 rounded-full shadow-glow">
                    View Documentation
                  </Button>
                  <Button className="bg-transparent border border-white/20 text-white hover:bg-white/5 font-bold px-6 py-6 rounded-full">
                    Get API Keys
                  </Button>
                </div>
              </div>
              
              {/* Code Snippet Display */}
              <div className="glass-card rounded-2xl overflow-hidden border border-white/10 relative shadow-2xl">
                <div className="bg-[#1e1e1e] px-4 py-3 border-b border-white/5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2 font-mono">checkout.ts</span>
                </div>
                <div className="p-6 bg-[#0d0d0d] text-sm font-mono overflow-x-auto">
                  <pre className="text-gray-300 leading-relaxed">
                    <span className="text-purple-400">import</span> {'{ SecureChainPay }'} <span className="text-purple-400">from</span> <span className="text-green-400">'@securechain/sdk'</span>;<br/><br/>
                    <span className="text-purple-400">const</span> pay = <span className="text-purple-400">new</span> <span className="text-yellow-200">SecureChainPay</span>({'{'}<br/>
                    {'  '}apiKey: process.env.<span className="text-blue-300">SECURECHAIN_KEY</span>,<br/>
                    {'  '}network: <span className="text-green-400">'polygon-mainnet'</span><br/>
                    {'}'});<br/><br/>
                    <span className="text-purple-400">const</span> session = <span className="text-purple-400">await</span> pay.checkout.<span className="text-blue-300">create</span>({'{'}<br/>
                    {'  '}amount: <span className="text-orange-400">100.00</span>,<br/>
                    {'  '}currency: <span className="text-green-400">'USD'</span>,<br/>
                    {'  '}successUrl: <span className="text-green-400">'https://your-app.com/success'</span><br/>
                    {'}'});<br/>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>
      
      
      {/* Footer */}
      <footer className="py-6 px-8 border-t border-white/5 flex justify-between items-center z-10 glass-panel mt-auto relative z-20">
        <p className="text-sm text-gray-500">© 2026 SecureChain Pay. All rights reserved.</p>
        <p className="text-sm text-gray-500 flex items-center gap-2">
          Developed by <span className="text-brand-gold font-medium">Aditya Singh</span>
        </p>
      </footer>
      
      {/* Floating Auth Widget Removed to keep UI clean */}
    </div>
  );
}

