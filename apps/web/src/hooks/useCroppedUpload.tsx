import type { UploadPurpose } from '@sports-center/shared';
import { App } from 'antd';
import { useState } from 'react';
import { ImageCropModal, type CropOptions } from '~/components/form/ImageCropModal';
import { toApiError } from '~/lib/http-errors';
import { uploadFile, validateUploadFile } from '~/lib/upload';

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
