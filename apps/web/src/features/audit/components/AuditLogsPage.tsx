import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, listAuditLogsQuerySchema, type AuditLog } from '@sports-center/shared';
import { Alert, Avatar, Button, Card, DatePicker, Form, Select, Spin, Table, Tag, type TableColumnsType } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { Eye } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDateTime, initialsOf, VN_TIMEZONE } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useAuditActors } from '../hooks/useAuditActors';
import { useAuditLogs, type AuditLogFilters } from '../hooks/useAuditLogs';
import {
  AUDIT_ACTION_COLOR,
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  auditFieldLabel,
  summaryFields,
} from '../utils/labels';
import { AuditLogDetailDrawer } from './AuditLogDetailDrawer';

interface FilterForm {
  range: [Dayjs, Dayjs];
  accountId?: string;
  entityType?: AuditLogFilters['entityType'];
  action?: AuditLogFilters['action'];
}

function defaultFilters(): AuditLogFilters {
  const today = dayjs().tz(VN_TIMEZONE);
  return { from: today.subtract(6, 'day').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') };
}

const rangeOf = (filters: AuditLogFilters): [Dayjs, Dayjs] => [dayjs(filters.from), dayjs(filters.to)];

const SUMMARY_FIELDS = 3;

function summarize(log: AuditLog) {
  const fields = summaryFields(log);
  const verb = AUDIT_ACTION_LABEL[log.action];
  if (!fields.length) return verb;
  const shown = fields.slice(0, SUMMARY_FIELDS).map(auditFieldLabel).join(', ');
  const more = fields.length > SUMMARY_FIELDS ? ` (+${fields.length - SUMMARY_FIELDS})` : '';
  return `${verb}: ${shown}${more}`;
}

export function AuditLogsPage() {
  const [filters, setFilters] = useState(defaultFilters);
  const [form] = Form.useForm<FilterForm>();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [actorSearch, setActorSearch] = useState('');
  const [debouncedActorSearch, setDebouncedActorSearch] = useState('');
  const logs = useAuditLogs(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedActorSearch(actorSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [actorSearch]);

  const actors = useAuditActors(debouncedActorSearch);

  const today = dayjs(dayjs().tz(VN_TIMEZONE).format('YYYY-MM-DD'));
  const applyFilters = (values: FilterForm) => {
    const result = listAuditLogsQuerySchema.safeParse({
      from: values.range?.[0]?.format('YYYY-MM-DD'),
      to: values.range?.[1]?.format('YYYY-MM-DD'),
      accountId: values.accountId,
      entityType: values.entityType,
      action: values.action,
    });
    if (!result.success) {
      form.setFields([{ name: 'range', errors: result.error.issues.map((issue) => issue.message) }]);
      return;
    }
    const { from, to, accountId, entityType, action } = result.data;
    setFilters({ from, to, accountId, entityType, action });
  };

  const resetFilters = () => {
    const next = defaultFilters();
    form.resetFields();
    form.setFieldsValue({ range: rangeOf(next) });
    setFilters(next);
    setActorSearch('');
  };

  const columns: TableColumnsType<AuditLog> = [
    {
      title: '#',
      key: 'index',
      width: 56,
      fixed: 'left',
      render: (_, __, index) => (
        <span className="font-display text-xl font-extrabold text-sc-muted-2">
          {String(index + 1).padStart(2, '0')}
        </span>
      ),
    },
    {
      title: 'Thời gian',
      key: 'createdAt',
      width: 145,
      render: (_, log) => <span className="whitespace-nowrap">{formatDateTime(log.createdAt)}</span>,
    },
    {
      title: 'Người thực hiện',
      key: 'account',
      width: 180,
      render: (_, log) =>
        log.account ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar size={32} className="!shrink-0 !bg-sc-primary-soft !font-semibold !text-sc-primary">
              {initialsOf(log.account.fullName)}
            </Avatar>
            <span className="min-w-0 font-semibold truncate" title={log.account.fullName}>
              {log.account.fullName}
            </span>
          </div>
        ) : (
          <Tag className="!m-0">Hệ thống / tự động</Tag>
        ),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 120,
      render: (_, log) => (
        <Tag color={AUDIT_ACTION_COLOR[log.action]} className="!m-0 font-medium">
          {AUDIT_ACTION_LABEL[log.action]}
        </Tag>
      ),
    },
    {
      title: 'Đối tượng',
      key: 'entity',
      width: 170,
      render: (_, log) => (
        <div className="flex flex-col text-xs leading-tight">
          <span className="font-semibold text-sc-ink">{AUDIT_ENTITY_LABEL[log.entityType]}</span>
          <span title={log.entityId} className="font-mono text-[11px] text-sc-muted">
            #{log.entityId.slice(0, 8)}
          </span>
        </div>
      ),
    },
    {
      title: 'Chi tiết',
      key: 'details',
      render: (_, log) => <span className="text-xs [overflow-wrap:anywhere]">{summarize(log)}</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      align: 'right',
      render: (_, log) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          aria-label="Xem chi tiết thao tác"
          onClick={() => setSelected(log)}
        />
      ),
    },
  ];

  const rangeLabel = `${dayjs(filters.from).format('DD/MM')} – ${dayjs(filters.to).format('DD/MM/YYYY')}`;

  return (
    <>
      <PageHeader
        title="Lịch sử thao tác hệ thống"
        description={`Audit log ${rangeLabel} · ${logs.items.length}${logs.hasNextPage ? '+' : ''} bản ghi · không chứa mật khẩu / OTP / token`}
      />
      <Card>
        <Form<FilterForm>
          form={form}
          initialValues={{ range: rangeOf(filters) }}
          onFinish={applyFilters}
          onValuesChange={() => form.submit()}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <Form.Item
              name="range"
              rules={[
                { required: true, message: 'Vui lòng chọn khoảng thời gian.' },
                {
                  validator: (_, range: FilterForm['range'] | null) =>
                    !range?.[0] || !range?.[1] || range[0].isAfter(range[1], 'day')
                      ? Promise.reject(new Error('Chọn ngày bắt đầu và kết thúc hợp lệ.'))
                      : Promise.resolve(),
                },
              ]}
              className="!mb-0 w-full sm:!w-72"
            >
              <DatePicker.RangePicker
                className="w-full"
                format="DD/MM/YYYY"
                allowClear={false}
                presets={[
                  { label: '7 ngày gần nhất', value: [today.subtract(6, 'day'), today] },
                  { label: '30 ngày gần nhất', value: [today.subtract(29, 'day'), today] },
                  { label: 'Tháng này', value: [today.startOf('month'), today] },
                ]}
              />
            </Form.Item>
            <Form.Item name="accountId" className="!mb-0 w-full sm:!w-52">
              <Select
                allowClear
                showSearch={{ filterOption: false, onSearch: setActorSearch }}
                placeholder="Người thực hiện"
                loading={actors.isFetching}
                options={(actors.data?.items ?? []).map((actor) => ({
                  value: actor.id,
                  label: `${actor.fullName} · ${actor.email}`,
                }))}
                notFoundContent={
                  actors.isFetching ? (
                    <Spin size="small" />
                  ) : actors.isError ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-sc-muted">Không tải được người dùng.</span>
                      <Button size="small" onClick={() => void actors.refetch()}>
                        Thử lại
                      </Button>
                    </div>
                  ) : (
                    'Không có người dùng phù hợp'
                  )
                }
              />
            </Form.Item>
            <Form.Item name="entityType" className="!mb-0 w-full sm:!w-52">
              <Select
                allowClear
                placeholder="Đối tượng"
                options={AUDIT_ENTITY_TYPES.map((type) => ({ value: type, label: AUDIT_ENTITY_LABEL[type] }))}
              />
            </Form.Item>
            <Form.Item name="action" className="!mb-0 w-full sm:!w-44">
              <Select
                allowClear
                placeholder="Hành động"
                options={AUDIT_ACTIONS.map((action) => ({ value: action, label: AUDIT_ACTION_LABEL[action] }))}
              />
            </Form.Item>
            <Button type="link" onClick={resetFilters}>
              Đặt lại
            </Button>
          </div>
        </Form>
        {logs.isError && logs.items.length === 0 ? (
          <ErrorState message={toApiError(logs.error).message} onRetry={() => void logs.refetch()} />
        ) : (
          <>
            <Table<AuditLog>
              rowKey="id"
              columns={columns}
              dataSource={logs.items}
              loading={logs.isPending}
              pagination={false}
              scroll={{ x: 'max-content' }}
              locale={{
                emptyText: logs.isPending ? (
                  ' '
                ) : (
                  <EmptyState
                    title="Không có thao tác phù hợp"
                    description="Thử thay đổi khoảng thời gian hoặc bộ lọc."
                  />
                ),
              }}
            />
            {logs.isError && (
              <Alert
                type="error"
                showIcon
                title={toApiError(logs.error).message}
                className="mt-4"
                action={
                  <Button
                    loading={logs.isFetching}
                    onClick={() => void (logs.isFetchNextPageError ? logs.fetchNextPage() : logs.refetch())}
                  >
                    Thử lại
                  </Button>
                }
              />
            )}
            {logs.hasNextPage ? (
              <div className="mt-4 text-center">
                <Button
                  loading={logs.isFetchingNextPage}
                  disabled={logs.isRefetchError || logs.isRefetching}
                  onClick={() => void logs.fetchNextPage()}
                >
                  {logs.isFetchNextPageError ? 'Thử tải thêm' : 'Tải thêm'}
                </Button>
              </div>
            ) : (
              logs.items.length > 0 && (
                <p className="mt-4 mb-0 text-center text-xs text-sc-muted">
                  Đã hiển thị hết thao tác trong khoảng thời gian đã chọn.
                </p>
              )
            )}
          </>
        )}
      </Card>
      <AuditLogDetailDrawer log={selected} onClose={() => setSelected(null)} />
    </>
  );
}
