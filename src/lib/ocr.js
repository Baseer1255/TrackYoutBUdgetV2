import Tesseract from 'tesseract.js';

/**
 * Runs OCR on an image file and extracts the merchant name (first line) and total amount.
 * Supports any image format (including AVIF) by converting it to a resized PNG via canvas.
 * @param {File} imageFile - The receipt image file
 * @returns {Promise<{ merchant: string, total: number | null, text: string }>} OCR result
 */
export async function scanReceipt(imageFile) {
  // Helper to load an image and optionally resize it (max dimension 1000px) for faster OCR
  const loadAndResize = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 1000;
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas conversion failed'));
        const resizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
        URL.revokeObjectURL(url);
        resolve(resizedFile);
      }, 'image/png');
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

  // Convert any incoming image (including AVIF) to a PNG Blob via canvas resizing
  const processedFile = await loadAndResize(imageFile);

  // Feed the processed image to Tesseract via an object URL (avoids pixReadStream errors)
  const imageUrl = URL.createObjectURL(processedFile);
  const result = await Tesseract.recognize(imageUrl, 'eng', {
    logger: (m) => console.log('OCR Progress:', m),
  });
  URL.revokeObjectURL(imageUrl);

  const text = result.data.text;
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  const merchant = lines[0] || '';

  // Detect a total amount – look for a line with a currency symbol or a number with two decimals
  const amountRegex = /([$€£₹]?\s*\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/;
  let total = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(amountRegex);
    if (match) {
      const numeric = match[1].replace(/[^0-9.,]/g, '').replace(',', '.');
      total = parseFloat(numeric);
      break;
    }
  }

  return { merchant, total, text };
}
