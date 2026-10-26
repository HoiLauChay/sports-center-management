import { Button, Card, Space, Spin } from 'antd';
import { Download, FileText, LayoutGrid, Printer } from 'lucide-react';
import type { ReceiptPdf } from '~/hooks/useReceiptPdf';
import { PdfReceiptCanvas } from './PdfReceiptCanvas';

interface ReceiptPdfActionsProps {
  pdf: ReceiptPdf;
  fileName: string;
  /** Label of the button that leaves the PDF view. */
  detailLabel?: string;
}

/** "Xem bản in" / "Tải PDF" / "In hóa đơn" for a server-rendered receipt. */
export function ReceiptPdfActions({ pdf, fileName, detailLabel = 'Xem chi tiết' }: ReceiptPdfActionsProps) {
  return (
    <Space.Compact>
      <Button icon={pdf.showPdf ? <LayoutGrid size={16} /> : <FileText size={16} />} onClick={pdf.toggle}>
        {pdf.showPdf ? detailLabel : 'Xem bản in'}
      </Button>
      <Button icon={<Download size={16} />} loading={pdf.downloading} onClick={() => void pdf.download(fileName)}>
        Tải PDF
      </Button>
      <Button icon={<Printer size={16} />} loading={pdf.printing} onClick={() => void pdf.print()}>
        In hóa đơn
      </Button>
    </Space.Compact>
  );
}

/** The receipt PDF drawn on the page, with a placeholder while it downloads. */
export function ReceiptPdfPreview({ pdf }: { pdf: ReceiptPdf }) {
  if (pdf.loading) {
    return (
      <Card className="flex h-[750px] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spin size="large" />
          <span className="text-[15px] text-sc-muted">Đang tải hóa đơn PDF...</span>
        </div>
      </Card>
    );
  }
  return (
    <div className="flex justify-center">
      <PdfReceiptCanvas blob={pdf.blob} className="w-full max-w-4xl" />
    </div>
  );
}
