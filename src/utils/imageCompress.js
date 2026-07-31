/** Resize / JPEG-compress image file → data URL (public query uploads). */
export function compressImageFileToDataUrl(file, { maxEdge = 1280, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Sirf image file choose karein."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Photo read fail."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Photo load fail."));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}
