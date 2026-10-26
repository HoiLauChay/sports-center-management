import { Button, Card, Drawer, Input, Segmented, Select, Tag, type TableColumnsType } from 'antd';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { DataTable } from '~/components/data/DataTable';
import { SearchInput } from '~/components/form/SearchInput';
import { Highlight } from '~/components/ui/Highlight';
import { PageHeader } from '~/components/ui/PageHeader';
import { useCurrentUser } from '~/features/auth';
import { useConfirm } from '~/hooks/useConfirm';
import { clickableRow } from '~/hooks/useRowLink';
import { formatDateTime, formatRelative } from '~/lib/format';
import { DEFAULT_PAGE_SIZE } from '~/lib/search';
import { useSupportRequests, useUpdateSupportRequest } from '../hooks/useSupport';
import {
  NEXT_SUPPORT_STATUS,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_TAG,
  type SupportRequest,
  type SupportStatus,
} from '../types';
import { handlingPage, memberPage } from '../utils';

const NEXT_LABEL = {
  IN_PROGRESS: 'Tiếp nhận xử lý',
  RESOLVED: 'Hoàn tất xử lý',
  CLOSED: 'Đóng yêu cầu',
} as const;

function RequestPanel({ request, onClose }: { request: SupportRequest; onClose: () => void }) {
  const { role } = useCurrentUser();
  const update = useUpdateSupportRequest();
  const target = handlingPage(role, request);
  const openTarget = () => window.open(target, '_blank', 'noopener');
  const confirm = useConfirm();
  const [note, setNote] = useState(request.resolutionNote ?? '');

  const next = NEXT_SUPPORT_STATUS[request.status];
  const closed = request.status === 'CLOSED';
  const reply = note.trim();
  const dirty = reply !== '' && reply !== (request.resolutionNote ?? '');
  const tag = SUPPORT_STATUS_TAG[request.status];

  const advance = () => {
    if (!next) return;
    const run = () =>
      update
        .mutateAsync({ id: request.id, body: { status: next, ...(reply && { resolutionNote: reply }) } })
        .catch(() => undefined);
    if (next === 'IN_PROGRESS') openTarget();
    if (next === 'CLOSED') {
      confirm({
        title: 'Đóng yêu cầu này?',
        content: 'Yêu cầu đã đóng không thể cập nhật nữa.',
        okText: 'Đóng yêu cầu',
        danger: false,
        onOk: run,
      });
    } else {
      void run();
    }
  };

  return (
    <Drawer open onClose={onClose} size={520} title={request.subject} destroyOnHidden>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-[14.5px] text-sc-muted">
          <Tag color={tag.color} className="!m-0">
            {tag.label}
          </Tag>
          <Tag className="!m-0">{SUPPORT_CATEGORY_LABEL[request.category]}</Tag>
          <span>
            <a
              href={memberPage(role, request.account.id)}
              target="_blank"
              rel="noopener"
              className="font-semibold text-sc-ink hover:underline"
            >
              {request.account.fullName}
            </a>{' '}
            · {formatDateTime(request.createdAt)}
          </span>
          {request.handledBy && <span>Xử lý bởi {request.handledBy.fullName}</span>}
        </div>
        <div>
          <div className="mb-1 text-[14.5px] font-semibold text-sc-muted">Nội dung thành viên gửi</div>
          <p className="m-0 rounded-lg bg-sc-paper px-4 py-3 whitespace-pre-line [overflow-wrap:anywhere]">
            {request.description}
          </p>
        </div>
        <div>
          <div className="mb-1 text-[14.5px] font-semibold text-sc-muted">Phản hồi cho thành viên</div>
          <Input.TextArea
            value={note}
            disabled={closed}
            maxLength={5000}
            showCount
            autoSize={{ minRows: 4, maxRows: 10 }}
            placeholder="Nội dung này hiển thị cho thành viên"
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        {!closed && (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!dirty}
              loading={update.isPending}
              onClick={() => update.mutate({ id: request.id, body: { resolutionNote: reply } })}
            >
              Lưu phản hồi
            </Button>
            {next && (
              <Button type="primary" loading={update.isPending} onClick={advance}>
                {NEXT_LABEL[next]}
              </Button>
            )}
            {request.status === 'IN_PROGRESS' && (
              <Button icon={<ExternalLink size={16} />} onClick={openTarget}>
                Mở trang xử lý
              </Button>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function RequestDrawer({ request, onClose }: { request: SupportRequest | null; onClose: () => void }) {
  if (!request) return null;
  return <RequestPanel key={`${request.id}:${request.updatedAt}`} request={request} onClose={onClose} />;
}

export function StaffSupportPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [status, setStatus] = useState<SupportStatus | undefined>();
  const [category, setCategory] = useState<SupportRequest['category'] | undefined>();
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const requests = useSupportRequests({ page, limit, status, category, q: q || undefined });
  const open = requests.data?.items.find((request) => request.id === openId) ?? null;

  const columns: TableColumnsType<SupportRequest> = [
    {
      title: 'Yêu cầu',
      key: 'subject',
      render: (_, request) => (
        <div className="flex min-w-48 flex-col gap-0.5">
          <b className="[overflow-wrap:anywhere]">
            <Highlight keyword={q}>{request.subject}</Highlight>
          </b>
          <span className="text-[14.5px] text-sc-ink-2">
            <Highlight keyword={q}>{request.account.fullName}</Highlight>
          </span>
          <span className="truncate text-[14.5px] text-sc-muted">{request.description}</span>
        </div>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'category',
      render: (value: SupportRequest['category']) => <Tag className="!m-0">{SUPPORT_CATEGORY_LABEL[value]}</Tag>,
    },
    {
      title: 'Xử lý',
      key: 'handledBy',
      render: (_, request) => (
        <div className="flex flex-col text-[14.5px]">
          <span className="whitespace-nowrap">{formatRelative(request.updatedAt)}</span>
          <span className="text-sc-muted">{request.handledBy?.fullName ?? 'Chưa có người nhận'}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (value: SupportStatus) => (
        <Tag color={SUPPORT_STATUS_TAG[value].color} className="!m-0">
          {SUPPORT_STATUS_TAG[value].label}
        </Tag>
      ),
    },
  ];

  const reset = () => setPage(1);

  return (
    <>
      <PageHeader title="Yêu cầu hỗ trợ" />
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Segmented
            value={status ?? 'ALL'}
            onChange={(value) => {
              setStatus(value === 'ALL' ? undefined : (value as SupportStatus));
              reset();
            }}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              ...SUPPORT_STATUSES.map((value) => ({ value, label: SUPPORT_STATUS_TAG[value].label })),
            ]}
          />
          <Select
            allowClear
            placeholder="Mọi loại"
            className="w-full sm:!w-44"
            value={category}
            onChange={(value: SupportRequest['category'] | undefined) => {
              setCategory(value);
              reset();
            }}
            options={SUPPORT_CATEGORIES.map((value) => ({ value, label: SUPPORT_CATEGORY_LABEL[value] }))}
          />
          <SearchInput
            placeholder="Tiêu đề hoặc tên thành viên..."
            maxLength={255}
            className="w-full sm:!w-64"
            value={q}
            onChange={(value) => {
              setQ(value);
              reset();
            }}
            loading={requests.isFetching}
          />
        </div>
        <DataTable<SupportRequest>
          columns={columns}
          data={requests.data}
          isLoading={requests.isFetching && !requests.data}
          error={requests.error}
          onRetry={() => void requests.refetch()}
          page={page}
          limit={limit}
          onPageChange={(nextPage, nextLimit) => {
            setPage(nextLimit === limit ? nextPage : 1);
            setLimit(nextLimit);
          }}
          size="middle"
          emptyTitle="Không có yêu cầu hỗ trợ"
          onRow={(request) => clickableRow(() => setOpenId(request.id))}
        />
      </Card>
      <RequestDrawer request={open} onClose={() => setOpenId(null)} />
    </>
  );
}
