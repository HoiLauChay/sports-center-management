import { Alert, Button, Card, Steps, Tag } from 'antd';
import { MessageSquareText, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { formatDateTime, formatRelative } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useMySupportRequests } from '../hooks/useSupport';
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUSES, SUPPORT_STATUS_TAG, type SupportRequest } from '../types';
import { SupportRequestModal } from './SupportRequestModal';

function RequestCard({ request }: { request: SupportRequest }) {
  const tag = SUPPORT_STATUS_TAG[request.status];
  const step = SUPPORT_STATUSES.indexOf(request.status);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-[16px] font-bold [overflow-wrap:anywhere]">{request.subject}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-sc-muted">
            <Tag className="!m-0">{SUPPORT_CATEGORY_LABEL[request.category]}</Tag>
            <span>Gửi {formatDateTime(request.createdAt)}</span>
            {request.updatedAt !== request.createdAt && <span>Cập nhật {formatRelative(request.updatedAt)}</span>}
          </div>
        </div>
        <Tag color={tag.color} className="!m-0">
          {tag.label}
        </Tag>
      </div>
      <p className="mt-3 mb-0 whitespace-pre-line text-sc-ink-2 [overflow-wrap:anywhere]">{request.description}</p>
      <Steps
        className="!mt-4"
        size="small"
        current={step}
        status={request.status === 'CLOSED' ? 'finish' : 'process'}
        items={[
          { title: 'Đã gửi' },
          { title: 'Đang xử lý', content: request.handledBy ? request.handledBy.fullName : undefined },
          { title: 'Đã xử lý', content: request.resolvedAt ? formatDateTime(request.resolvedAt) : undefined },
          { title: 'Đã đóng' },
        ]}
      />
      {request.resolutionNote && (
        <div className="mt-4 rounded-lg border border-sc-primary-border bg-sc-primary-soft px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-sc-primary">
            <MessageSquareText size={15} />
            Phản hồi từ trung tâm{request.handledBy ? ` · ${request.handledBy.fullName}` : ''}
          </div>
          <p className="m-0 whitespace-pre-line [overflow-wrap:anywhere]">{request.resolutionNote}</p>
        </div>
      )}
    </Card>
  );
}

/** `/support` (member): create tickets and follow their status. */
export function SupportPage() {
  const [open, setOpen] = useState(false);
  const requests = useMySupportRequests();

  return (
    <>
      <PageHeader
        title="Hỗ trợ"
        description="Gửi yêu cầu cho lễ tân và theo dõi trạng thái xử lý. Trạng thái tự cập nhật khi lễ tân phản hồi."
        extra={
          <Button type="primary" icon={<Plus size={16} />} onClick={() => setOpen(true)}>
            Gửi yêu cầu
          </Button>
        }
      />
      {requests.isPending ? (
        <PageLoading />
      ) : requests.isError && !requests.data ? (
        <Card>
          <ErrorState message={toApiError(requests.error).message} onRetry={() => void requests.refetch()} />
        </Card>
      ) : requests.data.length === 0 ? (
        <Card>
          <EmptyState
            title="Bạn chưa gửi yêu cầu nào"
            description="Cần hỗ trợ về tài khoản, thanh toán, đặt sân hay lớp học? Hãy gửi yêu cầu cho lễ tân."
            action={
              <Button type="primary" onClick={() => setOpen(true)}>
                Gửi yêu cầu đầu tiên
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.isError && <Alert type="error" showIcon title={toApiError(requests.error).message} />}
          {requests.data.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
      <SupportRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
