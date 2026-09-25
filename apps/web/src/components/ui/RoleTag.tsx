import type { Role } from '@sports-center/shared';
import { Tag } from 'antd';
import { ROLE_LABEL } from '~/constants/roles';
import { ROLE_COLOR } from '~/styles/antd-theme';

export function RoleTag({ role }: { role: Role }) {
  return (
    <Tag color={ROLE_COLOR[role]} className="!m-0">
      {ROLE_LABEL[role]}
    </Tag>
  );
}
