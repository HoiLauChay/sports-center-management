import { SPECIALIZATION_MAX_CERTIFICATES, type CreateSpecializationInput } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import { Paperclip } from 'lucide-react';
import { useState } from 'react';
import { FileDropModal } from '~/components/form/FileDropModal';
import { sportsQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { describeApiError } from '~/lib/http-errors';
import { uploadFile } from '~/lib/upload';
import { useRegisterSpecialization } from '../hooks/useSpecializations';
import type { Specialization } from '../types';
import { CertificateList } from './EvidenceView';

interface RegisterModalProps {
  open: boolean;
  /** Sports with a pending or approved request: they cannot be requested again. */
  taken: Set<string>;
  /** A rejected request being sent again: its sport and evidence fill the form. */
  resend: Specialization | null;
  onClose: () => void;
}

type Values = Pick<CreateSpecializationInput, 'sportId' | 'experienceYears' | 'experienceNote'>;

/** A specialization request needs a description or at least one certificate before it can be sent (UC_1.13). */
export function RegisterModal({ open, taken, resend, onClose }: RegisterModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const sports = useQuery(sportsQueryOptions);
  const register = useRegisterSpecialization();
  const [certificates, setCertificates] = useState<string[]>(resend?.certificates ?? []);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const note = Form.useWatch('experienceNote', form) ?? '';
  const ready = note.trim().length > 0 || certificates.length > 0;

  const attach = async (file: File) => {
    setPicking(false);
    setUploading(true);
    try {
      const url = await uploadFile(file, 'CERTIFICATE');
      setCertificates((current) => [...current, url]);
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={resend ? `Gửi lại chuyên môn ${resend.sport.name}` : 'Đăng ký bộ môn chuyên môn'}
      open={open}
      centered
      destroyOnHidden
      okText="Gửi Quản lý duyệt"
      cancelText="Đóng"
      okButtonProps={{ disabled: !ready || uploading }}
      confirmLoading={register.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      {resend?.reviewNote && (
        <Alert type="error" showIcon className="!mt-4" title={`Lý do bị từ chối: ${resend.reviewNote}`} />
      )}
      <Form<Values>
        form={form}
        layout="vertical"
        className="!mt-4"
        initialValues={{
          sportId: resend?.sport.id,
          experienceYears: resend?.experienceYears ?? null,
          experienceNote: resend?.experienceNote ?? '',
        }}
        onFinish={(values) =>
          register.mutate(
            { ...values, experienceNote: values.experienceNote?.trim() || undefined, certificates },
            { onSuccess: onClose },
          )
        }
      >
        <Form.Item name="sportId" label="Bộ môn" rules={[{ required: true, message: 'Chọn bộ môn' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            placeholder="Chọn bộ môn"
            loading={sports.isPending}
            options={(sports.data ?? [])
              .filter((sport) => sport.isActive)
              .map((sport) => ({ value: sport.id, label: sport.name, disabled: taken.has(sport.id) }))}
          />
        </Form.Item>
        <Form.Item name="experienceYears" label="Số năm kinh nghiệm">
          <InputNumber min={0} max={60} precision={0} className="!w-40" />
        </Form.Item>
        <Form.Item name="experienceNote" label="Mô tả kinh nghiệm">
          <Input.TextArea rows={4} maxLength={1000} showCount />
        </Form.Item>
        <Form.Item label={`Chứng chỉ (${certificates.length}/${SPECIALIZATION_MAX_CERTIFICATES}, ảnh hoặc PDF)`}>
          <div className="flex flex-col items-start gap-2">
            <CertificateList
              urls={certificates}
              onRemove={(url) => setCertificates((current) => current.filter((entry) => entry !== url))}
            />
            {certificates.length < SPECIALIZATION_MAX_CERTIFICATES && (
              <Button size="small" loading={uploading} icon={<Paperclip size={14} />} onClick={() => setPicking(true)}>
                Thêm tệp
              </Button>
            )}
          </div>
        </Form.Item>
      </Form>
      <p className={`m-0 text-[13.5px] ${ready ? 'text-sc-muted-2' : 'text-sc-warning'}`}>
        Cần mô tả kinh nghiệm hoặc ít nhất một tệp chứng chỉ để gửi. Mỗi bộ môn chỉ có một yêu cầu đang chờ hoặc đã
        duyệt.
      </p>
      <FileDropModal
        open={picking}
        title="Thêm chứng chỉ"
        purpose="CERTIFICATE"
        onSelect={(file) => void attach(file)}
        onCancel={() => setPicking(false)}
      />
    </Modal>
  );
}
