import type { MemberMembership } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Card, Tag } from 'antd';
import { BadgeCheck } from 'lucide-react';
import { useState } from 'react';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMemberMembershipActions, useMembershipsOf } from '../hooks/useMemberMemberships';
import { benefitsText } from '../utils';
import { SubscribeMembershipModal, TerminateMembershipModal } from './StaffMembershipModals';

const STATUS_TAG: Record<MemberMembership['status'], { color: string; label: string }> = {
  ACTIVE: { color: 'success', label: 'Còn hiệu lực' },
  EXPIRED: { color: 'default', label: 'Hết hạn' },
  CANCELLED: { color: 'default', label: 'Đã hủy' },
};

interface StaffMembershipBlockProps {
  memberId: string;
  counterLink?: boolean;
}

export function StaffMembershipBlock({ memberId, counterLink = false }: StaffMembershipBlockProps) {
  const memberships = useMembershipsOf(memberId);
  const { cancel } = useMemberMembershipActions(memberId);
  const confirm = useConfirm();
  const [modal, setModal] = useState<'subscribe' | 'terminate' | null>(null);
  const current = memberships.data?.current ?? null;
  const history = memberships.data?.history.slice(0, 3) ?? [];

  const askCancel = (membership: MemberMembership) =>
    confirm({
      title: `Hủy đăng ký gói ${membership.package.name}?`,
      content: `Gói vẫn dùng được đến ${formatDate(membership.endDate)} rồi dừng, không tự gia hạn và không hoàn tiền. Không bỏ hủy được.`,
      okText: 'Hủy đăng ký',
      onOk: () => cancel.mutateAsync(membership.id).catch(() => undefined),
    });

  return (
    <Card>
      <SectionTitle>Gói thành viên</SectionTitle>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
          <BadgeCheck size={17} />
        </span>
        <div className="min-w-0 flex-1 text-[15px]">
          {memberships.isPending ? (
            <span className="text-sc-muted">Đang tải…</span>
          ) : memberships.isError ? (
            <span className="text-sc-error">{toApiError(memberships.error).message}</span>
          ) : current ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <b>{current.package.name}</b>
                {current.cancelledAt ? (
                  <Tag color="warning" className="!m-0">
                    Đã hủy đăng ký
                  </Tag>
                ) : (
                  <Tag color="success" className="!m-0">
                    Đang đăng ký
                  </Tag>
                )}
              </div>
              <div className="mt-0.5 text-sc-muted">
                {formatDate(current.startDate)} – {formatDate(current.endDate)}
              </div>
              <div className="mt-0.5 text-sc-muted">
                {current.cancelledAt
                  ? `Dùng đến ${formatDate(current.endDate)}, không tự gia hạn`
                  : `Tự gia hạn bằng ví ngày ${formatDate(current.endDate)}`}
              </div>
              {current.currentBenefits && (
                <div className="mt-1 text-[14px] text-sc-muted">{benefitsText(current.currentBenefits)}</div>
              )}
            </>
          ) : (
            <span className="text-sc-muted">Thành viên chưa có gói đang hiệu lực.</span>
          )}
        </div>
      </div>

      {memberships.isSuccess && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="primary" onClick={() => setModal('subscribe')}>
            {current ? 'Đổi gói' : 'Đăng ký gói'}
          </Button>
          {current && !current.cancelledAt && (
            <Button loading={cancel.isPending} onClick={() => askCancel(current)}>
              Hủy đăng ký
            </Button>
          )}
          {current && (
            <Button danger onClick={() => setModal('terminate')}>
              Chấm dứt ngay
            </Button>
          )}
          {counterLink && (
            <Link to="/reception/order" search={{ memberId }}>
              <Button type="link" className="!px-1">
                Bán gói tại quầy
              </Button>
            </Link>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 border-t border-sc-border-soft pt-3">
          <div className="mb-2 text-[14px] font-semibold text-sc-muted">Lịch sử gói</div>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14.5px]">
            {history.map((membership) => (
              <li key={membership.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium">{membership.package.name}</span>
                  <span className="text-sc-muted">
                    {' '}
                    · {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
                  </span>
                </span>
                <Tag color={STATUS_TAG[membership.status].color} className="!m-0 shrink-0">
                  {STATUS_TAG[membership.status].label}
                </Tag>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modal === 'subscribe' && (
        <SubscribeMembershipModal open memberId={memberId} current={current} onClose={() => setModal(null)} />
      )}
      <TerminateMembershipModal
        open={modal === 'terminate'}
        memberId={memberId}
        current={current}
        onClose={() => setModal(null)}
      />
    </Card>
  );
}
