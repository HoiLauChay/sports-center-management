import type { UploadPurpose } from '@sports-center/shared';
import { App } from 'antd';
import { useState } from 'react';
import { FileDropModal } from '~/components/form/FileDropModal';
import { ImageCropModal, type CropOptions } from '~/components/form/ImageCropModal';
import { toApiError } from '~/lib/http-errors';
import { uploadFile } from '~/lib/upload';

export function useCroppedUpload(
  purpose: UploadPurpose,
  options: CropOptions,
  onUploaded: (url: string) => unknown,
  title = 'Chọn ảnh',
) {
  const { message } = App.useApp();
  const [picking, setPicking] = useState(false);
  const [cropping, setCropping] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const select = (file: File) => {
    setPicking(false);
    setCropping(file);
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

  const modal = (
    <>
      <FileDropModal
        open={picking}
        title={title}
        purpose={purpose}
        checkSize={false}
        onSelect={select}
        onCancel={() => setPicking(false)}
      />
      {cropping && (
        <ImageCropModal
          key={`${cropping.name}-${cropping.lastModified}-${cropping.size}`}
          file={cropping}
          options={options}
          confirming={uploading}
          onCancel={() => setCropping(null)}
          onConfirm={(cropped) => void upload(cropped)}
        />
      )}
    </>
  );

  return { open: () => setPicking(true), uploading, modal };
}
