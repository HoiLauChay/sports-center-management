import { IMAGE_CONTENT_TYPES, type UploadPurpose } from '@sports-center/shared';
import { Avatar, Button, Upload } from 'antd';
import { ImageUp, Trash2 } from 'lucide-react';
import { CROP_PRESETS, useCroppedUpload } from './useCroppedUpload';

interface ImageUploadFieldProps {
  purpose: UploadPurpose;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  variant?: 'avatar' | 'cover';
  fallback?: string;
  invalid?: boolean;
}

export function ImageUploadField({
  purpose,
  value,
  onChange,
  variant = 'avatar',
  fallback,
  invalid,
}: ImageUploadFieldProps) {
  const { pick, uploading, modal } = useCroppedUpload(purpose, CROP_PRESETS[variant], onChange);

  const preview =
    variant === 'avatar' ? (
      <Avatar src={value || undefined} size={72} className="!shrink-0 !bg-sc-primary !text-2xl">
        {fallback}
      </Avatar>
    ) : (
      <div
        className={`flex aspect-[3/1] w-full max-w-md items-center justify-center overflow-hidden rounded-md border border-dashed bg-sc-paper text-sm text-sc-muted ${invalid ? 'border-red-400' : 'border-sc-line'}`}
      >
        {value ? <img src={value} alt="Ảnh bìa" className="h-full w-full object-cover" /> : 'Chưa có ảnh bìa'}
      </div>
    );

  return (
    <div className={variant === 'avatar' ? 'flex items-center gap-4' : 'flex flex-col gap-3'}>
      {preview}
      <div className="flex flex-wrap gap-2">
        <Upload
          accept={IMAGE_CONTENT_TYPES.join(',')}
          showUploadList={false}
          disabled={uploading}
          beforeUpload={(file) => {
            pick(file);
            return false;
          }}
        >
          <Button icon={<ImageUp size={16} />} loading={uploading}>
            {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
        </Upload>
        {value && (
          <Button icon={<Trash2 size={16} />} onClick={() => onChange(null)} disabled={uploading}>
            Xóa ảnh
          </Button>
        )}
      </div>
      {modal}
    </div>
  );
}
