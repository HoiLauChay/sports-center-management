import { Alert, Button, Card, Input, Radio, Tag } from 'antd';
import { useState } from 'react';
import { MemberSelect } from '~/components/form/MemberSelect';
import { SectionTitle } from '~/components/ui/SectionTitle';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import { formatDate, formatVND } from '~/lib/format';
import { useMemberMemberships } from '../hooks/useCounter';

const PHONE_PATTERN = /^(\+84|0)\d{8,10}$/;

function MemberSummary({
  buyer,
  balance,
}: {
  buyer: Extract<DraftBuyer, { kind: 'MEMBER' }>;
  balance: number | null | undefined;
}) {
  const memberships = useMemberMemberships(buyer.accountId);
  const current = memberships.data?.current;
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg bg-sc-paper px-4 py-3 text-[13.5px]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sc-muted">Số dư ví</span>
        <b className="tabular-nums">{balance === null || balance === undefined ? '…' : formatVND(balance)}</b>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sc-muted">Gói thành viên</span>
        {memberships.isPending ? (
          '…'
        ) : memberships.data === null ? (
          <span className="text-sc-muted-2">Chưa có dữ liệu</span>
        ) : current ? (
          <span className="text-right">
            <b>{current.package.name}</b>
            <span className="block text-xs text-sc-muted">hết hạn {formatDate(current.endDate)}</span>
          </span>
        ) : (
          <Tag className="!m-0">Không có gói</Tag>
        )}
      </div>
      {current?.currentBenefits && (
        <div className="text-xs text-sc-muted">
          {current.currentBenefits.gymAccess ? 'Gym miễn phí · ' : ''}−{current.currentBenefits.bookingDiscountPct}% đặt
          sân · −{current.currentBenefits.classDiscountPct}% học phí ·{' '}
          {current.currentBenefits.freeBookingSlotsPerMonth} slot miễn phí/tháng
        </div>
      )}
    </div>
  );
}

interface CounterBuyerCardProps {
  buyer: DraftBuyer | null;
  onChange: (buyer: DraftBuyer | null) => void;
  balance?: number | null;
  disabled?: boolean;
}

/** Step 1 of a counter order: a member (searched) or a walk-in guest (name + phone, bookings only). */
export function CounterBuyerCard({ buyer, onChange, balance, disabled }: CounterBuyerCardProps) {
  const [kind, setKind] = useState<'MEMBER' | 'GUEST'>(buyer?.kind ?? 'MEMBER');
  const [guest, setGuest] = useState({
    name: buyer?.kind === 'GUEST' ? buyer.name : '',
    phone: buyer?.kind === 'GUEST' ? buyer.phone : '',
  });
  const [touched, setTouched] = useState(false);

  const nameError = touched && !guest.name.trim() ? 'Vui lòng nhập tên khách' : undefined;
  const phoneError =
    touched && !PHONE_PATTERN.test(guest.phone.trim().replace(/\s/g, '')) ? 'Số điện thoại không hợp lệ' : undefined;

  const confirmGuest = () => {
    setTouched(true);
    const phone = guest.phone.trim().replace(/\s/g, '');
    if (!guest.name.trim() || !PHONE_PATTERN.test(phone)) return;
    onChange({ kind: 'GUEST', name: guest.name.trim(), phone });
  };

  return (
    <Card>
      <SectionTitle>1. Người mua</SectionTitle>
      <Radio.Group
        optionType="button"
        buttonStyle="solid"
        disabled={disabled}
        value={kind}
        onChange={(event) => {
          setKind(event.target.value as 'MEMBER' | 'GUEST');
          onChange(null);
        }}
        options={[
          { value: 'MEMBER', label: 'Thành viên' },
          { value: 'GUEST', label: 'Khách vãng lai' },
        ]}
        className="!mb-3"
      />
      {kind === 'MEMBER' ? (
        <>
          <MemberSelect
            disabled={disabled}
            value={buyer?.kind === 'MEMBER' ? buyer.accountId : undefined}
            initial={
              buyer?.kind === 'MEMBER'
                ? [
                    {
                      id: buyer.accountId,
                      fullName: buyer.fullName,
                      phone: buyer.phone,
                      email: '',
                      avatarUrl: null,
                      role: 'MEMBER',
                      status: 'ACTIVE',
                      createdAt: '',
                    },
                  ]
                : []
            }
            onChange={(id, member) =>
              onChange(
                id && member ? { kind: 'MEMBER', accountId: id, fullName: member.fullName, phone: member.phone } : null,
              )
            }
          />
          {buyer?.kind === 'MEMBER' && <MemberSummary buyer={buyer} balance={balance} />}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <Input
              placeholder="Tên khách"
              value={guest.name}
              disabled={disabled}
              status={nameError ? 'error' : undefined}
              onChange={(event) => setGuest({ ...guest, name: event.target.value })}
            />
            {nameError && <div className="mt-1 text-xs text-sc-error">{nameError}</div>}
          </div>
          <div>
            <Input
              placeholder="Số điện thoại"
              value={guest.phone}
              disabled={disabled}
              status={phoneError ? 'error' : undefined}
              inputMode="tel"
              onChange={(event) => setGuest({ ...guest, phone: event.target.value })}
              onPressEnter={confirmGuest}
            />
            {phoneError && <div className="mt-1 text-xs text-sc-error">{phoneError}</div>}
          </div>
          <Button type="primary" disabled={disabled} onClick={confirmGuest}>
            Xác nhận khách
          </Button>
          {buyer?.kind === 'GUEST' && (
            <Tag color="gold" className="!m-0 w-fit">
              Khách: {buyer.name} · {buyer.phone}
            </Tag>
          )}
          <Alert
            type="warning"
            showIcon
            title="Khách vãng lai chỉ đặt sân lẻ, trả tại quầy, không có quyền lợi gói, không dùng mã giảm giá và không được hoàn tiền."
          />
        </div>
      )}
    </Card>
  );
}
