import {
  ERROR_CODE,
  UPLOAD_RULES,
  type CreateUploadBody,
  type UploadPurpose,
  type UploadTicket,
} from '@sports-center/shared';
import { issueSignedToken, presignUrl } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

import { env } from '~/configs/env';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { ErrorWithStatus } from '~/rules/error';

const UPLOAD_URL_TTL_MS = 10 * 60 * 1000;

const FOLDER: Record<UploadPurpose, string> = {
  AVATAR: 'avatars',
  COVER_IMAGE: 'covers',
  SESSION_ATTACHMENT: 'session-attachments',
  COURSE_THUMBNAIL: 'course-thumbnails',
  SPORT_ICON: 'sport-icons',
};

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/;

const blobStoreUrl = () => {
  const storeId = env.BLOB_READ_WRITE_TOKEN?.split('_')[3];
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com` : null;
};

class UploadService {
  createUploadUrl = async (
    user: { id: string; role: Role },
    { purpose, contentType, size }: CreateUploadBody,
  ): Promise<UploadTicket> => {
    const rule = UPLOAD_RULES[purpose];
    if (!rule.roles.includes(user.role)) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.FORBIDDEN,
        code: ERROR_CODE.FORBIDDEN,
        message: 'Bạn không có quyền tải lên loại file này',
      });
    }
    if (!env.BLOB_READ_WRITE_TOKEN) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code: ERROR_CODE.INTERNAL,
        message: 'Chưa cấu hình lưu trữ file',
      });
    }

    const pathname = `${FOLDER[purpose]}/${user.id}/${randomUUID()}.${EXTENSION[contentType]}`;
    const constraints = {
      validUntil: Date.now() + UPLOAD_URL_TTL_MS,
      allowedContentTypes: [contentType],
      maximumSizeInBytes: size,
    };

    const signedToken = await issueSignedToken({
      token: env.BLOB_READ_WRITE_TOKEN,
      pathname,
      operations: ['put'],
      ...constraints,
    });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: 'put',
      access: 'public',
      pathname,
      addRandomSuffix: false,
      allowOverwrite: false,
      ...constraints,
    });

    return { uploadUrl: presignedUrl, fileUrl: `${blobStoreUrl()}/${pathname}` };
  };

  isUploadedFileUrl = (url: string, purpose: UploadPurpose, accountId: string) => {
    const base = blobStoreUrl();
    if (!base) return false;
    const prefix = `${base}/${FOLDER[purpose]}/${accountId}/`;
    return url.startsWith(prefix) && FILE_NAME.test(url.slice(prefix.length));
  };
}

export default new UploadService();
