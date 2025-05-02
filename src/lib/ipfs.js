// lib/ipfs.js
import { create } from 'ipfs-http-client';

// Cấu hình IPFS client với fallback
let client = null;
let clientConfig = {};

// Lưu cache cho các file đã tải xuống (cid -> blob)
const fileCache = new Map();

// Timeout cho các thao tác IPFS (ms)
const TIMEOUT_MS = 30000;

// Giới hạn kích thước file (50MB)
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Khởi tạo IPFS client với ưu tiên Infura rồi fallback local
 */
async function initIPFSClient() {
  if (client) return client;

  // Lấy credentials từ ENV
  const projectId = import.meta.env.VITE_INFURA_PROJECT_ID;
  const projectSecret = import.meta.env.VITE_INFURA_PROJECT_SECRET;

  // Nếu có credentials, thử Infura
  if (projectId && projectSecret) {
    try {
      const auth = 'Basic ' + btoa(`${projectId}:${projectSecret}`);
      clientConfig = {
        host: 'ipfs.infura.io',
        port: 5001,
        protocol: 'https',
        headers: { authorization: auth }
      };
      client = create(clientConfig);
      // Kiểm tra kết nối Infura
      await testConnection();
      console.log('Using Infura IPFS');
      return client;
    } catch (err) {
      console.warn('Infura IPFS thất bại, fallback sang node local:', err.message);
      // không throw, tiếp tục fallback
    }
  }

  // Fallback: local IPFS daemon
  clientConfig = { url: 'http://127.0.0.1:5001/api/v0' };
  client = create(clientConfig);
  try {
    await testConnection();
    console.log('Using local IPFS daemon');
    return client;
  } catch (err) {
    console.error('Local IPFS daemon không kết nối được:', err.message);
    throw new Error(`Không thể kết nối tới IPFS: ${err.message}`);
  }
}

/**
 * Kiểm tra kết nối đến IPFS node
 */
async function testConnection() {
  try {
    const { id } = await client.id();
    console.log(`Connected to IPFS node: ${id}`);
  } catch (err) {
    console.error('IPFS connection test failed:', err.message);
    throw new Error('Không thể kết nối tới IPFS node');
  }
}

/**
 * Validate file trước khi upload
 */
export function validateFile(file) {
  if (!file) {
    return 'Không có file được chọn';
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File quá lớn (${formatFileSize(file.size)}). Giới hạn là ${formatFileSize(MAX_FILE_SIZE)}`;
  }
  return null;
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Upload file to IPFS
 */
export async function uploadFile(file, onProgress) {
  try {
    const validationError = validateFile(file);
    if (validationError) throw new Error(validationError);
    const ipfs = await initIPFSClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    if (onProgress) onProgress(0);
    const result = await ipfs.add(file, {
      signal: controller.signal,
      progress: (prog) => {
        if (onProgress) {
          const pct = Math.round((prog / file.size) * 100);
          onProgress(pct);
        }
      }
    });
    clearTimeout(timeoutId);
    if (onProgress) onProgress(100);
    return { cid: result.cid.toString(), size: file.size };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Tải lên quá thời gian. Vui lòng thử lại với file nhỏ hơn.');
    }
    console.error('IPFS upload error:', err.message);
    throw new Error(`Lỗi khi tải lên IPFS: ${err.message}`);
  }
}

/**
 * Download file from IPFS
 */
export async function downloadFile(cid, onProgress) {
  try {
    if (fileCache.has(cid)) {
      if (onProgress) onProgress(100);
      return fileCache.get(cid);
    }
    const ipfs = await initIPFSClient();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    if (onProgress) onProgress(0);
    let total = 0, received = 0;
    const chunks = [];
    try {
      const stats = await ipfs.files.stat(`/ipfs/${cid}`);
      total = stats.size;
    } catch {}
    for await (const chunk of ipfs.cat(cid, { signal: controller.signal })) {
      chunks.push(chunk);
      received += chunk.length;
      if (onProgress && total) {
        onProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }
    clearTimeout(timeoutId);
    const blob = new Blob(chunks);
    if (blob.size < 10 * 1024 * 1024) fileCache.set(cid, blob);
    if (onProgress) onProgress(100);
    return blob;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Tải xuống quá thời gian. Vui lòng thử lại sau.');
    console.error('IPFS download error:', err.message);
    throw new Error(`Lỗi khi tải xuống IPFS: ${err.message}`);
  }
}

/** Clear cache */
export function clearFileCache() { fileCache.clear(); }

/** Get file type and icon */
export function getFileType(filename, mimeType = '') {
  const result = { isImage: false, isVideo: false, isAudio: false, isPdf: false, icon: '📄' };
  if (mimeType.startsWith('image/')) { result.isImage = true; result.icon='🖼️'; }
  else if (mimeType.startsWith('video/')) { result.isVideo = true; result.icon='🎬'; }
  else if (mimeType.startsWith('audio/')) { result.isAudio=true; result.icon='🎵'; }
  else if (mimeType==='application/pdf') { result.isPdf=true; result.icon='📕'; }
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'].includes(ext)) { result.isImage=true; result.icon='🖼️'; }
  else if (['.mp4','.webm','.ogg','.mov','.avi'].includes(ext)) { result.isVideo=true; result.icon='🎬'; }
  else if (['.mp3','.wav','.ogg','.m4a'].includes(ext)) { result.isAudio=true; result.icon='🎵'; }
  else if (ext==='.pdf') { result.isPdf=true; result.icon='📕'; }
  return result;
}

export default { uploadFile, downloadFile, validateFile, clearFileCache, getFileType, formatFileSize, MAX_FILE_SIZE };
