import { App } from 'antd';
import { useState } from 'react';
import { describeApiError } from '~/lib/http-errors';
import { printPdf, savePdf } from '~/lib/pdf';

/** A server-rendered PDF receipt: the "Xem bản in" toggle, download and print. The PDF is fetched once. */
export function useReceiptPdf(fetchPdf: () => Promise<Blob>) {
  const { message } = App.useApp();
  const [showPdf, setShowPdf] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    if (blob) return blob;
    try {
      setLoading(true);
      const next = await fetchPdf();
      setBlob(next);
      return next;
    } finally {
      setLoading(false);
    }
  };

  const run = async (setBusy: (busy: boolean) => void, action: (pdf: Blob) => unknown) => {
    try {
      setBusy(true);
      await action(await load());
    } catch (error) {
      message.error(describeApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return {
    showPdf,
    blob,
    loading,
    downloading,
    printing,
    toggle: () => {
      setShowPdf(!showPdf);
      if (!showPdf) load().catch((error: unknown) => message.error(describeApiError(error)));
    },
    download: (fileName: string) => run(setDownloading, (pdf) => savePdf(pdf, fileName)),
    print: () => run(setPrinting, printPdf),
  };
}

export type ReceiptPdf = ReturnType<typeof useReceiptPdf>;
