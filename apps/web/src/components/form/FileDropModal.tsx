import type { UploadPurpose } from '@sports-center/shared';
import { App, Modal, Upload } from 'antd';
import { FileUp, ImageUp } from 'lucide-react';
import { describeUpload, validateUploadFile } from '~/lib/upload';

interface FileDropModalProps {
  open: boolean;
  title: string;
  purpose: UploadPurpose;
  checkSize?: boolean;
  onSelect: (file: File) => void;
  onCancel: () => void;
}

export function FileDropModal({ open, title, purpose, checkSize = true, onSelect, onCancel }: FileDropModalProps) {
  const { message } = App.useApp();
  const { accept, noun, types, maxSizeMb } = describeUpload(purpose);
  const Icon = noun === 'ảnh' ? ImageUp : FileUp;

  return (
    <Modal open={open} title={title} footer={null} centered destroyOnHidden width={480} onCancel={onCancel}>
      <Upload.Dragger
        accept={{ format: accept, filter: 'native' }}
        multiple={false}
        showUploadList={false}
        beforeUpload={(file) => {
          const error = validateUploadFile(file, purpose, { checkSize });
          if (error) message.error(error);
          else onSelect(file);
          return Upload.LIST_IGNORE;
        }}
        className="mt-2 block"
      >
        <div className="flex flex-col items-center gap-2 px-6 py-6">
          <span className="flex size-12 items-center justify-center rounded-[999px] bg-sc-primary-soft text-sc-primary">
            <Icon size={22} />
          </span>
          <span className="mt-1 text-[15px] font-semibold text-sc-ink">Kéo thả {noun} vào đây</span>
          <span className="text-sm text-sc-muted">
            hoặc <span className="font-semibold text-sc-primary">bấm để chọn từ máy</span>
          </span>
          <span className="mt-1 text-xs text-sc-muted-2">
            {types}
            {checkSize && ` · tối đa ${maxSizeMb} MB`}
          </span>
        </div>
      </Upload.Dragger>
    </Modal>
  );
}
