import { UPLOAD_RULES, type ApiResponse, type UploadPurpose, type UploadTicket } from '@sports-center/shared';
import { privateApi } from './http';

const BLOB_API_VERSION = '12';

const MB = 1024 * 1024;

const TYPE_LABEL: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'application/pdf': 'PDF',
};

export function describeUpload(purpose: UploadPurpose) {
  const { contentTypes, maxSize } = UPLOAD_RULES[purpose];
  const labels = contentTypes.map((type) => TYPE_LABEL[type] ?? type);
  return {
    accept: contentTypes.join(','),
    noun: contentTypes.every((type) => type.startsWith('image/')) ? 'ảnh' : 'file',
    types: labels.length > 1 ? `${labels.slice(0, -1).join(', ')} hoặc ${labels.at(-1)}` : (labels[0] ?? ''),
    maxSizeMb: maxSize / MB,
  };
}

export function validateUploadFile(file: File, purpose: UploadPurpose, { checkSize = true } = {}) {
  const { noun, types, maxSizeMb } = describeUpload(purpose);
  if (!UPLOAD_RULES[purpose].contentTypes.includes(file.type)) return `Chỉ hỗ trợ ${noun} ${types}`;
  if (checkSize && file.size > maxSizeMb * MB) return `Dung lượng ${noun} tối đa ${maxSizeMb} MB`;
  return null;
}

export async function uploadFile(file: File, purpose: UploadPurpose) {
  const { data } = await privateApi.post<ApiResponse<UploadTicket>>('/uploads/token', {
    purpose,
    contentType: file.type,
    size: file.size,
  });
  const { uploadUrl, fileUrl } = data.result;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'x-api-version': BLOB_API_VERSION,
      'x-vercel-blob-access': 'public',
      'x-content-type': file.type,
    },
  });
  if (!res.ok) throw new Error('Tải ảnh lên thất bại, vui lòng thử lại.');

  return fileUrl;
}
