import { Button, Card, Empty, Result, Skeleton, Spin } from 'antd';
import type { ReactNode } from 'react';

export function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  return (
    <Card aria-busy="true" aria-label="Đang tải">
      <Skeleton active paragraph={{ rows: 6 }} />
    </Card>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title = 'Chưa có dữ liệu', description, action }: EmptyStateProps) {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <span className="flex flex-col gap-1">
          <span className="font-semibold text-sc-ink-2">{title}</span>
          {description && <span className="text-sc-muted">{description}</span>}
        </span>
      }
    >
      {action}
    </Empty>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Không tải được dữ liệu.', onRetry }: ErrorStateProps) {
  return (
    <Result
      status="error"
      title="Đã có lỗi xảy ra"
      subTitle={message}
      extra={onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    />
  );
}
