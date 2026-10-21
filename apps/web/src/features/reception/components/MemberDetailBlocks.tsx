import { Link } from '@tanstack/react-router';
import { Button, Card } from 'antd';
import { History, Wallet } from 'lucide-react';
import { MappedTag } from '~/components/ui/MappedTag';
import { MoneyFigure } from '~/components/ui/MoneyFigure';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { ORDER_STATUS_TAG } from '~/constants/payment';
import { useOrders } from '~/features/orders';
import { useMemberWallet } from '~/features/wallet';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';

export function MemberWalletBlock({ memberId }: { memberId: string }) {
  const wallet = useMemberWallet(memberId, { page: 1, limit: 4 });
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Ví</SectionTitle>
        <Link to="/reception/top-up" search={{ memberId }}>
          <Button size="small" type="primary">
            Nạp ví
          </Button>
        </Link>
      </div>
      {wallet.isError ? (
        <p className="m-0 text-sc-error">{toApiError(wallet.error).message}</p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
              <Wallet size={17} />
            </span>
            <div>
              <div className="font-display text-[26px] leading-none font-extrabold tabular-nums">
                {wallet.data ? <MoneyFigure amount={wallet.data.balance} /> : '…'}
              </div>
              <div className="text-[13.5px] text-sc-muted">Số dư hiện tại</div>
            </div>
          </div>
          <ul className="mt-3 mb-0 flex list-none flex-col gap-1.5 p-0 text-[14.5px]">
            {(wallet.data?.transactions.items ?? []).map((transaction) => (
              <li
                key={transaction.id}
                className="flex items-center justify-between gap-2 border-t border-sc-border-soft pt-1.5"
              >
                <span className="min-w-0">
                  <span className="block truncate">{transaction.description ?? transaction.transactionCode}</span>
                  <span className="text-[13.5px] text-sc-muted-2">{formatDateTime(transaction.createdAt)}</span>
                </span>
                <b
                  className={`whitespace-nowrap tabular-nums ${transaction.type === 'PAYMENT' ? 'text-sc-error' : 'text-sc-success'}`}
                >
                  {transaction.type === 'PAYMENT' ? '−' : '+'}
                  {formatVND(transaction.amount)}
                </b>
              </li>
            ))}
            {wallet.data && wallet.data.transactions.items.length === 0 && (
              <li className="text-sc-muted">Chưa có giao dịch ví.</li>
            )}
          </ul>
        </>
      )}
    </Card>
  );
}

export function MemberHistoryBlock({ memberId }: { memberId: string }) {
  const orders = useOrders({ page: 1, limit: 5, accountId: memberId });
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <SectionTitle>Lịch sử mua</SectionTitle>
        <Link to="/reception/order" search={{ memberId }}>
          <Button size="small">Tạo đơn</Button>
        </Link>
      </div>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
          <History size={17} />
        </span>
        <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-2 p-0 text-[15px]">
          {(orders.data?.items ?? []).map((order) => (
            <li key={order.id} className="flex items-center justify-between gap-2">
              <Link to="/reception/orders/$orderId" params={{ orderId: order.id }} className="min-w-0">
                <span className="block font-mono text-[14.5px] font-semibold">{order.orderNumber}</span>
                <span className="text-[13.5px] text-sc-muted">{formatDateTime(order.paidAt)}</span>
              </Link>
              <span className="flex flex-col items-end gap-0.5">
                <b className="tabular-nums">{formatVND(order.totalAmount)}</b>
                <MappedTag value={order.status} map={ORDER_STATUS_TAG} />
              </span>
            </li>
          ))}
          {orders.isPending && <li className="text-sc-muted">Đang tải…</li>}
          {orders.data && orders.data.items.length === 0 && <li className="text-sc-muted">Chưa có hóa đơn nào.</li>}
        </ul>
      </div>
    </Card>
  );
}
