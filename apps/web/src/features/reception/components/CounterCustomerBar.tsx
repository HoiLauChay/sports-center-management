import { useQuery } from '@tanstack/react-query';
import { Button, Popconfirm, Tag, Tooltip } from 'antd';
import { RefreshCw, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import type { CheckoutItemInput } from '~/features/checkout/types';
import { membershipsQueryOptions } from '~/features/memberships/hooks/useMemberships';
import { formatDate, formatVND } from '~/lib/format';
import { useMemberMemberships } from '../hooks/useCounter';
import { benefitsText, daysUntil } from '../utils';
import { CustomerAvatar } from './CounterCustomerSearch';

/** A membership this close to its end is offered for renewal at the counter. */
const RENEW_WINDOW_DAYS = 7;

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[12.5px] font-semibold tracking-[0.06em] text-sc-muted uppercase">{label}</span>
      <span className="text-[14px] text-sc-ink">{children}</span>
    </div>
  );
}

function MembershipStat({
  accountId,
  onRenew,
  onBrowse,
  disabled,
}: {
  accountId: string;
  onRenew: (selection: CheckoutItemInput) => void;
  onBrowse: () => void;
  disabled?: boolean;
}) {
  const memberships = useMemberMemberships(accountId);
  const packages = useQuery(membershipsQueryOptions);
  if (memberships.isPending) return <Stat label="Gói thành viên">…</Stat>;
  if (!memberships.data) return <Stat label="Gói thành viên">Chưa có dữ liệu</Stat>;

  const current = memberships.data.current;
  const last = current ?? memberships.data.history[0];
  const sellable = (packages.data ?? []).find((plan) => plan.id === last?.package.id && plan.isActive);
  const daysLeft = current ? daysUntil(current.endDate) : null;
  const renew = sellable ? (
    <Button
      size="small"
      icon={<RefreshCw size={13} />}
      disabled={disabled}
      onClick={() => onRenew({ type: 'MEMBERSHIP', packageId: sellable.id })}
    >
      Gia hạn
    </Button>
  ) : null;

  if (!current) {
    return (
      <Stat label="Gói thành viên">
        <span className="flex flex-wrap items-center gap-2">
          {last ? (
            <Tag color="error" className="!m-0">
              {last.package.name} · hết hạn {formatDate(last.endDate)}
            </Tag>
          ) : (
            <span className="text-sc-muted">Chưa có gói</span>
          )}
          {renew ?? (
            <Button size="small" disabled={disabled} onClick={onBrowse}>
              Bán gói
            </Button>
          )}
        </span>
      </Stat>
    );
  }

  return (
    <Stat label="Gói thành viên">
      <span className="flex flex-wrap items-center gap-2">
        <Tooltip title={current.currentBenefits ? benefitsText(current.currentBenefits) : undefined}>
          <b>{current.package.name}</b>
        </Tooltip>
        {daysLeft !== null && daysLeft <= RENEW_WINDOW_DAYS ? (
          <Tag color="warning" className="!m-0">
            Còn {Math.max(daysLeft, 0)} ngày
          </Tag>
        ) : (
          <span className="text-[14.5px] text-sc-muted">đến {formatDate(current.endDate)}</span>
        )}
        {daysLeft !== null && daysLeft <= RENEW_WINDOW_DAYS && renew}
      </span>
      {current.currentBenefits && (
        <span className="mt-0.5 block text-[13.5px] text-sc-success">{benefitsText(current.currentBenefits)}</span>
      )}
    </Stat>
  );
}

interface CounterCustomerBarProps {
  buyer: DraftBuyer;
  balance?: number | null;
  /** True when changing the customer would throw away services already in the draft. */
  hasLines: boolean;
  disabled?: boolean;
  onClear: () => void;
  onAdd: (selection: CheckoutItemInput) => void;
  onBrowseMemberships: () => void;
}

/** The chosen customer at a glance: who, wallet, membership (with a renew shortcut), and a way to change. */
export function CounterCustomerBar({
  buyer,
  balance,
  hasLines,
  disabled,
  onClear,
  onAdd,
  onBrowseMemberships,
}: CounterCustomerBarProps) {
  const member = buyer.kind === 'MEMBER';
  const name = member ? buyer.fullName : buyer.name;
  const change = (
    <Button disabled={disabled} onClick={hasLines ? undefined : onClear}>
      Đổi khách
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-sc-border bg-white px-4 py-3 shadow-xs">
      <div className="flex min-w-0 items-center gap-3">
        <CustomerAvatar name={name} guest={!member} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="flex flex-wrap items-center gap-2">
            <b className="truncate text-[16px] text-sc-ink">{name}</b>
            <Tag color={member ? 'green' : 'gold'} className="!m-0">
              {member ? 'Hội viên' : 'Khách vãng lai'}
            </Tag>
          </span>
          <span className="text-[14.5px] text-sc-muted tabular-nums">{buyer.phone ?? 'Chưa có SĐT'}</span>
        </div>
      </div>

      {member ? (
        <>
          <Stat label="Số dư ví">
            <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums">
              <Wallet size={14} className="text-sc-muted" />
              {balance === null || balance === undefined ? '…' : formatVND(balance)}
            </span>
          </Stat>
          <MembershipStat
            accountId={buyer.accountId}
            onRenew={onAdd}
            onBrowse={onBrowseMemberships}
            disabled={disabled}
          />
        </>
      ) : (
        <span className="text-[14.5px] text-sc-muted">Chỉ đặt sân lẻ · không ưu đãi · không mã giảm giá</span>
      )}

      <div className="ml-auto">
        {hasLines ? (
          <Popconfirm
            title="Đổi khách?"
            description="Các dịch vụ đã chọn sẽ bị xóa khỏi đơn."
            okText="Đổi khách"
            cancelText="Giữ lại"
            okButtonProps={{ danger: true }}
            onConfirm={onClear}
          >
            {change}
          </Popconfirm>
        ) : (
          change
        )}
      </div>
    </div>
  );
}
