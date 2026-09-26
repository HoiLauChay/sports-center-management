import { IMAGE_CONTENT_TYPES, type UpdateMeBody, type UploadPurpose } from '@sports-center/shared';
import { App, Dropdown, Spin, Tooltip } from 'antd';
import { ImageUp, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CropOptions } from '~/components/form/ImageCropModal';
import { useCroppedUpload } from '~/hooks/useCroppedUpload';
import { toApiError } from '~/lib/http-errors';
import { useSaveProfile } from '../hooks/useProfile';

interface ImageEditButtonProps {
  purpose: UploadPurpose;
  crop: CropOptions;
  hasImage: boolean;
  toPatch: (url: string | null) => UpdateMeBody;
  noun: string;
  className: string;
}

export function ImageEditButton({ purpose, crop, hasImage, toPatch, noun, className }: ImageEditButtonProps) {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const update = useSaveProfile();
  const { pick, uploading, modal } = useCroppedUpload(purpose, crop, (url) => update.mutateAsync(toPatch(url)));
  const busy = uploading || update.isPending;

  const openPicker = () => inputRef.current?.click();
  const remove = () => update.mutate(toPatch(null), { onError: (err) => message.error(toApiError(err).message) });

  const button = (
    <button
      type="button"
      aria-label={`Sửa ${noun}`}
      disabled={busy}
      onClick={hasImage ? undefined : openPicker}
      className={`sc-image-edit ${className}${menuOpen || busy ? ' is-active' : ''}`}
    >
      {busy ? <Spin size="small" /> : <Pencil size={16} />}
    </button>
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={IMAGE_CONTENT_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) pick(file);
        }}
      />
      {hasImage ? (
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          open={menuOpen}
          onOpenChange={setMenuOpen}
          menu={{
            items: [
              { key: 'change', icon: <ImageUp size={15} />, label: `Đổi ${noun}` },
              { key: 'remove', icon: <Trash2 size={15} />, label: `Xóa ${noun}`, danger: true },
            ],
            onClick: ({ key }) => {
              setMenuOpen(false);
              if (key === 'change') openPicker();
              if (key === 'remove') remove();
            },
          }}
        >
          {button}
        </Dropdown>
      ) : (
        <Tooltip title={`Thêm ${noun}`}>{button}</Tooltip>
      )}
      {modal}
    </>
  );
}
