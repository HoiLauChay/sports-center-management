import { AVATAR_MAX_DIMENSION, COVER_ASPECT_RATIO, COVER_MAX_WIDTH } from '@sports-center/shared';
import type { CropOptions } from '~/components/form/ImageCropModal';

export const CROP_PRESETS = {
  avatar: {
    title: 'Cắt ảnh đại diện',
    aspect: 1,
    shape: 'round',
    maxWidth: AVATAR_MAX_DIMENSION,
    fileName: 'avatar.jpg',
  },
  cover: {
    title: 'Cắt ảnh bìa',
    aspect: COVER_ASPECT_RATIO,
    shape: 'rect',
    maxWidth: COVER_MAX_WIDTH,
    visibleAspect: 4,
    visibleHint: 'Phần tối phía trên và dưới có thể bị cắt khi xem trên máy tính, hãy để nội dung chính ở giữa.',
    fileName: 'cover.jpg',
  },
} satisfies Record<string, CropOptions>;
