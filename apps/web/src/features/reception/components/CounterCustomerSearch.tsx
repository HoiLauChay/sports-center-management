import { normalizePhone, phoneSchema, type AccountSummary } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, AutoComplete, Button, Input } from 'antd';
import { Info, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Highlight } from '~/components/ui/Highlight';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import { usersService } from '~/features/users/services/users.service';
import { useDebounce } from '~/hooks/useDebounce';
import { CUSTOMER_SEARCH_ID, memberToBuyer } from '../utils';

const GUEST_OPTION = '__guest__';
const looksLikePhone = (value: string) => /^[+\d][\d\s.\-()]*$/.test(value);

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  return ((words.length > 1 ? words[words.length - 2]![0] : '') + (words[words.length - 1]?.[0] ?? '')).toUpperCase();
}

export function CustomerAvatar({ name, guest = false }: { name: string; guest?: boolean }) {
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-full font-display text-[15px] font-bold ${
        guest ? 'bg-sc-paper-2 text-sc-ink-2' : 'bg-sc-primary text-sc-lime'
      }`}
    >
      {initials(name) || '?'}
    </span>
  );
}

function MemberOption({ member, keyword }: { member: AccountSummary; keyword: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <CustomerAvatar name={member.fullName} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="font-semibold text-sc-ink">
          <Highlight keyword={keyword}>{member.fullName}</Highlight>
        </span>
        <span className="truncate text-[13px] text-sc-muted">
          {member.phone ? <Highlight keyword={keyword}>{member.phone}</Highlight> : 'Chưa có SĐT'}
          {' · '}
          <Highlight keyword={keyword}>{member.email}</Highlight>
        </span>
      </div>
    </div>
  );
}

/** Name + phone of a walk-in guest; warns when the phone already belongs to a member (who would get benefits). */
function GuestForm({
  initial,
  disabled,
  onSelect,
  onBack,
}: {
  initial: { name: string; phone: string };
  disabled?: boolean;
  onSelect: (buyer: DraftBuyer) => void;
  onBack: () => void;
}) {
  const [guest, setGuest] = useState(initial);
  const [touched, setTouched] = useState(false);
  const parsedPhone = phoneSchema.safeParse(guest.phone);
  const phone = parsedPhone.success ? parsedPhone.data : null;
  const nameError = touched && !guest.name.trim() ? 'Vui lòng nhập tên khách' : undefined;
  const phoneError = touched && !phone ? 'Số điện thoại không hợp lệ' : undefined;

  const match = useQuery({
    queryKey: ['users', 'member-select', phone],
    queryFn: () => usersService.list({ q: phone!, role: 'MEMBER', status: 'ACTIVE', page: 1, limit: 5 }),
    enabled: Boolean(phone),
    staleTime: 15_000,
  });
  const member = match.data?.items.find((item) => item.phone && normalizePhone(item.phone) === phone);

  const submit = () => {
    setTouched(true);
    if (!guest.name.trim() || !phone) return;
    onSelect({ kind: 'GUEST', name: guest.name.trim(), phone });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 font-semibold text-sc-ink">
        <UserPlus size={18} />
        Khách vãng lai
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input
            size="large"
            placeholder="Tên khách"
            autoFocus={!initial.name}
            value={guest.name}
            maxLength={255}
            disabled={disabled}
            status={nameError ? 'error' : undefined}
            onChange={(event) => setGuest({ ...guest, name: event.target.value })}
            onPressEnter={submit}
          />
          {nameError && <div className="mt-1 text-xs text-sc-error">{nameError}</div>}
        </div>
        <div>
          <Input
            size="large"
            placeholder="Số điện thoại"
            autoFocus={Boolean(initial.name)}
            value={guest.phone}
            disabled={disabled}
            inputMode="tel"
            status={phoneError ? 'error' : undefined}
            onChange={(event) => setGuest({ ...guest, phone: event.target.value })}
            onPressEnter={submit}
          />
          {phoneError && <div className="mt-1 text-xs text-sc-error">{phoneError}</div>}
        </div>
      </div>
      {member && (
        <Alert
          type="info"
          showIcon
          title={
            <span>
              SĐT này thuộc hội viên <b>{member.fullName}</b>. Dùng tài khoản hội viên để khách được hưởng ưu đãi gói.
            </span>
          }
          action={
            <Button size="small" type="primary" onClick={() => onSelect(memberToBuyer(member))}>
              Dùng tài khoản
            </Button>
          }
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="primary" size="large" disabled={disabled} onClick={submit}>
          Tiếp tục
        </Button>
        <Button size="large" type="text" disabled={disabled} onClick={onBack}>
          Quay lại tìm hội viên
        </Button>
      </div>
      <p className="m-0 flex items-start gap-1.5 text-xs text-sc-muted">
        <Info size={14} className="mt-px shrink-0" />
        Khách vãng lai chỉ đặt sân lẻ, không có ưu đãi gói, không dùng mã giảm giá và không được hoàn tiền.
      </p>
    </div>
  );
}

interface CounterCustomerSearchProps {
  onSelect: (buyer: DraftBuyer) => void;
  disabled?: boolean;
}

/** One box for every customer: search members by name / phone / email, or fall through to a walk-in guest. */
export function CounterCustomerSearch({ onSelect, disabled }: CounterCustomerSearchProps) {
  const [term, setTerm] = useState('');
  const [guest, setGuest] = useState<{ name: string; phone: string } | null>(null);
  const q = useDebounce(term.trim());
  const members = useQuery({
    queryKey: ['users', 'member-select', q],
    queryFn: () => usersService.list({ q, role: 'MEMBER', status: 'ACTIVE', page: 1, limit: 8 }),
    enabled: q.length > 0,
    staleTime: 15_000,
  });

  if (guest) {
    return <GuestForm initial={guest} disabled={disabled} onSelect={onSelect} onBack={() => setGuest(null)} />;
  }

  const typed = term.trim();
  const items = q ? (members.data?.items ?? []) : [];
  const options = [
    ...items.map((member) => ({ value: member.id, label: <MemberOption member={member} keyword={q} /> })),
    {
      value: GUEST_OPTION,
      label: (
        <div className="flex items-center gap-3 border-t border-sc-border-soft py-1.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-sc-line text-sc-muted">
            <UserPlus size={18} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-sc-ink">Bán cho khách vãng lai{typed ? ` · ${typed}` : ''}</span>
            <span className="text-[13px] text-sc-muted">Khách không có tài khoản, chỉ đặt sân lẻ</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <AutoComplete
        className="w-full"
        value={term}
        disabled={disabled}
        options={options}
        defaultActiveFirstOption
        popupMatchSelectWidth
        notFoundContent={null}
        onSearch={setTerm}
        onSelect={(value: string) => {
          if (value === GUEST_OPTION) {
            setGuest(looksLikePhone(typed) ? { name: '', phone: typed } : { name: typed, phone: '' });
          } else {
            const member = items.find((item) => item.id === value);
            if (member) onSelect(memberToBuyer(member));
          }
          setTerm('');
        }}
      >
        <Input
          id={CUSTOMER_SEARCH_ID}
          size="large"
          autoFocus
          allowClear
          autoComplete="off"
          prefix={<Search size={18} className="text-sc-muted" />}
          suffix={<kbd className="counter-kbd">Ctrl K</kbd>}
          placeholder="Nhập SĐT, tên hoặc email khách"
        />
      </AutoComplete>
      <p className="m-0 text-xs text-sc-muted">
        {q && members.isFetching
          ? 'Đang tìm hội viên…'
          : q && !items.length && members.isSuccess
            ? 'Không thấy hội viên nào. Chọn “Bán cho khách vãng lai” nếu khách chưa có tài khoản.'
            : 'Chọn hội viên để áp dụng ưu đãi gói, hoặc bán cho khách vãng lai.'}
      </p>
    </div>
  );
}
