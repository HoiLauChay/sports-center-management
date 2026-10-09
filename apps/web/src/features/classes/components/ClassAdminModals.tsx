import { Alert, Form, Input, InputNumber, Modal, Select } from 'antd';
import { useEffect } from 'react';
import { useAssignCoach, useCancelClass, useCoachPool, useUpdateClass } from '../hooks/useClassAdmin';
import type { ClassAdminDetail } from '../types';

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
