import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

  // lock background scroll while the full-screen scanner is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

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

  return createPortal(
    <div
      role="dialog"
      aria-label="Scan a link QR code"
      className="fixed inset-0 z-[70] bg-black"
    >
      {/* full-screen camera feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* controls float over the feed */}
      <div className="absolute inset-0 flex flex-col">
        {/* top bar (with a scrim for legibility over the video) */}
        <div
          className="flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-5 pb-6"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/80">
            Scan link QR
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg text-white"
          >
            ✕
          </button>
        </div>

        {/* center reticle */}
        <div className="flex flex-1 items-center justify-center px-8">
          {phase === 'scanning' && (
            <div className="relative aspect-square w-full max-w-[72vw] sm:max-w-xs">
              <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-lg border-l-4 border-t-4 border-primary" />
              <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-lg border-r-4 border-t-4 border-primary" />
              <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-primary" />
              <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-lg border-b-4 border-r-4 border-primary" />
            </div>
          )}
          {phase === 'starting' && (
            <p className="font-mono text-xs uppercase tracking-widest text-white/80">
              starting camera…
            </p>
          )}
          {phase === 'error' && (
            <p className="max-w-xs text-center font-mono text-sm leading-relaxed text-white">
              {detail}
            </p>
          )}
        </div>

        {/* bottom hint + actions */}
        <div
          className="flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-5 pt-6"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <span className="text-center font-mono text-[11px] uppercase tracking-widest text-white/80">
            {phase === 'scanning'
              ? 'point at the QR on the other device'
              : phase === 'error'
                ? 'or paste the code instead'
                : 'link a device'}
          </span>
          <Button variant="outline" onClick={onClose} className="border-white/40 bg-black/40 text-white">
            {phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
