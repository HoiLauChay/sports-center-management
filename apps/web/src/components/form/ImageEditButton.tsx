import { IMAGE_CONTENT_TYPES, type UploadPurpose } from '@sports-center/shared';
import { App, Dropdown, Spin, Tooltip } from 'antd';
import { ImageUp, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useCroppedUpload } from '~/hooks/useCroppedUpload';
import { toApiError } from '~/lib/http-errors';
import type { CropOptions } from './ImageCropModal';

interface ImageEditButtonProps {
  purpose: UploadPurpose;
  crop: CropOptions;
  hasImage: boolean;
  noun: string;
  onChange: (url: string | null) => Promise<unknown>;
  small?: boolean;
  alwaysVisible?: boolean;
  className?: string;
}

export function ImageEditButton({
  purpose,
  crop,
  hasImage,
  noun,
  onChange,
  small = false,
  alwaysVisible = false,
  className,
}: ImageEditButtonProps) {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { pick, uploading, modal } = useCroppedUpload(purpose, crop, onChange);
  const busy = uploading || removing;
  const visible = alwaysVisible || menuOpen || busy;

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
      className={`absolute z-1 flex cursor-pointer items-center justify-center rounded-[999px] bg-[rgba(255,255,255,0.92)] text-sc-ink [box-shadow:0_2px_10px_rgba(20,19,15,0.22)] [transition:opacity_0.15s,transform_0.15s,background_0.15s] hover:bg-white disabled:cursor-default ${small ? 'size-8 border-2 border-sc-surface' : 'size-9 [border:none]'} ${visible ? 'opacity-100 [transform:scale(1)]' : 'opacity-0 [transform:scale(0.9)] group-hover/image-edit:opacity-100 group-hover/image-edit:[transform:scale(1)] focus-visible:opacity-100 focus-visible:[transform:scale(1)] [@media(hover:none)]:opacity-100 [@media(hover:none)]:[transform:none]'}${className ? ` ${className}` : ''}`}
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
