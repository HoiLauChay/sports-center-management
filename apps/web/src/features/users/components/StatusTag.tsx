import type { AccountStatus } from '@sports-center/shared';
import { Tag } from 'antd';
import { ACCOUNT_STATUS_LABEL } from '~/constants/roles';

const STATUS_COLOR: Record<AccountStatus, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  BANNED: 'error',
};

export function StatusTag({ status }: { status: AccountStatus }) {
  return (
    <Tag color={STATUS_COLOR[status]} className="!m-0">
      {ACCOUNT_STATUS_LABEL[status]}
    </Tag>
  );
}
