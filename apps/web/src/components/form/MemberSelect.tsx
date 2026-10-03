import type { AccountSummary } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Select, type SelectProps } from 'antd';
import { useEffect, useState } from 'react';
import { usersService } from '~/features/users/services/users.service';

interface MemberSelectProps extends Pick<SelectProps, 'placeholder' | 'status' | 'disabled' | 'className' | 'style'> {
  value?: string | null;
  onChange?: (memberId: string | undefined, member: AccountSummary | undefined) => void;
  /** Members shown as the initial options (e.g. the one that is already selected). */
  initial?: AccountSummary[];
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Server-side searchable member picker (name / email / phone). */
export function MemberSelect({
  value,
  onChange,
  initial = [],
  placeholder = 'Tìm theo tên, email hoặc SĐT',
  ...rest
}: MemberSelectProps) {
  const [term, setTerm] = useState('');
  const q = useDebounced(term.trim());
  const members = useQuery({
    queryKey: ['users', 'member-select', q],
    queryFn: () => usersService.list({ q: q || undefined, role: 'MEMBER', page: 1, limit: 20 }),
    staleTime: 15_000,
  });

  const options = new Map<string, AccountSummary>();
  for (const member of initial) options.set(member.id, member);
  for (const member of members.data?.items ?? []) options.set(member.id, member);

  return (
    <Select
      {...rest}
      showSearch={{ filterOption: false, onSearch: setTerm }}
      allowClear
      value={value ?? undefined}
      placeholder={placeholder}
      loading={members.isFetching}
      notFoundContent={members.isFetching ? 'Đang tìm…' : 'Không tìm thấy thành viên'}
      options={[...options.values()].map((member) => ({
        value: member.id,
        label: `${member.fullName}${member.phone ? ` · ${member.phone}` : ''} · ${member.email}`,
      }))}
      onChange={(id: string | undefined) => onChange?.(id, id ? options.get(id) : undefined)}
    />
  );
}
