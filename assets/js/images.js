/*
 * Browser image handling: resize to at most 1600 px on the long edge,
 * JPEG quality 0.8, PDFs pass through, HEIC only where the browser decodes it.
 */

export const MAX_LONG_EDGE = 1600;
export const JPEG_QUALITY = 0.8;
const RAW_IMAGE_LIMIT = 30 * 1024 * 1024;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const PDF_TYPES = ['application/pdf'];

export function isPdf(fileOrType) {
  const type = typeof fileOrType === 'string' ? fileOrType : (fileOrType && fileOrType.type);
  return String(type || '').toLowerCase() === 'application/pdf';
}

export function fileMime(file) {
  const type = String(file.type || '').toLowerCase();
  if (type) return type;
  const name = String(file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic')) return 'image/heic';
  if (name.endsWith('.heif')) return 'image/heif';
  return '';
}

export function formatBytes(bytes) {
  const number = Number(bytes) || 0;
  if (number < 1024) return number + ' B';
  if (number < 1024 * 1024) return (number / 1024).toFixed(0) + ' KB';
  return (number / (1024 * 1024)).toFixed(1) + ' MB';
}

function replaceExtension(name, extension) {
  const text = String(name || 'file');
  return text.replace(/\.[^.]+$/, '') + '.' + extension;
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (error) {
      try {
        return await createImageBitmap(file);
      } catch (secondError) {
        // Fall through to the HTMLImageElement path.
      }
    }
  }
  return await new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1];
        const bytes = atob(base64);
        const array = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
        resolve(new Blob([array], { type: 'image/jpeg' }));
      } catch (error) {
        reject(new Error('Could not compress this image.'));
      }
    }, 'image/jpeg', quality);
  });
}

/**
 * Compresses an image or validates a PDF.
 * Returns { blob, mimeType, name, size, width, height, isImage }.
 * Throws an Error with a friendly message when the file cannot be used.
 */
export async function prepareFile(file, maxBytes) {
  const type = fileMime(file);
  if (!file) throw new Error('Choose a file.');

  if (PDF_TYPES.includes(type)) {
    if (file.size > maxBytes) {
      throw new Error('This PDF is larger than the ' + formatBytes(maxBytes) + ' limit. Compress it or take a photo instead.');
    }
    return {
      blob: file,
      mimeType: 'application/pdf',
      name: file.name || 'document.pdf',
      size: file.size,
      width: 0,
      height: 0,
      isImage: false
    };
  }

  if (!IMAGE_TYPES.includes(type)) {
    throw new Error('Choose a JPEG, PNG or WebP photo, a HEIC photo your phone can open, or a PDF.');
  }

  if (file.size > RAW_IMAGE_LIMIT) {
    throw new Error('This photo is very large. Choose a smaller photo or take a new one.');
  }

  let source;
  try {
    source = await decodeImage(file);
  } catch (error) {
    if (type === 'image/heic' || type === 'image/heif') {
      throw new Error('This phone cannot convert that HEIC photo. Choose a JPEG or PNG, or set the camera to “Most Compatible”.');
    }
    throw new Error('This photo could not be opened. Try another photo or a PDF.');
  }

  const sourceWidth = source.width || source.naturalWidth || 0;
  const sourceHeight = source.height || source.naturalHeight || 0;
  if (!sourceWidth || !sourceHeight) throw new Error('This photo could not be read. Try another photo.');

  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot process photos. Choose a PDF instead.');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if (typeof source.close === 'function') source.close();

  let quality = JPEG_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > maxBytes) {
    throw new Error('The compressed photo is still larger than ' + formatBytes(maxBytes) + '. Try a smaller photo.');
  }

  return {
    blob,
    mimeType: 'image/jpeg',
    name: replaceExtension(file.name || 'photo', 'jpg'),
    size: blob.size,
    width,
    height,
    isImage: true
  };
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(blob);
  });
}

export function makeObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url) {
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      // Ignore.
    }
  }
}
