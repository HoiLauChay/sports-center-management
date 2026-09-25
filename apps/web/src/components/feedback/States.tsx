import { Button, Empty, Result, Spin } from 'antd';
import type { ReactNode } from 'react';

export function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'min-h-[240px]'}`}>
      <Spin size="large" />
    </div>
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
