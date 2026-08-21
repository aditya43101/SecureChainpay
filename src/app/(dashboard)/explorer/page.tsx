'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useWalletStore } from '@/stores/wallet-store';
import { Search, ShieldCheck, ShieldAlert, CheckCircle2, XCircle, Activity, Server, Hash, Clock, Link as LinkIcon, Database, ArrowRight } from 'lucide-react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';

// A custom hook for debouncing search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

interface ValidationResult {
  genesisValid: boolean;
  hashChainValid: boolean;
  blockOrderValid: boolean;
  noDuplicates: boolean;
  noMissingBlocks: boolean;
  signaturesValid: boolean;
  isValid: boolean;
  lastChecked: string;
}

export default function ExplorerPage() {
  const transactions = useWalletStore((state) => state.transactions);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Validate Blockchain Integrity (Advanced)
  const validateBlockchain = useCallback(async () => {
    if (transactions.length === 0) return;
    
    // Sort ascending (genesis first) to check chain
    const chain = [...transactions].sort((a, b) => a.blockNumber - b.blockNumber);
    
    let genesisValid = false;
    let hashChainValid = true;
    let blockOrderValid = true;
    let noDuplicates = true;
    let noMissingBlocks = true;
    let signaturesValid = true;
    
    const blockNumbers = new Set<number>();
    const hashes = new Set<string>();

    for (let i = 0; i < chain.length; i++) {
      const block = chain[i];
      
      // Genesis Check
      if (i === 0 && block.blockNumber === 0 && block.type === 'genesis') {
        genesisValid = true;
      }
      
      // Order & Missing check
      if (i > 0) {
        if (block.blockNumber !== chain[i - 1].blockNumber + 1) {
          blockOrderValid = false;
          noMissingBlocks = false;
        }
        // Hash Chain linkage
        if (block.previousHash !== chain[i - 1].hash) {
          hashChainValid = false;
        }
      }
      
      // Duplicate checks
      if (blockNumbers.has(block.blockNumber)) noDuplicates = false;
      if (hashes.has(block.hash)) noDuplicates = false;
      blockNumbers.add(block.blockNumber);
      hashes.add(block.hash);
      
      // Signature check
      if (block.type !== 'genesis' && signaturesValid) {
        try {
          if (!block.digitalSignature || !block.payload?.signPayload) {
            signaturesValid = false;
          } else {
            const recoveredAddress = ethers.verifyMessage(block.payload.signPayload, block.digitalSignature);
            let expectedAddress = block.walletAddress;
            if (!expectedAddress && block.senderPublicKey) {
              try {
                expectedAddress = block.senderPublicKey.startsWith('0x04')
                  ? ethers.computeAddress(block.senderPublicKey)
                  : block.senderPublicKey;
              } catch {
                expectedAddress = block.senderPublicKey;
              }
            }
            if (!expectedAddress || recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
              signaturesValid = false;
            }
          }
        } catch {
          signaturesValid = false;
        }
      }
    }
    
    const isValid = genesisValid && hashChainValid && blockOrderValid && noDuplicates && noMissingBlocks && signaturesValid;
    
    setValidationResult({
      genesisValid,
      hashChainValid,
      blockOrderValid,
      noDuplicates,
      noMissingBlocks,
      signaturesValid,
      isValid,
      lastChecked: new Date().toLocaleString()
    });
  }, [transactions]);

  // Initial passive validation
  useEffect(() => {
    if (!validationResult && transactions.length > 0) {
      validateBlockchain();
    }
  }, [transactions, validateBlockchain, validationResult]);

  const blocks = useMemo(() => {
    const sortedTxs = [...transactions].sort((a, b) => b.blockNumber - a.blockNumber);
    if (!debouncedSearch.trim()) return sortedTxs;
    
    const query = debouncedSearch.toLowerCase().trim();
    const queryAsNumber = Number(query);
    const isNumeric = !isNaN(queryAsNumber) && query !== '';

    return sortedTxs.filter(tx => 
      tx.blockNumber.toString() === query ||
      tx.hash.toLowerCase().includes(query) ||
      tx.type.toLowerCase().includes(query) ||
      (isNumeric && tx.amount === queryAsNumber) ||
      tx.date.toLowerCase().includes(query) ||
      (tx.walletAddress && tx.walletAddress.toLowerCase().includes(query))
    );
  }, [transactions, debouncedSearch]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const selectedBlock = useMemo(() => {
    return blocks.find(b => b.id === selectedBlockId) || blocks[0] || null;
  }, [blocks, selectedBlockId]);

  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');

  const handleVerifySignature = useCallback(() => {
    if (!selectedBlock) return;
    try {
      if (selectedBlock.type === 'genesis') {
        setVerifyStatus('valid');
        return;
      }

      if (!selectedBlock.digitalSignature || !selectedBlock.payload?.signPayload) {
        throw new Error("Missing signature data");
      }
      
      const recoveredAddress = ethers.verifyMessage(
        selectedBlock.payload.signPayload,
        selectedBlock.digitalSignature
      );
      
      let expectedAddress = selectedBlock.walletAddress;
      if (!expectedAddress && selectedBlock.senderPublicKey) {
        try {
          expectedAddress = selectedBlock.senderPublicKey.startsWith('0x04')
            ? ethers.computeAddress(selectedBlock.senderPublicKey)
            : selectedBlock.senderPublicKey;
        } catch {
          expectedAddress = selectedBlock.senderPublicKey;
        }
      }

      if (expectedAddress && recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()) {
        setVerifyStatus('valid');
      } else {
        setVerifyStatus('invalid');
      }
    } catch (error) {
      console.error(error);
      setVerifyStatus('invalid');
    }
  }, [selectedBlock]);

  // Automatic signature verification
  useEffect(() => {
    if (selectedBlock) {
      handleVerifySignature();
    }
  }, [selectedBlock, handleVerifySignature]);

  const latestBlock = useMemo(() => {
    if (transactions.length === 0) return null;
    return [...transactions].sort((a, b) => b.blockNumber - a.blockNumber)[0];
  }, [transactions]);
  
  const genesisBlock = useMemo(() => {
    if (transactions.length === 0) return null;
    return [...transactions].sort((a, b) => a.blockNumber - b.blockNumber)[0];
  }, [transactions]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 font-sans relative pb-32">
      <div className="max-w-6xl mx-auto space-y-8 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500 mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-emerald-400" />
              Blockchain Explorer
            </h1>
            <p className="text-neutral-400">Search and explore cryptographic blocks powering your transactions.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button 
              onClick={() => {
                validateBlockchain();
                setShowValidationModal(true);
              }}
              className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            >
              <ShieldCheck className="mr-2" size={18} /> Validate Blockchain
            </Button>
          </div>
        </div>

        {/* Network Information Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Server className="text-blue-400" size={20} />
              <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">Network Name</h3>
            </div>
            <p className="text-xl font-bold text-white">SecureChain Local</p>
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Online • PoA Consensus</p>
          </div>
          
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="text-purple-400" size={20} />
              <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">Chain Height</h3>
            </div>
            <p className="text-xl font-bold text-white">{transactions.length} Blocks</p>
            <p className="text-xs text-neutral-500 mt-1">Latest Block #{latestBlock?.blockNumber || 0}</p>
          </div>
          
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className={validationResult?.isValid ? "text-emerald-400" : "text-red-400"} size={20} />
              <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">Integrity Status</h3>
            </div>
            {validationResult ? (
              <>
                <p className={`text-xl font-bold ${validationResult.isValid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {validationResult.isValid ? 'VALID' : 'CORRUPTED'}
                </p>
                <p className="text-xs text-neutral-500 mt-1">Checked: {validationResult.lastChecked}</p>
              </>
            ) : (
              <p className="text-neutral-500 text-sm">Validating...</p>
            )}
          </div>
          
          <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="text-orange-400" size={20} />
              <h3 className="font-semibold text-gray-300 text-sm uppercase tracking-wider">Genesis Block</h3>
            </div>
            <p className="text-sm font-mono text-white truncate">{genesisBlock?.hash ? genesisBlock.hash.substring(0, 16) + '...' : 'N/A'}</p>
            <p className="text-xs text-neutral-500 mt-1">{genesisBlock ? new Date(genesisBlock.date).toLocaleString() : 'N/A'}</p>
          </div>
        </div>

        {/* Visual Blockchain Chain */}
        <div className="bg-neutral-900/50 border border-white/10 rounded-2xl p-6 overflow-x-auto custom-scrollbar flex items-center space-x-2">
          {transactions.length === 0 ? (
            <p className="text-neutral-500 text-sm italic">No blocks generated yet.</p>
          ) : (
            [...transactions].sort((a, b) => a.blockNumber - b.blockNumber).map((b, index) => (
              <React.Fragment key={b.id}>
                <div 
                  onClick={() => setSelectedBlockId(b.id)}
                  className={`flex flex-col items-center justify-center p-3 min-w-[120px] rounded-xl cursor-pointer transition-all border ${
                    selectedBlock?.id === b.id 
                    ? 'bg-emerald-500/20 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'bg-black/50 border-white/10 hover:border-white/30'
                  }`}
                >
                  <span className="text-xs font-mono text-neutral-400 mb-1">{b.type === 'genesis' ? 'Genesis' : `Block ${b.blockNumber}`}</span>
                  <Hash className={b.type === 'genesis' ? 'text-orange-400' : 'text-emerald-400'} size={24} />
                  <span className="text-[10px] text-neutral-500 font-mono mt-1 w-full text-center truncate px-2">{b.hash.substring(0, 6)}..</span>
                </div>
                {index < transactions.length - 1 && (
                  <ArrowRight className="text-neutral-600 flex-shrink-0" size={20} />
                )}
              </React.Fragment>
            ))
          )}
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative flex items-center bg-neutral-900 border border-white/10 rounded-xl overflow-hidden p-2 shadow-2xl">
            <Search className="text-neutral-500 ml-3" size={24} />
            <input 
              type="text" 
              placeholder="Search by Block Number, Hash, Amount, or Type..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-white focus:ring-0 pl-4 py-3 placeholder-neutral-500 outline-none"
            />
          </div>
        </div>

        {blocks.length === 0 ? (
           <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/5 backdrop-blur-md">
             <p className="text-neutral-400 text-lg">
                {transactions.length === 0 ? "No blocks found. Make a transaction to mine the genesis block!" : "No blocks match your search query."}
             </p>
           </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Block Browser (Left side) */}
            <div className="lg:col-span-1 space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
              {blocks.map((block) => (
                <div 
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`p-4 rounded-xl cursor-pointer transition-all border ${
                    selectedBlock?.id === block.id 
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-200">Block #{block.blockNumber}</span>
                    <span className="text-xs text-neutral-500">
                      {new Date(block.date).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-neutral-500 truncate">
                    Hash: {block.hash}
                  </div>
                </div>
              ))}
            </div>

            {/* Block Details (Right side) */}
            {selectedBlock && (
              <div className="lg:col-span-2 bg-neutral-950/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                
                <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4 relative z-10">
                  <h3 className="text-2xl font-bold">Block Details</h3>
                  <span className="px-3 py-1 bg-white/5 text-emerald-400 font-mono text-sm rounded-lg border border-white/10">
                    #{selectedBlock.blockNumber}
                  </span>
                </div>

                <div className="space-y-6 relative z-10">
                  <div>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold flex items-center gap-2"><Hash size={14}/> Block Hash</p>
                    <p className="font-mono text-emerald-400 break-all bg-emerald-400/10 p-4 rounded-xl border border-emerald-400/20 shadow-inner">
                      {selectedBlock.hash}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold flex items-center gap-2"><LinkIcon size={14}/> Previous Hash</p>
                    <p className="font-mono text-neutral-400 break-all bg-black/50 p-4 rounded-xl border border-white/5 shadow-inner">
                      {selectedBlock.previousHash}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5 col-span-2">
                      <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold">Timestamp</p>
                      <p className="font-semibold text-gray-200 truncate">
                        {new Date(selectedBlock.date).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                      <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold">Type</p>
                      <p className="font-semibold text-gray-200 capitalize">{selectedBlock.type}</p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5">
                      <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold">Amount</p>
                      <p className="font-semibold text-gray-200">{selectedBlock.amount} {selectedBlock.currency}</p>
                    </div>
                  </div>

                  {/* Cryptographic Signature Verification */}
                  <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold">Digital Signature</h4>
                      <Button 
                        onClick={handleVerifySignature}
                        variant="outline"
                        className="bg-transparent text-neutral-400 border-white/10 hover:text-white hover:bg-white/5 text-xs"
                      >
                        Verify Again
                      </Button>
                    </div>
                    
                    {verifyStatus !== 'idle' && (
                      <div className={`mb-4 p-4 rounded-xl border flex items-center gap-3 ${verifyStatus === 'valid' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {verifyStatus === 'valid' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                        <div>
                          <p className="font-bold">{verifyStatus === 'valid' ? 'Signature Status: Valid' : 'Signature Status: Invalid'}</p>
                          <p className="text-sm opacity-80">
                            {verifyStatus === 'valid' 
                              ? 'This transaction was cryptographically signed by the sender and remains untampered.' 
                              : 'Warning: This transaction fails cryptographic verification!'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div className="bg-black/80 border border-white/10 rounded-xl p-4 font-mono text-xs overflow-x-auto text-neutral-400 shadow-inner space-y-3">
                      <div>
                        <span className="text-cyan-500 font-bold block mb-1">Sender Public Key:</span>
                        <span className="break-all">{selectedBlock.senderPublicKey || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-cyan-500 font-bold block mb-1">Signature:</span>
                        <span className="break-all">{selectedBlock.digitalSignature || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-cyan-500 font-bold block mb-1">Payload:</span>
                        <span className="break-all">{selectedBlock.payload?.signPayload || 'System Generated'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h4 className="text-lg font-bold mb-4">Full Block Data</h4>
                    <div className="bg-black/80 border border-white/10 rounded-xl p-6 font-mono text-sm overflow-x-auto text-cyan-300 shadow-inner">
                      <pre>
                        {JSON.stringify(selectedBlock, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </div>

      {/* Validation Modal */}
      {showValidationModal && validationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-emerald-400" />
                Blockchain Validation Tool
              </h2>
              <button onClick={() => setShowValidationModal(false)} className="text-neutral-500 hover:text-white">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Genesis Block Present</span>
                {validationResult.genesisValid ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Hash Chain Intact</span>
                {validationResult.hashChainValid ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Signatures Valid</span>
                {validationResult.signaturesValid ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">Block Order Sequential</span>
                {validationResult.blockOrderValid ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">No Duplicate Blocks</span>
                {validationResult.noDuplicates ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
              <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                <span className="text-sm font-medium text-neutral-300">No Missing Blocks</span>
                {validationResult.noMissingBlocks ? <CheckCircle2 className="text-emerald-400" size={20} /> : <XCircle className="text-red-400" size={20} />}
              </div>
            </div>
            
            <div className={`p-6 border-t ${validationResult.isValid ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
              <div className="flex flex-col items-center justify-center text-center">
                <p className="text-sm text-neutral-400 uppercase tracking-widest font-bold mb-2">Final Result</p>
                {validationResult.isValid ? (
                  <p className="text-2xl font-black text-emerald-400 tracking-tight">VALID INTEGRITY</p>
                ) : (
                  <p className="text-2xl font-black text-red-400 tracking-tight">CHAIN CORRUPTED</p>
                )}
                <p className="text-xs text-neutral-500 mt-2">Checked against {transactions.length} total blocks.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
