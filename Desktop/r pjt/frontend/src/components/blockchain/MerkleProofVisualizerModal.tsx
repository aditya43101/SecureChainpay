'use client';

import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Cpu,
  Layers,
  ArrowDown,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react';
import { BatchInclusionProofDTO, ProofStepDTO } from '../../types/vehicle';
import { verifyProofDirectApi } from '../../lib/api';

interface MerkleProofVisualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  proofData: BatchInclusionProofDTO | null;
}

export default function MerkleProofVisualizerModal({
  isOpen,
  onClose,
  proofData,
}: MerkleProofVisualizerModalProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSpecs, setShowSpecs] = useState(false);
  const [isVerifyingOnChain, setIsVerifyingOnChain] = useState(false);
  const [onChainVerifyResult, setOnChainVerifyResult] = useState<{
    verified: boolean;
    calculatedRoot: string;
    onChainVerified?: boolean;
    error?: string;
  } | null>(null);

  if (!isOpen || !proofData) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunOnChainVerification = async () => {
    setIsVerifyingOnChain(true);
    setOnChainVerifyResult(null);
    try {
      const res = await verifyProofDirectApi({
        leaf: proofData.leafHash,
        proof: proofData.proof,
        root: proofData.merkleRoot,
        batchIdHex: proofData.batchIdHex,
      });

      if (res.success && res.data) {
        setOnChainVerifyResult({
          verified: res.data.isValid,
          calculatedRoot: res.data.calculatedRoot,
          onChainVerified: res.data.onChainVerified,
          error: res.data.error,
        });
      } else {
        setOnChainVerifyResult({
          verified: false,
          calculatedRoot: '',
          error: res.error || 'Verification failed',
        });
      }
    } catch (err: any) {
      setOnChainVerifyResult({
        verified: false,
        calculatedRoot: '',
        error: err.message || 'Network error verifying proof',
      });
    } finally {
      setIsVerifyingOnChain(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-slate-900">
                  Cryptographic Inclusion Proof
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  Merkle Tree v1
                </span>
                {proofData.isAnchoredOnChain && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    On-Chain Anchored
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Batch <span className="font-mono font-semibold text-slate-700">{proofData.batchIdentifier}</span> • Leaf Index #{proofData.leafIndex}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Record Identity & Leaf Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Source Lifecycle Record
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{proofData.recordType}</span>
                <span className="text-xs font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  ID: {proofData.recordId.slice(0, 16)}...
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Authoritative record hash was computed canonically via deterministic SHA-256 before leaf encoding.
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
              <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider flex items-center justify-between">
                <span>Domain-Separated Leaf Hash</span>
                <button
                  onClick={() => handleCopy(proofData.leafHash, 'leaf')}
                  className="text-blue-700 hover:text-blue-900 flex items-center gap-1 text-[11px]"
                >
                  {copiedKey === 'leaf' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === 'leaf' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="font-mono text-xs text-slate-900 break-all font-semibold bg-white/80 p-2 rounded-lg border border-blue-100">
                {proofData.leafHash}
              </div>
              <div className="text-[11px] text-blue-700/80">
                Keccak-256 commitment binding Record ID, Record Type, and SHA-256 payload hash.
              </div>
            </div>
          </div>

          {/* Interactive Merkle Tree Proof Path Visualization */}
          <div className="border border-slate-200 rounded-3xl p-5 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  Cryptographic Proof Path (Leaf to Root)
                </h4>
                <p className="text-xs text-slate-500">
                  {proofData.proof.length === 0
                    ? 'Single-leaf batch: Leaf hash is mathematically identical to Merkle Root.'
                    : `Verified across ${proofData.proof.length} tree level${proofData.proof.length > 1 ? 's' : ''} using sorted-pair Keccak-256 hashing.`}
                </p>
              </div>

              <button
                onClick={handleRunOnChainVerification}
                disabled={isVerifyingOnChain}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Cpu className="w-3.5 h-3.5" />
                {isVerifyingOnChain ? 'Checking On-Chain...' : 'Verify Live On-Chain'}
              </button>
            </div>

            {/* On-Chain Verify Live Feedback */}
            {onChainVerifyResult && (
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                  onChainVerifyResult.verified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {onChainVerifyResult.verified ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {onChainVerifyResult.verified
                      ? 'Live EVM Verification Passed: Proof is Valid!'
                      : 'Verification Failed'}
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {onChainVerifyResult.verified
                      ? `Smart contract successfully verified inclusion proof against committed on-chain root.`
                      : onChainVerifyResult.error || 'The supplied proof could not be verified.'}
                  </div>
                </div>
              </div>
            )}

            {/* Visual Step-by-Step Climbing */}
            <div className="space-y-3 pt-2">
              {/* Step 0: Leaf Node */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                    L
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900">Leaf Node (Current Record)</div>
                    <div className="text-[10px] text-slate-500 font-mono break-all">
                      {proofData.leafHash}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-200/60 text-blue-800 self-start sm:self-center">
                  Index #{proofData.leafIndex}
                </span>
              </div>

              {/* Intermediate Levels / Sibling Steps */}
              {proofData.proofSteps && proofData.proofSteps.length > 0 ? (
                proofData.proofSteps.map((step, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-center my-1 text-slate-400">
                      <ArrowDown className="w-4 h-4 text-blue-500" />
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          Level {step.level} Hash Pair
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Sorted-Pair Keccak-256
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-white p-2 rounded-lg border border-slate-200 overflow-hidden">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Current Branch</span>
                          <span className="break-all text-slate-800">{step.current}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-amber-200 bg-amber-50/30 overflow-hidden">
                          <span className="text-[9px] font-bold text-amber-600 uppercase block">Sibling Hash</span>
                          <span className="break-all text-amber-900">{step.sibling}</span>
                        </div>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span>Combined Parent Hash:</span>
                        <span className="font-mono text-slate-800 font-semibold">{step.parent.slice(0, 18)}...</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : proofData.proof.length > 0 ? (
                proofData.proof.map((sibling, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-center my-1 text-slate-400">
                      <ArrowDown className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-bold text-slate-700">Sibling Level {idx + 1}: </span>
                        <span className="font-mono text-[11px] text-slate-600 break-all">{sibling}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : null}

              {/* Arrow to Root */}
              <div className="flex justify-center my-1 text-slate-400">
                <ArrowDown className="w-4 h-4 text-emerald-600" />
              </div>

              {/* Calculated & Committed Root */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    Committed Merkle Root
                  </div>
                  <button
                    onClick={() => handleCopy(proofData.merkleRoot, 'root')}
                    className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 text-[11px]"
                  >
                    {copiedKey === 'root' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'root' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-emerald-950 font-bold break-all bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                  {proofData.merkleRoot}
                </div>
                <div className="text-[11px] text-emerald-800 flex items-center justify-between">
                  <span>Anchored on Smart Contract:</span>
                  <span className="font-bold text-emerald-900">
                    {proofData.isAnchoredOnChain ? '✓ Validated On-Chain' : 'Pending Confirmation'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cryptographic Specification Accordion */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <button
              onClick={() => setShowSpecs(!showSpecs)}
              className="w-full px-5 py-3.5 text-left text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center justify-between transition"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Technical Cryptographic Specification & Audit Standards
              </span>
              {showSpecs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {showSpecs && (
              <div className="px-5 pb-5 text-xs text-slate-600 space-y-3 border-t border-slate-200 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-800">Leaf Encoding Standard:</span>
                    <p className="font-mono text-slate-500 mt-0.5">
                      keccak256(abi.encode(DOMAIN_TAG, recordId, recordTypeHash, recordHash))
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Internal Node Convention:</span>
                    <p className="font-mono text-slate-500 mt-0.5">
                      keccak256(abi.encodePacked(min(a, b), max(a, b)))
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Odd Node Convention:</span>
                    <p className="text-slate-500 mt-0.5">PROMOTE_UNCHANGED (unpaired node lifted without duplication)</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Record Hash Algorithm:</span>
                    <p className="text-slate-500 mt-0.5">SHA-256 (Canonical deterministic JSON serialization)</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-500">
                  <strong className="text-slate-700">Security Guarantee:</strong> This Merkle proof guarantees that the individual record is cryptographically bound to the root without exposing unanchored or sensitive details. Tampering with any byte of the source record will immediately cause both off-chain proof verification and on-chain contract verification to fail.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {proofData.transactionHash && (
              <span>
                Committed in Tx:{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {proofData.transactionHash.slice(0, 16)}...
                </span>{' '}
                {proofData.blockNumber && `(Block #${proofData.blockNumber})`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
