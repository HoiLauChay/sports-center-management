import type { AccountSummary } from '@sports-center/shared';
import { useQuery } from '@tanstack/react-query';
import { Select, type SelectProps } from 'antd';
import { useState } from 'react';
import { Highlight } from '~/components/ui/Highlight';
import { usersService } from '~/features/users/services/users.service';
import { useDebounce } from '~/hooks/useDebounce';

/** What the picker needs to label a member; a search result carries the email too. */
type MemberOption = Pick<AccountSummary, 'id' | 'fullName' | 'phone'> & { email?: string };

interface MemberSelectProps extends Pick<SelectProps, 'placeholder' | 'status' | 'disabled' | 'className' | 'style'> {
  value?: string | null;
  onChange?: (memberId: string | undefined, member: MemberOption | undefined) => void;
  /** Members to label before any search, e.g. the one already picked. */
  initial?: MemberOption[];
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
  const q = useDebounce(term.trim());
  const members = useQuery({
    queryKey: ['users', 'member-select', q],
    queryFn: () => usersService.list({ q: q || undefined, role: 'MEMBER', status: 'ACTIVE', page: 1, limit: 20 }),
    staleTime: 15_000,
  });

  const options = new Map<string, MemberOption>();
  for (const member of initial) options.set(member.id, member);
  for (const member of members.data?.items ?? []) options.set(member.id, member);

  return (
    <Select
      {...rest}
      className={`w-full ${rest.className ?? ''}`}
      showSearch={{ filterOption: false, onSearch: setTerm }}
      allowClear
      value={value ?? undefined}
      placeholder={placeholder}
      loading={members.isFetching}
      notFoundContent={members.isFetching ? 'Đang tìm…' : 'Không tìm thấy thành viên'}
      options={[...options.values()].map((member) => ({
        value: member.id,
        label: (
          <span>
            <Highlight keyword={q}>{member.fullName}</Highlight>
            {member.phone ? (
              <>
                {' · '}
                <Highlight keyword={q}>{member.phone}</Highlight>
              </>
            ) : (
              ''
            )}
            {member.email && (
              <>
                {' · '}
                <Highlight keyword={q}>{member.email}</Highlight>
              </>
            )}
          </span>
        ),
      }))}
      onChange={(id: string | undefined) => onChange?.(id, id ? options.get(id) : undefined)}
    />
  );
}
