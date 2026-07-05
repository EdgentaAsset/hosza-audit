/**
 * Pengimbas QR/barcode.
 * BarcodeDetector native (Chrome Android — offline, pantas) →
 * fallback ZXing (dep sedia ada) untuk browser lain.
 */
import { el, q } from '../ui/dom';
import { icon } from '../ui/icons';
import { toast } from '../ui/toast';
import './scan.css';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

export async function openScanner(onResult: (value: string) => void): Promise<void> {
  const overlay = el(`
    <div class="scan-overlay">
      <video class="scan-video" autoplay playsinline muted></video>
      <div class="scan-frame"></div>
      <p class="scan-hint">Halakan kamera ke kod QR / barcode</p>
      <button type="button" class="scan-close" aria-label="Tutup pengimbas">${icon('x', 22)}</button>
    </div>
  `);
  const video = q<HTMLVideoElement>(overlay, 'video');
  let stream: MediaStream | null = null;
  let stopped = false;

  function stop(): void {
    stopped = true;
    stream?.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  q(overlay, '.scan-close').addEventListener('click', stop);
  document.body.appendChild(overlay);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    video.srcObject = stream;
    await video.play();
  } catch {
    stop();
    toast('Kamera tidak dapat diakses — semak kebenaran kamera', 'err');
    return;
  }

  const done = (value: string): void => {
    if (stopped) return;
    stop();
    if (navigator.vibrate) navigator.vibrate(60);
    onResult(value.trim());
  };

  const BD = (window as unknown as { BarcodeDetector?: new () => BarcodeDetectorLike }).BarcodeDetector;
  if (BD) {
    const detector = new BD();
    const tick = async (): Promise<void> => {
      if (stopped) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) return done(codes[0].rawValue);
      } catch {
        /* frame belum sedia — cuba lagi */
      }
      setTimeout(() => void tick(), 200);
    };
    void tick();
  } else {
    // Fallback ZXing — dimuat hanya bila perlu (jimat bundle boot)
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    reader
      .decodeOnceFromStream(stream, video)
      .then((result) => done(result.getText()))
      .catch(() => {
        if (!stopped) {
          stop();
          toast('Imbasan dibatalkan', '');
        }
      });
  }
}
