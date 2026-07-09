import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from './ui/button';

type Phase = 'starting' | 'scanning' | 'error';

/**
 * Camera QR scanner. Opens the back camera, decodes frames with jsQR (works on
 * iOS + Android, unlike the native BarcodeDetector), and calls onScan with the
 * decoded text.
 *
 * Mobile is fussy: the <video> must be autoPlay + muted + playsinline, and we
 * must wait for metadata before play() — otherwise the feed is a black screen.
 * Any failure is surfaced (not swallowed) so the user sees why.
 */
export function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let done = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function fail(message: string, technical?: string) {
      if (done) return;
      setDetail(technical ? `${message} (${technical})` : message);
      setPhase('error');
    }

    async function start() {
      if (!window.isSecureContext) {
        fail('The camera needs a secure connection. Open the https:// site, then try again.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        fail('This browser can’t open the camera here. Paste the code instead.');
        return;
      }
      // Prefer the back camera; if that exact constraint isn't available, retry with any camera.
      try {
        stream = await navigator.mediaDevices
          .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
      } catch (e) {
        const name = e instanceof DOMException ? e.name : 'error';
        fail(
          name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow it in your browser, or paste the code.'
            : 'Couldn’t open the camera. Paste the code instead.',
          name,
        );
        return;
      }

      const video = videoRef.current;
      if (!video || done) return;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.srcObject = stream;

      // Wait for dimensions, then play. Without this the frame grab reads 0×0.
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      try {
        await video.play();
      } catch (e) {
        fail('Couldn’t start the camera preview. Tap the screen and retry.', (e as Error)?.name);
        return;
      }
      if (done) return;
      setPhase('scanning');
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
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-full w-full object-cover"
          />
          {phase === 'scanning' && (
            <div className="pointer-events-none absolute inset-8 rounded-md border-2 border-primary/80" />
          )}
          {phase === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-mono text-xs text-muted-foreground">starting camera…</p>
            </div>
          )}
          {phase === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center bg-card p-6 text-center">
              <p className="font-mono text-xs leading-relaxed text-foreground">{detail}</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {phase === 'scanning' ? 'point at the code on the other device' : 'link a device'}
          </span>
          <Button size="sm" variant="outline" onClick={onClose}>
            {phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
