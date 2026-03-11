"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_IMAGE_BYTES = exports.parseUploadPayload = exports.loadImageBuffer = void 0;
const axios_1 = __importDefault(require("axios"));
const node_path_1 = __importDefault(require("node:path"));
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS || 15000);
const http = axios_1.default.create({ timeout: HTTP_TIMEOUT_MS });
const isDataUrl = (src) => src.startsWith('data:image/');
const isUnsupportedLocalSrc = (src) => src.startsWith('blob:') || src.startsWith('file:') || src.startsWith('img://');
const explainUnsupportedSrc = (src) => {
    if (src.startsWith('img://')) {
        return '图片仍是 img:// 本地标识，未转换成 base64 或网络地址';
    }
    if (src.startsWith('blob:')) {
        return '图片是浏览器临时地址（blob:），服务器无法访问';
    }
    if (src.startsWith('file:')) {
        return '图片是本地文件地址（file:），服务器无法访问';
    }
    return '图片地址不受支持';
};
const decodeDataUrl = (src) => {
    const matches = src.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!matches) {
        throw new Error('图片数据格式不正确');
    }
    return {
        mime: matches[1],
        base64: matches[2]
    };
};
const extensionFromMime = (mime) => {
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
const normalizeFilename = (name, fallback) => {
    const ext = node_path_1.default.extname(name);
    if (!ext) {
        return `${fallback}.jpg`;
    }
    return name;
};
const ensureFileSize = (buffer) => {
    if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error('图片超过10MB，请先压缩后再发布');
    }
};
const loadImageBuffer = async (src, index) => {
    if (isUnsupportedLocalSrc(src)) {
        throw new Error(`图片地址不合法：${explainUnsupportedSrc(src)}`);
    }
    if (isDataUrl(src)) {
        const { mime, base64 } = decodeDataUrl(src);
        const buffer = Buffer.from(base64, 'base64');
        ensureFileSize(buffer);
        const filename = `image-${index}.${extensionFromMime(mime)}`;
        return { buffer, filename };
    }
    const response = await http.get(src, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    ensureFileSize(buffer);
    let filename = `image-${index}.jpg`;
    try {
        const url = new URL(src);
        const base = node_path_1.default.basename(url.pathname) || filename;
        filename = normalizeFilename(base, `image-${index}`);
    }
    catch {
        filename = `image-${index}.jpg`;
    }
    return { buffer, filename };
};
exports.loadImageBuffer = loadImageBuffer;
const parseUploadPayload = (image, filename) => {
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
exports.parseUploadPayload = parseUploadPayload;
exports.MAX_IMAGE_BYTES = MAX_IMAGE_SIZE;
