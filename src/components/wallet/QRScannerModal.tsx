'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, RefreshCw, Upload, AlertCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import jsQR from 'jsqr';
import { resolveRecipientFromQR, ResolvedRecipient } from '@/lib/payments/recipient-resolver';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (recipient: ResolvedRecipient) => void;
}

export function QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResult, setScannedResult] = useState<ResolvedRecipient | null>(null);

  const animFrameIdRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const handleScanData = useCallback(
    (rawText: string) => {
      const result = resolveRecipientFromQR(rawText);
      if (result.success && result.recipient) {
        stopCamera();
        setErrorMsg(null);

        // Haptic feedback if available
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(100);
          } catch (e) {}
        }

        // Instantly transition to transfer amount step without extra taps
        onScanSuccess(result.recipient);
        onClose();
      } else {
        setErrorMsg(result.error || 'Invalid QR code. Please scan a SecureChain Pay QR.');
      }
    },
    [stopCamera, onScanSuccess, onClose]
  );

  // Scan frame-by-frame loop using Canvas + jsQR / BarcodeDetector
  const scanLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleScanData(code.data);
          return;
        }
      }
    }

    animFrameIdRef.current = requestAnimationFrame(scanLoop);
  }, [handleScanData]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setErrorMsg(null);
    setScannedResult(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionState('unavailable');
      setErrorMsg('Camera access is not supported on this browser or device.');
      return;
    }

    try {
      setPermissionState('prompt');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      streamRef.current = stream;
      setPermissionState('granted');
      setIsScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        animFrameIdRef.current = requestAnimationFrame(scanLoop);
      }
    } catch (err: any) {
      console.warn('[QRScanner] Camera access failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMsg('Camera permission was denied. Please allow camera permissions in browser settings.');
      } else {
        setPermissionState('unavailable');
        setErrorMsg(`Camera unavailable: ${err.message || 'Check hardware connection'}`);
      }
    }
  }, [scanLoop, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Image Upload Fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScanData(code.data);
          } else {
            setErrorMsg('Could not detect a valid QR code in the uploaded image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmRecipient = () => {
    if (scannedResult) {
      onScanSuccess(scannedResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-0 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <Camera className="text-emerald-400" size={20} />
            <h3 className="font-bold text-white text-base">Scan Payment QR Code</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scanner Viewport / Recipient Result */}
        <div className="p-6 flex flex-col items-center justify-center space-y-5 min-h-[340px]">
          {scannedResult ? (
            /* Recipient Found Confirmation Screen */
            <div className="w-full bg-neutral-950/80 border border-emerald-500/30 rounded-2xl p-6 space-y-5 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xl">
                  {scannedResult.displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full uppercase">
                    Recipient Found
                  </span>
                  <h4 className="text-lg font-bold text-white mt-1">{scannedResult.displayName}</h4>
                  {scannedResult.username && (
                    <p className="text-xs text-neutral-400 font-mono">{scannedResult.username}</p>
                  )}
                </div>
              </div>

              <div className="bg-black/50 p-3.5 rounded-xl border border-white/5 font-mono text-xs space-y-1">
                <span className="text-neutral-500 text-[10px] uppercase block">Target Wallet Address</span>
                <span className="text-neutral-200 select-all break-all">{scannedResult.walletAddress}</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setScannedResult(null);
                    startCamera();
                  }}
                  className="flex-1 py-3 text-xs font-bold bg-white/5 hover:bg-white/10 text-neutral-300 rounded-xl transition-colors border border-white/10"
                >
                  Scan Again
                </button>
                <button
                  onClick={handleConfirmRecipient}
                  className="flex-1 py-3 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  Continue to Amount →
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream Viewport */
            <div className="w-full space-y-4 flex flex-col items-center">
              <div className="relative w-full max-w-[320px] aspect-square rounded-2xl overflow-hidden border-2 border-emerald-500/40 bg-black shadow-inner flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <canvas ref={canvasRef} className="hidden" />

                {/* Reticle Target Overlay */}
                <div className="absolute inset-0 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-emerald-400 rounded-xl animate-pulse" />
                </div>

                {permissionState === 'denied' && (
                  <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3">
                    <AlertCircle className="text-rose-400" size={32} />
                    <p className="text-xs font-bold text-white">Camera Access Denied</p>
                    <p className="text-[11px] text-neutral-400">Please enable camera permission in your browser or use file upload.</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-neutral-400 text-center font-medium">
                Position the SecureChain Pay or Wallet QR code inside the frame
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer (Image Upload Fallback) */}
        {!scannedResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-neutral-950/60">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs font-bold text-neutral-300 hover:text-white px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
            >
              <Upload size={14} /> Upload QR Image
            </button>

            <button
              onClick={startCamera}
              className="flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-medium"
            >
              <RefreshCw size={12} /> Restart Camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
