import type { OrderItem } from '@sports-center/shared';
import { Button, Tag } from 'antd';
import { PackageCheck } from 'lucide-react';
import { useCurrentUser } from '~/features/auth';
import { useConfirm } from '~/hooks/useConfirm';
import { formatDateTime, formatVND } from '~/lib/format';
import { useSaleActions } from '../hooks/useShop';
import { FULFILLMENT_LABEL } from '../utils';

/** Hand-over state of a product line inside an order, with the actions the viewer may take on it. */
export function SaleStatusActions({ item }: { item: OrderItem }) {
  const { role } = useCurrentUser();
  const confirm = useConfirm();
  const { pickup, cancel } = useSaleActions();
  const sale = item.productSale;
  if (!sale) return null;

  const status = FULFILLMENT_LABEL[sale.status];
  const pending = sale.status === 'PENDING_PICKUP';
  const staff = role === 'RECEPTIONIST' || role === 'MANAGER';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tag color={status.color} className="!m-0">
        {status.label}
      </Tag>
      <span className="text-[14.5px] text-sc-muted">
        {pending && sale.pickupDeadline && `Nhận tại quầy trước ${formatDateTime(sale.pickupDeadline)}`}
        {sale.status === 'PICKED_UP' && sale.pickedUpAt && formatDateTime(sale.pickedUpAt)}
        {sale.status === 'CANCELLED' && sale.cancelledAt && formatDateTime(sale.cancelledAt)}
      </span>
      {pending && (
        <span className="flex gap-2">
          <Button
            size="small"
            danger
            loading={cancel.isPending}
            onClick={() =>
              confirm({
                title: 'Hủy sản phẩm này?',
                content: `Hàng chưa nhận sẽ được hủy và ${formatVND(item.totalAmount)} hoàn về ví.`,
                okText: 'Hủy và hoàn tiền',
                onOk: () => cancel.mutateAsync({ saleId: sale.id }).catch(() => undefined),
              })
            }
          >
            Hủy
          </Button>
          {staff && (
            <Button
              size="small"
              type="primary"
              icon={<PackageCheck size={14} />}
              loading={pickup.isPending}
              onClick={() =>
                confirm({
                  title: 'Xác nhận đã giao hàng?',
                  content: 'Sau khi giao, sản phẩm này không hủy và hoàn tiền được nữa.',
                  okText: 'Đã giao hàng',
                  danger: false,
                  onOk: () => pickup.mutateAsync(sale.id).catch(() => undefined),
                })
              }
            >
              Giao hàng
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
