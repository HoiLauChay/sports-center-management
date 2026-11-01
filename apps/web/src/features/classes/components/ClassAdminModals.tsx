import { Alert, Button, Form, Input, InputNumber, Modal, Select } from 'antd';
import { CalendarDays, MapPin, UserCheck, Users } from 'lucide-react';
import { useEffect } from 'react';
import { SportTag } from '~/components/ui/SportTag';
import { useAssignCoach, useCancelClass, useCoachPool, useUpdateClass } from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSummary } from '../types';
import { classDateRange, weeklyText } from '../utils';

interface ModalProps {
  open: boolean;
  item: ClassAdminDetail;
  onClose: () => void;
}

export function EditClassModal({ open, item, onClose }: ModalProps) {
  const [form] = Form.useForm<{ name: string; minStudents: number; maxStudents: number }>();
  const update = useUpdateClass(item.id);

  useEffect(() => {
    if (open) form.setFieldsValue({ name: item.name, minStudents: item.minStudents, maxStudents: item.maxStudents });
  }, [open, item, form]);

  return (
    <Modal
      title="Sửa thông tin lớp"
      open={open}
      centered
      destroyOnHidden
      okText="Lưu"
      cancelText="Đóng"
      confirmLoading={update.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => update.mutate(values, { onSuccess: onClose })}
        className="!mt-4"
      >
        <Form.Item
          name="name"
          label="Tên lớp"
          rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tên lớp' }]}
        >
          <Input maxLength={100} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="minStudents" label="Sĩ số tối thiểu" rules={[{ required: true, message: 'Bắt buộc' }]}>
            <InputNumber min={1} max={1000} precision={0} className="!w-full" />
          </Form.Item>
          <Form.Item
            name="maxStudents"
            label="Sĩ số tối đa"
            dependencies={['minStudents']}
            rules={[
              { required: true, message: 'Bắt buộc' },
              ({ getFieldValue }) => ({
                validator: (_, value: number | undefined) =>
                  value === undefined || value >= (getFieldValue('minStudents') as number)
                    ? Promise.resolve()
                    : Promise.reject(new Error('Không nhỏ hơn sĩ số tối thiểu')),
              }),
              () => ({
                validator: (_, value: number | undefined) =>
                  value === undefined || value >= item.enrolledCount
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Đã có ${item.enrolledCount} học viên`)),
              }),
            ]}
          >
            <InputNumber min={1} max={1000} precision={0} className="!w-full" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

export function CancelClassModal({ open, item, onClose }: ModalProps) {
  const [form] = Form.useForm<{ reason: string }>();
  const cancel = useCancelClass(item.id);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  return (
    <Modal
      title={`Hủy lớp "${item.name}"?`}
      open={open}
      centered
      destroyOnHidden
      okText="Hủy lớp"
      cancelText="Đóng"
      okButtonProps={{ danger: true }}
      confirmLoading={cancel.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <div className="flex flex-col gap-3">
        <Alert
          type={item.enrolledCount > 0 ? 'warning' : 'info'}
          showIcon
          title={
            item.enrolledCount > 0
              ? `${item.enrolledCount} học viên đang học được hoàn trọn số tiền đã trả về ví.`
              : 'Lớp chưa có học viên, không có khoản nào cần hoàn.'
          }
        />
        <Form form={form} layout="vertical" onFinish={({ reason }) => cancel.mutate(reason, { onSuccess: onClose })}>
          <Form.Item
            name="reason"
            label="Lý do hủy lớp"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}

export function AssignCoachModal({ open, item, onClose }: ModalProps) {
  const [form] = Form.useForm<{ coachId: string }>();
  const pool = useCoachPool(item.course.sport.id, open);
  const assign = useAssignCoach(item.id);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  return (
    <Modal
      title="Phân công HLV trực tiếp"
      open={open}
      centered
      destroyOnHidden
      okText="Phân công"
      cancelText="Đóng"
      confirmLoading={assign.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <Form
        form={form}
        layout="vertical"
        className="!mt-4"
        onFinish={({ coachId }) => assign.mutate({ coachId }, { onSuccess: onClose })}
      >
        <Form.Item name="coachId" label="Huấn luyện viên" rules={[{ required: true, message: 'Chọn HLV' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            loading={pool.isPending}
            placeholder="Chọn HLV"
            options={(pool.data ?? []).map((coach) => ({
              value: coach.id,
              label: coach.fullName,
              disabled: coach.id === item.coach?.id,
            }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

const APPROVE_NOTE_PRESETS = [
  'Đã kiểm tra lịch sân và phê duyệt mở lớp.',
  'Hồ sơ lớp hợp lệ, sẵn sàng mở đăng ký học viên.',
] as const;

const REJECT_NOTE_PRESETS = [
  'Khung giờ đề xuất trùng giờ cao điểm đặt sân lẻ.',
  'Cần điều chỉnh lại ngày khai giảng và lịch tuần.',
  'Đề xuất rà soát lại quy mô sĩ số tối thiểu/tối đa.',
  'Tạm hoãn mở lớp mới cho khóa học này trong kỳ hiện tại.',
] as const;

interface ReviewClassModalProps {
  open: boolean;
  mode: 'approve' | 'reject';
  item: ClassSummary | null;
  loading?: boolean;
  onConfirm: (note?: string) => void;
  onClose: () => void;
}

/** Modal for managers to approve or reject a `PENDING_APPROVAL` class with an optional review note for the coach. */
export function ReviewClassModal({ open, mode, item, loading, onConfirm, onClose }: ReviewClassModalProps) {
  const [form] = Form.useForm<{ note?: string }>();
  const isApprove = mode === 'approve';
  const presets = isApprove ? APPROVE_NOTE_PRESETS : REJECT_NOTE_PRESETS;

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, mode, item?.id, form]);

  return (
    <Modal
      title={isApprove ? `Duyệt mở lớp "${item?.name ?? ''}"?` : `Từ chối mở lớp "${item?.name ?? ''}"?`}
      open={open && item !== null}
      centered
      destroyOnHidden
      width={540}
      okText={isApprove ? 'Duyệt mở lớp' : 'Từ chối mở lớp'}
      cancelText="Đóng"
      okButtonProps={{ danger: !isApprove }}
      confirmLoading={loading}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      {item && (
        <div className="mt-3 flex flex-col gap-3.5">
          <div className="rounded-xl border border-sc-border-soft bg-sc-paper/60 p-3.5 text-[14px]">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <SportTag name={item.course.sport.name} />
              <span className="font-semibold text-sc-ink">{item.course.name}</span>
            </div>
            <div className="grid gap-1.5 text-[13.5px] text-sc-ink-2 sm:grid-cols-2">
              <span className="inline-flex items-center gap-1.5">
                <UserCheck size={14} className="shrink-0 text-sc-primary" />
                HLV: <b className="truncate">{item.coach?.fullName ?? 'Chưa phân công'}</b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-sc-primary" />
                Sân: <b className="truncate">{item.facility.name}</b>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} className="shrink-0 text-sc-primary" />
                {weeklyText(item.weeklySchedule)} ({classDateRange(item)})
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} className="shrink-0 text-sc-primary" />
                Sĩ số: {item.minStudents}–{item.maxStudents} học viên
              </span>
            </div>
          </div>

          <Alert
            type={isApprove ? 'info' : 'warning'}
            showIcon
            title={
              isApprove
                ? 'Lớp chuyển sang trạng thái Đang mở, bắt đầu nhận đăng ký và gửi thông báo cho huấn luyện viên.'
                : 'Lớp trở về trạng thái Nháp, gỡ huấn luyện viên hiện tại và gửi thông báo kèm ghi chú phản hồi.'
            }
          />

          <Form form={form} layout="vertical" onFinish={({ note }) => onConfirm(note?.trim() || undefined)}>
            <Form.Item
              name="note"
              className="!mb-2"
              label={isApprove ? 'Ghi chú duyệt lớp (không bắt buộc)' : 'Lý do / ghi chú phản hồi cho HLV'}
              rules={[{ max: 500, message: 'Ghi chú tối đa 500 ký tự' }]}
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder={
                  isApprove
                    ? 'Nhập lời nhắn hoặc lưu ý vận hành gửi tới huấn luyện viên (nếu có)...'
                    : 'Nhập lý do từ chối hoặc đề xuất điều chỉnh để huấn luyện viên nắm rõ...'
                }
              />
            </Form.Item>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[12.5px] text-sc-muted">Gợi ý nhanh:</span>
              {presets.map((preset) => (
                <Button
                  key={preset}
                  size="small"
                  type="dashed"
                  className="!h-auto !px-2 !py-0.5 !text-[12.5px]"
                  onClick={() => form.setFieldsValue({ note: preset })}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </Form>
        </div>
      )}
    </Modal>
  );
}
