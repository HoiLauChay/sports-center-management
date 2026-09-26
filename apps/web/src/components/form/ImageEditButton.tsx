import { IMAGE_CONTENT_TYPES, type UploadPurpose } from '@sports-center/shared';
import { App, Dropdown, Spin, Tooltip } from 'antd';
import { ImageUp, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useCroppedUpload } from '~/hooks/useCroppedUpload';
import { toApiError } from '~/lib/http-errors';
import type { CropOptions } from './ImageCropModal';
import './image-edit-button.css';

interface ImageEditButtonProps {
  purpose: UploadPurpose;
  crop: CropOptions;
  hasImage: boolean;
  noun: string;
  onChange: (url: string | null) => Promise<unknown>;
  className?: string;
}

export function ImageEditButton({ purpose, crop, hasImage, noun, onChange, className }: ImageEditButtonProps) {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { pick, uploading, modal } = useCroppedUpload(purpose, crop, onChange);
  const busy = uploading || removing;

  const openPicker = () => inputRef.current?.click();
  const remove = async () => {
    setRemoving(true);
    try {
      await onChange(null);
    } catch (err) {
      message.error(toApiError(err).message);
    } finally {
      setRemoving(false);
    }
  };

  const button = (
    <button
      type="button"
      aria-label={`Sửa ${noun}`}
      disabled={busy}
      onClick={hasImage ? undefined : openPicker}
      className={`sc-image-edit${className ? ` ${className}` : ''}${menuOpen || busy ? ' is-active' : ''}`}
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
              if (key === 'remove') void remove();
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
