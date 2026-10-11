// QR reading for flow B: from a picked screenshot or the live camera. iOS Safari has no
// BarcodeDetector, so jsQR (loaded on demand) is the fallback everywhere.

async function decodeBitmapData(data: ImageData): Promise<string | null> {
  const { default: jsQR } = await import('jsqr');
  // Terminals are light on dark; QR readers expect the opposite, so try both polarities.
  return jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

function toImageData(source: CanvasImageSource, w: number, h: number, maxSide = 1600): ImageData {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Decodes a QR from an image file (a screenshot of the terminal). */
export async function decodeQrFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  try {
    return await decodeBitmapData(toImageData(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/** Runs the camera until a QR is read. Returns a stop function. */
export async function startCameraScan(video: HTMLVideoElement, onText: (text: string) => void, onError: (m: string) => void): Promise<() => void> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch {
    onError('Camera not available. Choose a screenshot of the QR instead.');
    return () => {};
  }
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => {});
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  const tick = async () => {
    if (stopped) return;
    if (video.videoWidth > 0) {
      const text = await decodeBitmapData(toImageData(video, video.videoWidth, video.videoHeight, 800));
      if (text && !stopped) {
        onText(text);
        return;
      }
    }
    setTimeout(tick, 200);
  };
  void tick();
  return stop;
}
