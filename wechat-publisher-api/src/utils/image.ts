import axios from 'axios';
import path from 'node:path';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const isDataUrl = (src: string) => src.startsWith('data:image/');

const decodeDataUrl = (src: string) => {
  const matches = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('图片数据格式不正确');
  }
  return {
    mime: matches[1],
    base64: matches[2]
  };
};

const extensionFromMime = (mime: string) => {
  const parts = mime.split('/');
  if (parts.length < 2) {
    return 'jpg';
  }
  const ext = parts[1].toLowerCase();
  if (ext === 'jpeg') {
    return 'jpg';
  }
  return ext;
};

const normalizeFilename = (name: string, fallback: string) => {
  const ext = path.extname(name);
  if (!ext) {
    return `${fallback}.jpg`;
  }
  return name;
};

const ensureFileSize = (buffer: Buffer) => {
  if (buffer.length > MAX_IMAGE_SIZE) {
    throw new Error('图片超过10MB，请先压缩后再发布');
  }
};

export const loadImageBuffer = async (src: string, index: number) => {
  if (isDataUrl(src)) {
    const { mime, base64 } = decodeDataUrl(src);
    const buffer = Buffer.from(base64, 'base64');
    ensureFileSize(buffer);
    const filename = `image-${index}.${extensionFromMime(mime)}`;
    return { buffer, filename };
  }

  const response = await axios.get<ArrayBuffer>(src, { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  ensureFileSize(buffer);
  let filename = `image-${index}.jpg`;
  try {
    const url = new URL(src);
    const base = path.basename(url.pathname) || filename;
    filename = normalizeFilename(base, `image-${index}`);
  } catch {
    filename = `image-${index}.jpg`;
  }
  return { buffer, filename };
};

export const parseUploadPayload = (image: string, filename?: string) => {
  if (isDataUrl(image)) {
    const { mime, base64 } = decodeDataUrl(image);
    const buffer = Buffer.from(base64, 'base64');
    ensureFileSize(buffer);
    const safeName = filename || `upload.${extensionFromMime(mime)}`;
    return { buffer, filename: safeName };
  }

  const buffer = Buffer.from(image, 'base64');
  ensureFileSize(buffer);
  return { buffer, filename: filename || 'upload.jpg' };
};

export const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE;
