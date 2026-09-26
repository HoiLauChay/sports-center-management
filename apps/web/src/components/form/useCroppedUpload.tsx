import { AVATAR_MAX_DIMENSION, COVER_ASPECT_RATIO, COVER_MAX_WIDTH, type UploadPurpose } from '@sports-center/shared';
import { App } from 'antd';
import { useState } from 'react';
import { toApiError } from '~/lib/http-errors';
import { uploadFile, validateUploadFile } from '~/lib/upload';
import { ImageCropModal, type CropOptions } from './ImageCropModal';

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

export function useCroppedUpload(purpose: UploadPurpose, options: CropOptions, onUploaded: (url: string) => unknown) {
  const { message } = App.useApp();
  const [cropping, setCropping] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const pick = (file: File) => {
    const error = validateUploadFile(file, purpose, { checkSize: false });
    if (error) message.error(error);
    else setCropping(file);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await onUploaded(await uploadFile(file, purpose));
      setCropping(null);
    } catch (err) {
      message.error(toApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const modal = cropping && (
    <ImageCropModal
      key={`${cropping.name}-${cropping.lastModified}-${cropping.size}`}
      file={cropping}
      options={options}
      confirming={uploading}
      onCancel={() => setCropping(null)}
      onConfirm={(cropped) => void upload(cropped)}
    />
  );

  return { pick, uploading, modal };
}
