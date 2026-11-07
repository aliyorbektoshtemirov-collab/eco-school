/**
 * API bilan ishlash. Cookie avtomatik yuboriladi,
 * CSRF uchun maxsus sarlavha qo'shiladi.
 */

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body, raw, contentType } = {}) {
  const headers = { 'X-Eco-Client': 'web' };
  if (raw) headers['Content-Type'] = contentType || 'application/octet-stream';
  else if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new ApiError("Internet aloqasi yo‘q yoki server javob bermadi.", 0, 'network');
  }

  let data = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    data = await res.json().catch(() => null);
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Xatolik yuz berdi (${res.status}).`, res.status, data?.code);
  }
  return data ?? {};
}

export const api = {
  get: (p) => request(p),
  post: (p, b) => request(p, { method: 'POST', body: b ?? {} }),
  put: (p, b) => request(p, { method: 'PUT', body: b ?? {} }),
  del: (p) => request(p, { method: 'DELETE' }),
  upload: (blob, type) => request('/uploads', { method: 'POST', raw: blob, contentType: type }),
};

/**
 * Telefon surati 5 MB dan katta bo'lishi mumkin. Yuborishdan oldin
 * brauzerning o'zida 1600 px gacha kichraytirib, JPEG ga o'giramiz.
 */
export async function compressImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  return blob && blob.size < file.size ? blob : file;
}

/** R2 kalitidan ko'rsatish manzili. */
export function fileUrl(key, admin = false) {
  if (!key) return null;
  return admin ? `/api/admin/files/${key}` : `/api/files/${key}`;
}
