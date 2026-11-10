import { App } from 'antd';
import { useState } from 'react';
import { describeApiError } from '~/lib/http-errors';
import { printPdf, savePdf } from '~/lib/pdf';

/**
 * A server-rendered PDF receipt: the "Xem bản in" toggle, download and print. The PDF is fetched once per `key`
 * (what the receipt is of, e.g. the order id and its status), so a page that moves to another receipt, or whose
 * receipt changed, never shows the previous one.
 */
export function useReceiptPdf(fetchPdf: () => Promise<Blob>, key: string) {
  const { message } = App.useApp();
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [cached, setCached] = useState<{ key: string; blob: Blob } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  const showPdf = shownKey === key;
  const blob = cached?.key === key ? cached.blob : null;

  const load = async () => {
    if (blob) return blob;
    try {
      setLoading(true);
      const next = await fetchPdf();
      setCached({ key, blob: next });
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
      setShownKey(showPdf ? null : key);
      if (!showPdf) load().catch((error: unknown) => message.error(describeApiError(error)));
    },
    download: (fileName: string) => run(setDownloading, (pdf) => savePdf(pdf, fileName)),
    print: () => run(setPrinting, printPdf),
  };
}

export type ReceiptPdf = ReturnType<typeof useReceiptPdf>;
