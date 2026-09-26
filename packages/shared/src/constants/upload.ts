import type { Role, UploadPurpose } from './enums';

const MB = 1024 * 1024;

export const AVATAR_MAX_DIMENSION = 600;

export const COVER_ASPECT_RATIO = 3;
export const COVER_MAX_WIDTH = 1500;

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ATTACHMENT_CONTENT_TYPES = [...IMAGE_CONTENT_TYPES, 'application/pdf'] as const;

export const UPLOAD_RULES: Record<
  UploadPurpose,
  { contentTypes: readonly string[]; maxSize: number; roles: readonly Role[] }
> = {
  AVATAR: { contentTypes: IMAGE_CONTENT_TYPES, maxSize: 5 * MB, roles: ['MANAGER', 'COACH', 'MEMBER', 'RECEPTIONIST'] },
  COVER_IMAGE: { contentTypes: IMAGE_CONTENT_TYPES, maxSize: 5 * MB, roles: ['COACH'] },
  SESSION_ATTACHMENT: { contentTypes: ATTACHMENT_CONTENT_TYPES, maxSize: 20 * MB, roles: ['COACH'] },
  COURSE_THUMBNAIL: { contentTypes: IMAGE_CONTENT_TYPES, maxSize: 5 * MB, roles: ['MANAGER'] },
  SPORT_ICON: { contentTypes: IMAGE_CONTENT_TYPES, maxSize: 5 * MB, roles: ['MANAGER'] },
};
