import { App, Button, Tooltip } from 'antd';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('copy failed');
}

interface CopyButtonProps {
  value: string;
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const { message } = App.useApp();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await writeClipboard(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      message.error('Không sao chép được, vui lòng chọn và sao chép thủ công.');
    }
  };

  return (
    <Tooltip title={copied ? 'Đã sao chép' : `Sao chép ${label.toLowerCase()}`}>
      <Button
        size="small"
        type="text"
        aria-label={`Sao chép ${label.toLowerCase()}`}
        icon={copied ? <Check size={15} className="text-sc-success" /> : <Copy size={15} />}
        onClick={() => void copy()}
      />
    </Tooltip>
  );
}
