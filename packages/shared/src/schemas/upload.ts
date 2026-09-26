import { z } from 'zod';

import { UPLOAD_PURPOSES } from '../constants/enums';
import { UPLOAD_RULES } from '../constants/upload';

export const createUploadBodySchema = z
  .object({
    purpose: z.enum(UPLOAD_PURPOSES, 'Mục đích upload không hợp lệ'),
    contentType: z.string().trim().toLowerCase().min(1, 'Thiếu loại file'),
    size: z.number('Thiếu dung lượng file').int().positive('Dung lượng file không hợp lệ'),
  })
  .superRefine(({ purpose, contentType, size }, ctx) => {
    const rule = UPLOAD_RULES[purpose];
    if (!rule.contentTypes.includes(contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'Loại file không được hỗ trợ' });
    }
    if (size > rule.maxSize) {
      ctx.addIssue({
        code: 'custom',
        path: ['size'],
        message: `File tối đa ${rule.maxSize / (1024 * 1024)} MB`,
      });
    }
  });

export type CreateUploadBody = z.infer<typeof createUploadBodySchema>;
