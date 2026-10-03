import { Modal } from 'antd';
import { formatVND } from '~/lib/format';
import type { PriceChange } from '../hooks/useCheckout';
import type { Quote } from '../types';
import { QuoteTotals } from './QuoteTotals';

interface PriceChangeModalProps {
  change: PriceChange | null;
  confirming: boolean;
  onConfirm: (quote: Quote) => void;
  onCancel: () => void;
}

/** Shown when checkout answers `PRICE_CHANGED`: the person must accept the new total before anything is charged. */
export function PriceChangeModal({ change, confirming, onConfirm, onCancel }: PriceChangeModalProps) {
  const quote = change?.quote;
  return (
    <Modal
      open={Boolean(quote)}
      title="Giá đơn hàng đã thay đổi"
      okText={quote ? `Xác nhận thanh toán ${formatVND(quote.total)}` : 'Xác nhận'}
      cancelText="Xem lại đơn"
      centered
      mask={{ closable: false }}
      confirmLoading={confirming}
      onOk={() => quote && onConfirm(quote)}
      onCancel={onCancel}
    >
      {quote && change && (
        <>
          <p className="mt-0">
            Tổng tiền trước đó là <b>{formatVND(change.previousTotal)}</b>, hiện là <b>{formatVND(quote.total)}</b>. Hệ
            thống không tự thu số tiền mới: hãy xác nhận lại nếu bạn đồng ý.
          </p>
          <QuoteTotals quote={quote} />
        </>
      )}
    </Modal>
  );
}
