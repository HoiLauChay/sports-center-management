import { UPLOAD_RULES, type ApiResponse, type UploadPurpose, type UploadTicket } from '@sports-center/shared';
import { privateApi } from './http';

const BLOB_API_VERSION = '12';

export function validateUploadFile(file: File, purpose: UploadPurpose, { checkSize = true } = {}) {
  const rule = UPLOAD_RULES[purpose];
  if (!rule.contentTypes.includes(file.type)) return 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP';
  if (checkSize && file.size > rule.maxSize) return `Ảnh tối đa ${rule.maxSize / (1024 * 1024)} MB`;
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
