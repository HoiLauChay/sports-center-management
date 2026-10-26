import { getRouteApi, Link } from '@tanstack/react-router';
import { App, Button, Card } from 'antd';
import { ErrorState, PageLoading } from '~/components/feedback/States';
import { MappedTag } from '~/components/ui/MappedTag';
import { PageHeader } from '~/components/ui/PageHeader';
import { INVOICE_STATUS_TAG, invoiceStatusOf } from '~/constants/payment';
import { ReceiptPdfActions, ReceiptPdfPreview } from '~/features/orders/components/ReceiptPdf';
import { useReceiptPdf } from '~/hooks/useReceiptPdf';
import { formatDateTime, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useInvoice, useRefreshAfterPaid } from '../hooks/useWallet';
import { walletService } from '../services/wallet.service';
import { InvoicePayPanel } from './InvoicePayPanel';

const routeApi = getRouteApi('/_authenticated/invoices/$invoiceId');

export function InvoicePage() {
  const { invoiceId } = routeApi.useParams();
  const { message } = App.useApp();
  const invoice = useInvoice(invoiceId);
  const pdf = useReceiptPdf(() => walletService.getReceiptBlob(invoiceId));

  useRefreshAfterPaid(invoice.data, (paid) =>
    message.success(`Đã nhận ${formatVND(paid.amount)}, ví của bạn đã được cộng.`),
  );

  if (invoice.isPending) return <PageLoading />;
  if (invoice.isError) {
    const apiError = toApiError(invoice.error);
    return (
      <ErrorState
        message={apiError.status === 404 ? 'Không tìm thấy hóa đơn.' : apiError.message}
        onRetry={apiError.status === 404 ? undefined : () => void invoice.refetch()}
      />
    );
  }

  const data = invoice.data;
  const paid = data.status === 'PAID';
  return (
    <>
      <PageHeader
        title={`Hóa đơn ${data.paymentCode}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <MappedTag value={invoiceStatusOf(data)} map={INVOICE_STATUS_TAG} />
            <span>Tạo lúc {formatDateTime(data.createdAt)}</span>
            {data.paidAt && <span>Thanh toán lúc {formatDateTime(data.paidAt)}</span>}
          </span>
        }
        back={{ to: '/wallet', label: 'Về ví' }}
        extra={
          paid && <ReceiptPdfActions pdf={pdf} fileName={`hoa-don-${data.paymentCode}.pdf`} detailLabel="Xem tóm tắt" />
        }
      />
      {paid && pdf.showPdf ? (
        <ReceiptPdfPreview pdf={pdf} />
      ) : (
        <Card>
          <InvoicePayPanel
            invoice={data}
            paidActions={
              <>
                <Link to="/wallet">
                  <Button type="primary">Xem ví</Button>
                </Link>
                <Link to="/wallet/top-up">
                  <Button>Nạp thêm</Button>
                </Link>
              </>
            }
          />
        </Card>
      )}
    </>
  );
}
