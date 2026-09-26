import type { UploadPurpose } from '@sports-center/shared';
import { Avatar, Button } from 'antd';
import { ImageUp, Trash2 } from 'lucide-react';
import { CROP_PRESETS } from '~/constants/crop';
import { useCroppedUpload } from '~/hooks/useCroppedUpload';

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
  const { open, uploading, modal } = useCroppedUpload(
    purpose,
    CROP_PRESETS[variant],
    onChange,
    variant === 'avatar' ? 'Chọn ảnh đại diện' : 'Chọn ảnh bìa',
  );

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
        <Button icon={<ImageUp size={16} />} loading={uploading} onClick={open}>
          {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
        </Button>
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
