import type { Paginated } from '@sports-center/shared';
import { Table, type TableProps } from 'antd';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { toApiError } from '~/lib/http-errors';
import { PAGE_SIZE_OPTIONS } from '~/lib/search';

interface DataTableProps<T> extends Omit<TableProps<T>, 'dataSource' | 'pagination' | 'loading'> {
  data: Paginated<T> | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  page: number;
  limit: number;
  onPageChange: (page: number, limit: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T extends object>({
  data,
  isLoading,
  error,
  onRetry,
  page,
  limit,
  onPageChange,
  emptyTitle,
  emptyDescription,
  ...tableProps
}: DataTableProps<T>) {
  if (error && !data) return <ErrorState message={toApiError(error).message} onRetry={onRetry} />;

  return (
    <Table<T>
      rowKey="id"
      scroll={{ x: 'max-content' }}
      {...tableProps}
      dataSource={data?.items}
      loading={isLoading}
      locale={{ emptyText: isLoading ? ' ' : <EmptyState title={emptyTitle} description={emptyDescription} /> }}
      pagination={{
        current: page,
        pageSize: limit,
        total: data?.total ?? 0,
        showSizeChanger: true,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        showTotal: (total) => `${total} bản ghi`,
        onChange: onPageChange,
      }}
    />
  );
}
