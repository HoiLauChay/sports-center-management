/** Saves a PDF blob under `fileName` through a temporary download link. */
export function savePdf(data: Blob, fileName: string) {
  const pdfBlob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Prints a PDF blob exactly as rendered, through a hidden iframe (or a new tab when the iframe is blocked). */
export function printPdf(data: Blob) {
  const url = URL.createObjectURL(data);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);

  return new Promise<void>((resolve, reject) => {
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve();
        } catch {
          const w = window.open(url, '_blank');
          if (w) {
            w.focus();
            w.onload = () => w.print();
            resolve();
          } else {
            reject(new Error('Trình duyệt đã chặn cửa sổ in ấn'));
          }
        }
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(url);
        }, 60_000);
      }, 500);
    };
    iframe.onerror = (e) => {
      iframe.remove();
      URL.revokeObjectURL(url);
      reject(e);
    };
  });
}
