"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Key, ArrowRight, Loader2 } from "lucide-react";
import { validateMnemonic, getAddressFromMnemonic } from "@/lib/crypto/recovery";

export default function RecoveryPage() {
  const [words, setWords] = useState<string[]>(Array(12).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveredAddress, setRecoveredAddress] = useState<string | null>(null);

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...words];
    
    // Handle paste event of multiple words
    if (value.includes(" ")) {
      const pastedWords = value.trim().split(/\s+/);
      pastedWords.forEach((word, i) => {
        if (index + i < 12) {
          newWords[index + i] = word.toLowerCase();
        }
      });
    } else {
      newWords[index] = value.toLowerCase();
    }
    
    setWords(newWords);
    setError(null);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const mnemonic = words.join(" ").trim();
      if (words.some(w => w === "")) {
        throw new Error("Please enter all 12 words");
      }

      const isValid = validateMnemonic(mnemonic);
      if (!isValid) {
        throw new Error("Invalid recovery phrase. Please check your spelling.");
      }

      const address = getAddressFromMnemonic(mnemonic);
      if (address) {
        setRecoveredAddress(address);
        // Typically securely store the wallet in local storage / context here
      } else {
        throw new Error("Failed to derive address from mnemonic");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 sm:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <Key className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Wallet Recovery
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Enter your 12-word recovery phrase to restore access to your secure wallet.
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {recoveredAddress ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl text-center"
            >
              <h3 className="text-xl font-bold text-green-700 dark:text-green-400 mb-2">Wallet Recovered!</h3>
              <p className="text-sm text-green-600 dark:text-green-500 mb-4 break-all">
                Address: {recoveredAddress}
              </p>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors"
              >
                Go to Dashboard
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleRecovery}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {words.map((word, index) => (
                  <div key={index} className="relative">
                    <span className="absolute left-3 top-3 text-xs text-gray-400 font-mono">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={word}
                      onChange={(e) => handleWordChange(index, e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm text-gray-900 dark:text-white"
                      placeholder="word"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center py-4 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Recover Wallet
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
