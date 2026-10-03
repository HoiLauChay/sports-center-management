import type { AuditLog } from '@sports-center/shared';
import { Descriptions, Drawer, Empty, Table, Tag, type TableColumnsType } from 'antd';
import { formatDateTime } from '~/lib/format';
import { AUDIT_ACTION_COLOR, AUDIT_ACTION_LABEL, AUDIT_ENTITY_LABEL, auditFieldLabel } from '../utils/labels';

interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

function Value({ value }: { value: unknown }) {
  if (value == null) return <span className="text-sc-muted-2">—</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Có' : 'Không'}</span>;
  if (typeof value === 'object') {
    return (
      <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{String(value)}</span>;
}

const columns: TableColumnsType<Change> = [
  { title: 'Trường', dataIndex: 'field', width: 170, render: (field: string) => auditFieldLabel(field) },
  { title: 'Giá trị cũ', dataIndex: 'before', render: (value: unknown) => <Value value={value} /> },
  { title: 'Giá trị mới', dataIndex: 'after', render: (value: unknown) => <Value value={value} /> },
];

export function AuditLogDetailDrawer({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const fields = [...new Set([...Object.keys(log?.oldValues ?? {}), ...Object.keys(log?.newValues ?? {})])];
  const changes = fields.map((field) => ({ field, before: log?.oldValues?.[field], after: log?.newValues?.[field] }));

  return (
    <Drawer title="Chi tiết thao tác" open={Boolean(log)} onClose={onClose} size={760}>
      {log && (
        <>
          <Descriptions
            column={1}
            size="small"
            className="mb-6"
            items={[
              { key: 'time', label: 'Thời gian (giờ Việt Nam)', children: formatDateTime(log.createdAt) },
              {
                key: 'account',
                label: 'Người thực hiện',
                children: log.account?.fullName ?? 'Hệ thống / tác vụ tự động',
              },
              { key: 'accountId', label: 'Mã tài khoản', children: log.account?.id ?? '—' },
              {
                key: 'action',
                label: 'Hành động',
                children: <Tag color={AUDIT_ACTION_COLOR[log.action]}>{AUDIT_ACTION_LABEL[log.action]}</Tag>,
              },
              { key: 'entity', label: 'Đối tượng', children: AUDIT_ENTITY_LABEL[log.entityType] },
              {
                key: 'entityId',
                label: 'Mã đối tượng',
                children: <span className="[overflow-wrap:anywhere]">{log.entityId}</span>,
              },
              { key: 'ip', label: 'Địa chỉ IP', children: log.ipAddress ?? '—' },
              { key: 'id', label: 'Mã nhật ký', children: <span className="[overflow-wrap:anywhere]">{log.id}</span> },
            ]}
          />
          <h2 className="mb-3 text-base font-semibold">Các giá trị được ghi nhận</h2>
          <Table<Change>
            rowKey="field"
            columns={columns}
            dataSource={changes}
            pagination={false}
            scroll={{ x: 580 }}
            locale={{ emptyText: <Empty description="Không có giá trị cũ / mới được ghi nhận" /> }}
          />
        </>
      )}
    </Drawer>
  );
}
