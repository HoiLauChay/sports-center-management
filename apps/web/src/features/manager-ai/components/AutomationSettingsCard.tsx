import { AUTOMATIONS, type AutomationSetting } from '@sports-center/shared';
import { Button, Card, InputNumber, Skeleton, Switch, Tag } from 'antd';
import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '~/components/feedback/States';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { formatDateTime } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { useAutomations, useUpdateAutomation } from '../hooks/useManagerAi';

function AutomationRow({ setting }: { setting: AutomationSetting }) {
  const definition = AUTOMATIONS[setting.key];
  const update = useUpdateAutomation();
  const [threshold, setThreshold] = useState(setting.threshold);
  const changed = threshold !== null && threshold !== setting.threshold;
  const pending = update.isPending;

  return (
    <li className="flex flex-col gap-2 border-b border-sc-border-soft py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-semibold">
          {definition.label}
          {definition.ai && (
            <Tag color="lime" className="!m-0 inline-flex items-center gap-1">
              <Sparkles size={12} /> AI
            </Tag>
          )}
        </div>
        <p className="m-0 text-[14px] text-sc-muted">{definition.description}</p>
        {setting.lastRunAt && (
          <p className="m-0 text-[13px] text-sc-muted-2">Lần chạy gần nhất: {formatDateTime(setting.lastRunAt)}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {definition.threshold && (
          <>
            <span className="text-[13.5px] text-sc-muted">{definition.threshold.label}</span>
            <InputNumber
              size="small"
              min={definition.threshold.min}
              max={definition.threshold.max}
              value={threshold}
              disabled={!setting.enabled || pending}
              onChange={(value) => setThreshold(value ?? setting.threshold)}
              suffix={definition.threshold.unit}
              className="!w-28"
            />
            {changed && (
              <Button
                size="small"
                type="primary"
                loading={pending}
                onClick={() => update.mutate({ key: setting.key, body: { threshold: threshold! } })}
              >
                Lưu
              </Button>
            )}
          </>
        )}
        <Switch
          checked={setting.enabled}
          loading={pending}
          aria-label={`Bật/tắt ${definition.label}`}
          onChange={(enabled) => update.mutate({ key: setting.key, body: { enabled } })}
        />
      </div>
    </li>
  );
}

/** Settings page: switch each automation on or off and tune its one threshold. */
export function AutomationSettingsCard() {
  const automations = useAutomations();
  return (
    <Card className="!mt-4">
      <SectionTitle>Tự động hóa</SectionTitle>
      <p className="mt-0 mb-1 text-[15px] text-sc-muted">
        Hệ thống tự kiểm tra định kỳ và gửi thông báo. Tự động hóa chỉ báo tin hoặc soạn nháp, không tự thay đổi dữ liệu
        hay tiền.
      </p>
      {automations.isPending ? (
        <Skeleton active paragraph={{ rows: 6 }} title={false} />
      ) : automations.isError ? (
        <ErrorState message={toApiError(automations.error).message} onRetry={() => void automations.refetch()} />
      ) : (
        <ul className="m-0 list-none p-0">
          {automations.data.map((setting) => (
            <AutomationRow key={`${setting.key}:${setting.threshold}`} setting={setting} />
          ))}
        </ul>
      )}
    </Card>
  );
}
