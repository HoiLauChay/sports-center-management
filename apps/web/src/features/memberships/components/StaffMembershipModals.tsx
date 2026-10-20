import type { MemberMembership } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, Form, Input, Modal, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { walletQueryKey, walletService } from '~/features/wallet';
import { formatDate, formatVND } from '~/lib/format';
import { useMemberMembershipActions } from '../hooks/useMemberMemberships';
import { membershipsQueryOptions } from '../hooks/useMemberships';
import { benefitsText } from '../utils';

interface ModalProps {
  open: boolean;
  memberId: string;
  current: MemberMembership | null;
  onClose: () => void;
}

export function SubscribeMembershipModal({ open, memberId, current, onClose }: ModalProps) {
  const packages = useQuery({ ...membershipsQueryOptions, enabled: open });
  const balance = useQuery({
    queryKey: [...walletQueryKey(memberId), 'balance'],
    queryFn: () => walletService.balanceOfMember(memberId),
    enabled: open,
  });
  const { subscribe } = useMemberMembershipActions(memberId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const onSale = (packages.data ?? []).filter((pkg) => pkg.isActive);
  const selected = onSale.find((pkg) => pkg.id === selectedId) ?? null;
  const remaining = selected && balance.data !== undefined ? balance.data - selected.price : null;
  const short = remaining !== null && remaining < 0;

  return (
    <Modal
      title={current ? 'Đổi gói thành viên' : 'Đăng ký gói thành viên'}
      open={open}
      centered
      destroyOnHidden
      width={560}
      okText={selected ? `Trừ ví ${formatVND(selected.price)}` : 'Chọn một gói'}
      cancelText="Đóng"
      okButtonProps={{ disabled: !selected }}
      confirmLoading={subscribe.isPending}
      onCancel={onClose}
      onOk={() =>
        selected &&
        subscribe.mutate(
          { packageId: selected.id, expectedTotal: selected.price, idempotencyKey: requestKey },
          { onSuccess: onClose },
        )
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Chọn gói">
          {onSale.map((pkg) => {
            const inUse = current?.package.id === pkg.id;
            const active = pkg.id === selectedId;
            return (
              <button
                key={pkg.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={inUse}
                onClick={() => {
                  setSelectedId(pkg.id);
                  setRequestKey(crypto.randomUUID());
                }}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? 'border-sc-primary bg-sc-primary-soft'
                    : 'border-sc-border bg-white hover:border-sc-primary-border'
                }`}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-semibold">
                    {pkg.name}
                    {inUse && (
                      <Tag color="success" className="!m-0">
                        Đang dùng
                      </Tag>
                    )}
                  </span>
                  <span className="text-[14px] text-sc-muted">
                    {pkg.durationDays} ngày · {benefitsText(pkg)}
                  </span>
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatVND(pkg.price)}</span>
              </button>
            );
          })}
          {packages.isSuccess && onSale.length === 0 && (
            <span className="text-sc-muted">Chưa có gói nào đang bán.</span>
          )}
        </div>

        <div className="rounded-lg bg-sc-paper px-4 py-3 text-[15px]">
          <div className="flex justify-between gap-3">
            <span className="text-sc-muted">Số dư ví</span>
            <span className="tabular-nums">{balance.data === undefined ? '…' : formatVND(balance.data)}</span>
          </div>
          {selected && (
            <>
              <div className="flex justify-between gap-3">
                <span className="text-sc-muted">Trừ ví</span>
                <span className="tabular-nums">−{formatVND(selected.price)}</span>
              </div>
              <div
                className={`mt-1 flex justify-between gap-3 border-t border-sc-border-soft pt-1 font-semibold ${short ? 'text-sc-error' : ''}`}
              >
                <span>{short ? 'Còn thiếu' : 'Còn lại'}</span>
                <span className="tabular-nums">{remaining === null ? '…' : formatVND(Math.abs(remaining))}</span>
              </div>
            </>
          )}
        </div>

        {short && (
          <Alert
            type="error"
            showIcon
            title={`Ví không đủ tiền. Gói sẽ không được ${current ? 'đổi' : 'đăng ký'} và thành viên nhận thông báo nhắc nạp ví.`}
          />
        )}
        {current && selected && (
          <Alert
            type="warning"
            showIcon
            title={`Gói ${current.package.name} kết thúc ngay hôm nay, mất quyền lợi còn lại (đến ${formatDate(current.endDate)}), không hoàn hay bù tiền.`}
          />
        )}
      </div>
    </Modal>
  );
}

export function TerminateMembershipModal({ open, memberId, current, onClose }: ModalProps) {
  const [form] = Form.useForm<{ reason: string }>();
  const { terminate } = useMemberMembershipActions(memberId);

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  if (!current) return null;
  return (
    <Modal
      title={`Chấm dứt gói ${current.package.name}?`}
      open={open}
      centered
      destroyOnHidden
      okText="Chấm dứt gói"
      cancelText="Đóng"
      okButtonProps={{ danger: true }}
      confirmLoading={terminate.isPending}
      onCancel={onClose}
      onOk={() => form.submit()}
    >
      <div className="flex flex-col gap-3">
        <Alert
          type="warning"
          showIcon
          title="Gói kết thúc ngay hôm nay, thành viên mất quyền lợi còn lại và không được hoàn tiền. Thành viên nhận thông báo kèm lý do."
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={({ reason }) =>
            terminate.mutate({ membershipId: current.id, reason: reason.trim() }, { onSuccess: onClose })
          }
        >
          <Form.Item
            name="reason"
            label="Lý do chấm dứt"
            rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập lý do' }]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
}
