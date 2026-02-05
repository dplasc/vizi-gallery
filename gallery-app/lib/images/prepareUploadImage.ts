/**
 * Client-side image resize + JPEG compression for upload.
 * If file is not image/* or on error, returns the original file unchanged.
 */

const JPEG_QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.5] as const;

export type PrepareUploadImageOpts = {
  maxSide: number;
  maxBytes: number;
};

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality
    );
  });
}

export async function prepareUploadImage(
  file: File,
  opts: PrepareUploadImageOpts
): Promise<File> {
  const { maxSide, maxBytes } = opts;
  const type = (file.type ?? "").trim().toLowerCase();
  if (!type.startsWith("image/")) {
    return file;
  }

  let objectUrl: string | null = null;
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image load failed"));
      el.src = objectUrl as string;
    });

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) {
      return file;
    }

    const scale = maxSide / Math.max(w, h);
    const outW = scale >= 1 ? w : Math.max(1, Math.round(w * scale));
    const outH = scale >= 1 ? h : Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(img, 0, 0, outW, outH);

    let resultBlob: Blob | null = null;
    for (const q of JPEG_QUALITIES) {
      const blob = await canvasToBlob(canvas, q);
      if (blob.size <= maxBytes) {
        resultBlob = blob;
        break;
      }
      resultBlob = blob;
    }

    if (!resultBlob) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "image";
    return new File([resultBlob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
