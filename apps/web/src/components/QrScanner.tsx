import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from './ui/button';

/**
 * Camera QR scanner. Opens the back camera, decodes frames with jsQR (works on
 * iOS + Android, unlike the native BarcodeDetector), and calls onScan with the
 * decoded text. Camera access needs a secure context (https or localhost).
 */
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser can’t access the camera. Paste the code instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        setError('Camera permission denied or unavailable. Paste the code instead.');
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true'); // iOS: don't go fullscreen
      await video.play().catch(() => {});
      tick();
    }

    function tick() {
      const video = videoRef.current;
      if (done || !video || !ctx) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          done = true;
          onScan(code.data.trim());
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      done = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div
      role="dialog"
      aria-label="Scan a link QR code"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-background/95 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col border border-border-strong bg-card shadow-[var(--stack)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Scan link QR
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            close ✕
          </button>
        </div>
        <div className="relative aspect-square w-full overflow-hidden bg-background">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {/* framing reticle */}
          <div className="pointer-events-none absolute inset-8 border-2 border-primary/80" />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="font-mono text-xs text-muted-foreground">{error}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            point at the code on the other device
          </span>
          {error && (
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
