import type { ManualStockReason, Product, StockMovement } from '@sports-center/shared';
import { useMutation } from '@tanstack/react-query';
import { Alert, App, Drawer, Form, Input, InputNumber, Modal, Segmented, Tag, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { Table } from '~/components/data/Table';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useRefreshShop, useStockMovements } from '../hooks/useShop';
import { shopService } from '../services/shop.service';
import { STOCK_REASON_LABEL } from '../utils';

interface StockModalProps {
  product: Product | null;
  onClose: () => void;
}

/** Records goods received (IMPORT, always +) or a stock-take correction (ADJUST, + or −). */
export function StockModal({ product, onClose }: StockModalProps) {
  // Keyed by product so every opening starts from a blank form.
  return <StockModalBody key={product?.id ?? 'none'} product={product} onClose={onClose} />;
}

function StockModalBody({ product, onClose }: StockModalProps) {
  const { message } = App.useApp();
  const refresh = useRefreshShop();
  const [reason, setReason] = useState<ManualStockReason>('IMPORT');
  const [amount, setAmount] = useState<number | null>(null);
  const [direction, setDirection] = useState<'+' | '-'>('+');
  const [note, setNote] = useState('');

  const delta = (amount ?? 0) * (reason === 'ADJUST' && direction === '-' ? -1 : 1);
  const current = product?.stock ?? 0;
  const after = current + delta;

  const mutation = useMutation({
    mutationFn: () => shopService.adjustStock(product!.id, { reason, delta, note: note.trim() || null }),
    onSuccess: (movement) => {
      void refresh();
      message.success(`${STOCK_REASON_LABEL[movement.reason]}: tồn kho còn ${movement.stockAfter}`);
      onClose();
    },
  });

  const blocked = !amount || after < 0;
  /** One guard for the button and for Enter: a second submit while saving would record the movement twice. */
  const submit = () => {
    if (blocked || mutation.isPending) return;
    mutation.mutate();
  };

  return (
    <Modal
      open={Boolean(product)}
      title={product ? `Kho · ${product.name}` : 'Kho'}
      okText="Lưu"
      cancelText="Hủy"
      width={460}
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: blocked }}
      onOk={submit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form layout="vertical" requiredMark={false} onFinish={submit}>
        {mutation.error && <Alert type="error" showIcon className="!mb-4" title={toApiError(mutation.error).message} />}
        <Form.Item label="Loại">
          <Segmented
            block
            value={reason}
            onChange={(value) => setReason(value as ManualStockReason)}
            options={[
              { value: 'IMPORT', label: 'Nhập hàng' },
              { value: 'ADJUST', label: 'Điều chỉnh (kiểm kê)' },
            ]}
          />
        </Form.Item>
        <Form.Item label="Số lượng">
          <div className="flex gap-2">
            {reason === 'ADJUST' && (
              <Segmented
                value={direction}
                onChange={(value) => setDirection(value as '+' | '-')}
                options={[
                  { value: '+', label: 'Thêm' },
                  { value: '-', label: 'Bớt' },
                ]}
              />
            )}
            <InputNumber
              autoFocus
              min={1}
              precision={0}
              value={amount}
              onChange={setAmount}
              suffix="sp"
              className="!flex-1"
              aria-label="Số lượng"
            />
          </div>
        </Form.Item>
        <div className="mb-4 flex items-center justify-between rounded-lg bg-sc-paper px-3 py-2 text-[15px]">
          <span className="text-sc-ink-2">Tồn kho</span>
          <span className="tabular-nums">
            {current} → <b className={after < 0 ? 'text-sc-error' : 'text-sc-ink'}>{after}</b>
          </span>
        </div>
        <Form.Item
          label="Ghi chú"
          extra={reason === 'ADJUST' ? 'Nên ghi lý do: vỡ, hết hạn, lệch kiểm kê…' : undefined}
        >
          <Input.TextArea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} autoSize />
        </Form.Item>
        <button type="submit" hidden />
      </Form>
    </Modal>
  );
}

interface MovementsDrawerProps {
  product: Product | null;
  onClose: () => void;
}

/** The append-only stock ledger of one product. */
export function MovementsDrawer({ product, onClose }: MovementsDrawerProps) {
  return (
    <Drawer open={Boolean(product)} onClose={onClose} title={product ? `Lịch sử kho · ${product.name}` : ''} size={720}>
      {product && <MovementsTable key={product.id} product={product} />}
    </Drawer>
  );
}

function MovementsTable({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const movements = useStockMovements(product.id, page);

  const columns: TableColumnsType<StockMovement> = [
    {
      title: 'Thời gian',
      key: 'createdAt',
      render: (_, row) => <span className="whitespace-nowrap">{formatDateTime(row.createdAt)}</span>,
    },
    {
      title: 'Loại',
      key: 'reason',
      render: (_, row) => (
        <div className="flex flex-col gap-0.5">
          <Tag className="!m-0 w-fit" color={row.delta > 0 ? 'green' : 'orange'}>
            {STOCK_REASON_LABEL[row.reason]}
          </Tag>
          {row.orderNumber && <span className="font-mono text-[13.5px] text-sc-muted">{row.orderNumber}</span>}
          {row.note && <span className="text-[13.5px] text-sc-muted">{row.note}</span>}
        </div>
      ),
    },
    {
      title: 'Thay đổi',
      key: 'delta',
      align: 'right',
      render: (_, row) => (
        <b className={`tabular-nums ${row.delta > 0 ? 'text-sc-success' : 'text-sc-error'}`}>
          {row.delta > 0 ? `+${row.delta}` : row.delta}
        </b>
      ),
    },
    { title: 'Còn lại', dataIndex: 'stockAfter', align: 'right', className: 'tabular-nums' },
    {
      title: 'Người thực hiện',
      key: 'createdBy',
      render: (_, row) => row.createdBy?.fullName ?? <span className="text-sc-muted">Thành viên / hệ thống</span>,
    },
  ];

  return (
    <Table<StockMovement>
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={movements.data?.items}
      loading={movements.isFetching}
      pagination={{
        current: page,
        pageSize: 10,
        total: movements.data?.total,
        onChange: setPage,
        showTotal: (total) => `${total} lần thay đổi`,
      }}
    />
  );
}
