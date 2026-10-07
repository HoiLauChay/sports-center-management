import { useQuery } from '@tanstack/react-query';
import { Alert, DatePicker, Form, Input, InputNumber, Modal, Select, Spin } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo } from 'react';
import { facilitiesQueryOptions } from '~/features/catalog/hooks/useCatalog';
import { useSettings } from '~/features/settings';
import { formatVND } from '~/lib/format';
import { DATE_FORMAT, formatDayLabel, slotGrid, todayVN } from '~/lib/time';
import {
  useAssignCoach,
  useCancelClass,
  useClassRefundPreview,
  useCoachPool,
  useUpdateClass,
  useUpdateSession,
} from '../hooks/useClassAdmin';
import type { ClassAdminDetail, ClassSession } from '../types';

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
          <Input maxLength={120} />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="minStudents" label="Sĩ số tối thiểu" rules={[{ required: true, message: 'Bắt buộc' }]}>
            <InputNumber min={1} className="!w-full" />
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
            <InputNumber min={1} className="!w-full" />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}

function RefundNote({ loading, students, amount }: { loading: boolean; students?: number; amount?: number }) {
  if (loading) return <Spin size="small" />;
  if (students === undefined || amount === undefined) return null;
  return (
    <Alert
      type={amount > 0 ? 'warning' : 'info'}
      showIcon
      title={
        amount > 0
          ? `${students} học viên đang học, hệ thống sẽ hoàn tổng cộng ${formatVND(amount)} về ví.`
          : `${students} học viên đang học, không có khoản nào cần hoàn.`
      }
    />
  );
}

export function CancelClassModal({ open, item, onClose }: ModalProps) {
  const [form] = Form.useForm<{ reason: string }>();
  const preview = useClassRefundPreview(item.id, open);
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
        <RefundNote loading={preview.isPending} students={preview.data?.students} amount={preview.data?.amount} />
        <Form form={form} layout="vertical" onFinish={({ reason }) => cancel.mutate(reason, { onSuccess: onClose })}>
          <Form.Item
            name="reason"
            label="Lý do hủy lớp"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}

interface SessionModalProps {
  open: boolean;
  item: ClassAdminDetail;
  session: ClassSession | null;
  onClose: () => void;
}

export function EditSessionModal({ open, item, session, onClose }: SessionModalProps) {
  const [form] = Form.useForm<{ date: dayjs.Dayjs; startTime: string; endTime: string; facilityId: string }>();
  const update = useUpdateSession(item.id);
  const settings = useSettings();
  const facilities = useQuery(facilitiesQueryOptions);

  const grid = useMemo(
    () =>
      settings.data ? slotGrid(settings.data.openTime, settings.data.closeTime, settings.data.slotDurationMinutes) : [],
    [settings.data],
  );
  const facilityOptions = (facilities.data ?? [])
    .filter((entry) => entry.isActive && entry.sports.some((sport) => sport.id === item.course.sport.id))
    .map((entry) => ({ value: entry.id, label: entry.name }));

  useEffect(() => {
    if (open && session) {
      form.setFieldsValue({
        date: dayjs(session.date),
        startTime: session.startTime,
        endTime: session.endTime,
        facilityId: session.facility.id,
      });
    }
  }, [open, session, form]);

  return (
    <Modal
      title={session ? `Sửa buổi ${session.sessionNumber} · ${formatDayLabel(session.date)}` : 'Sửa buổi học'}
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
        className="!mt-4"
        onFinish={(values) =>
          session &&
          update.mutate(
            {
              sessionId: session.id,
              patch: {
                date: values.date.format(DATE_FORMAT),
                startTime: values.startTime,
                endTime: values.endTime,
                facilityId: values.facilityId,
              },
            },
            { onSuccess: onClose },
          )
        }
      >
        <Form.Item name="date" label="Ngày" rules={[{ required: true, message: 'Chọn ngày' }]}>
          <DatePicker
            format="DD/MM/YYYY"
            className="!w-full"
            disabledDate={(day) => day.format(DATE_FORMAT) < todayVN()}
          />
        </Form.Item>
        <div className="grid grid-cols-2 gap-4">
          <Form.Item name="startTime" label="Giờ bắt đầu" rules={[{ required: true, message: 'Chọn giờ' }]}>
            <Select options={grid.map((slot) => ({ value: slot.startTime, label: slot.startTime }))} />
          </Form.Item>
          <Form.Item name="endTime" label="Giờ kết thúc" rules={[{ required: true, message: 'Chọn giờ' }]}>
            <Select options={grid.map((slot) => ({ value: slot.endTime, label: slot.endTime }))} />
          </Form.Item>
        </div>
        <Form.Item name="facilityId" label="Sân / phòng" rules={[{ required: true, message: 'Chọn sân / phòng' }]}>
          <Select loading={facilities.isPending} options={facilityOptions} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function AssignCoachModal({ open, item, onClose }: ModalProps) {
  const [form] = Form.useForm<{ coachId: string }>();
  const pool = useCoachPool();
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
