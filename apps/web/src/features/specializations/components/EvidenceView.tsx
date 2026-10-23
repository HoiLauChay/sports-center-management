import { Button, Image } from 'antd';
import { FileText, X } from 'lucide-react';
import type { Specialization } from '../types';

const isPdf = (url: string) => /\.pdf($|\?)/i.test(url);
const fileName = (url: string) => decodeURIComponent(url.split('/').at(-1)?.split('?')[0] ?? url);

/** Certificate files: images open in a preview, PDFs in a new tab. */
export function CertificateList({ urls, onRemove }: { urls: string[]; onRemove?: (url: string) => void }) {
  if (urls.length === 0) return <span className="text-[14.5px] text-sc-muted-2">Không có tệp chứng chỉ</span>;
  return (
    <Image.PreviewGroup>
      <div className="flex flex-wrap gap-2">
        {urls.map((url) => (
          <div
            key={url}
            className="relative flex size-24 items-center justify-center overflow-hidden rounded-lg border border-solid border-sc-border-soft bg-sc-paper"
          >
            {isPdf(url) ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="flex flex-col items-center gap-1 px-1 text-center text-[12px] text-sc-ink"
              >
                <FileText size={26} className="text-sc-primary" />
                <span className="line-clamp-2 [overflow-wrap:anywhere]">{fileName(url)}</span>
              </a>
            ) : (
              <Image src={url} alt="Chứng chỉ" width={96} height={96} className="object-cover" />
            )}
            {onRemove && (
              <Button
                size="small"
                shape="circle"
                aria-label="Bỏ tệp"
                icon={<X size={12} />}
                className="!absolute top-1 right-1"
                onClick={() => onRemove(url)}
              />
            )}
          </div>
        ))}
      </div>
    </Image.PreviewGroup>
  );
}

/** What a coach sent with a specialization request: years, a description and certificate files (UC_1.13). */
export function EvidenceView({ entry }: { entry: Specialization }) {
  return (
    <div className="flex flex-col gap-3 text-[15px]">
      <div>
        <div className="text-[13.5px] font-medium text-sc-muted">Số năm kinh nghiệm</div>
        {entry.experienceYears ?? <span className="text-sc-muted-2">Không khai</span>}
      </div>
      <div>
        <div className="text-[13.5px] font-medium text-sc-muted">Mô tả kinh nghiệm</div>
        <div className="whitespace-pre-line [overflow-wrap:anywhere]">
          {entry.experienceNote ?? <span className="text-sc-muted-2">Không có</span>}
        </div>
      </div>
      <div>
        <div className="mb-1 text-[13.5px] font-medium text-sc-muted">Chứng chỉ</div>
        <CertificateList urls={entry.certificates} />
      </div>
    </div>
  );
}
