import { Alert, Form, Input, Modal, Radio } from 'antd';
import { useState } from 'react';
import { formatDate } from '~/lib/format';
import type { useMyMemberships } from '../hooks/useMyMemberships';
import type { MemberMembership } from '../types';

type Choice = 'stop' | 'end';

interface EndMembershipModalProps {
  membership: MemberMembership;
  daysLeft: number;
  today: string;
  actions: Pick<ReturnType<typeof useMyMemberships>, 'cancel' | 'terminate'>;
  onClose: () => void;
}

export function EndMembershipModal({ membership, daysLeft, today, actions, onClose }: EndMembershipModalProps) {
  const [form] = Form.useForm<{ reason: string }>();
  const canStop = !membership.cancelledAt;
  const [choice, setChoice] = useState<Choice>(canStop ? 'stop' : 'end');
  const prepaid = membership.periods.filter(({ periodStart }) => periodStart > today);
  const pending = actions.cancel.isPending || actions.terminate.isPending;

  const options: { value: Choice; title: string; description: string; disabled?: boolean }[] = [
    {
      value: 'stop',
      title: 'Dừng gia hạn',
      description: canStop
        ? `Dùng tiếp quyền lợi đến ${formatDate(membership.endDate)}, sau đó gói tự kết thúc.`
        : 'Gói đã dừng gia hạn.',
      disabled: !canStop,
    },
    {
      value: 'end',
      title: 'Chấm dứt ngay',
      description: `Gói kết thúc hôm nay, mất ${daysLeft} ngày quyền lợi còn lại.`,
    },
  ];

  return (
    <Modal
      title="Hủy gói thành viên"
      open
      centered
      destroyOnHidden
      okText={choice === 'stop' ? 'Dừng gia hạn' : 'Chấm dứt gói'}
      cancelText="Giữ gói"
      okButtonProps={{ danger: choice === 'end' }}
      confirmLoading={pending}
      onCancel={onClose}
      onOk={() => (choice === 'stop' ? actions.cancel.mutate(membership.id, { onSuccess: onClose }) : form.submit())}
    >
      <div className="flex flex-col gap-4 pt-1">
        <Radio.Group
          value={choice}
          onChange={(event) => setChoice(event.target.value as Choice)}
          className="!flex flex-col gap-2"
        >
          {options.map((option) => (
            <Radio
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className={`!m-0 w-full rounded-xl border !px-4 !py-3 transition-colors [&_.ant-radio]:!mt-[3px] [&_.ant-radio]:!self-start [&>span:last-child]:!ps-3 ${
                choice === option.value ? 'border-sc-primary bg-sc-primary-soft/40' : 'border-sc-border'
              }`}
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{option.title}</span>
                <span className="text-[14px] text-sc-muted">{option.description}</span>
              </span>
            </Radio>
          ))}
        </Radio.Group>
        <p className="m-0 text-[14px] text-sc-muted">Cả hai cách đều không hoàn tiền.</p>
        {choice === 'end' && (
          <>
            {prepaid.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`Bạn đã trả trước ${prepaid.length} kỳ từ ${formatDate(prepaid[0]!.periodStart)}. Chấm dứt ngay sẽ hủy luôn các kỳ này.`}
              />
            )}
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={({ reason }) =>
                actions.terminate.mutate({ membershipId: membership.id, reason: reason.trim() }, { onSuccess: onClose })
              }
            >
              <Form.Item
                name="reason"
                label="Lý do chấm dứt"
                rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Ví dụ: chuyển nơi ở, không còn thời gian tập"
                />
              </Form.Item>
            </Form>
          </>
        )}
      </div>
    </Modal>
  );
}
