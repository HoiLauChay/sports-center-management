import type { BankMatchCandidate } from '@sports-center/shared';
import { Button, Tag } from 'antd';
import { useBankSuggestions } from '../hooks/useManagerAi';
import { AiPanel } from './AiPanel';

interface BankMatchSuggestionsProps {
  transactionId: string;
  selectedId?: string;
  onPick: (candidate: BankMatchCandidate) => void;
}

/** Who most likely sent an unmatched transfer, ranked by phone, name and invoices for the same amount. */
export function BankMatchSuggestions({ transactionId, selectedId, onPick }: BankMatchSuggestionsProps) {
  const suggestions = useBankSuggestions(transactionId);
  const candidates = suggestions.data ?? [];
  if (suggestions.isError || (suggestions.isSuccess && candidates.length === 0)) return null;
  return (
    <AiPanel className="mb-4" title="Gợi ý người chuyển" loading={suggestions.isPending}>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {candidates.map((candidate) => (
          <li
            key={candidate.account.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                {candidate.account.fullName}
                {candidate.account.phone && (
                  <span className="font-normal text-sc-muted">{candidate.account.phone}</span>
                )}
                <Tag color={candidate.score >= 60 ? 'green' : candidate.score >= 35 ? 'gold' : 'default'}>
                  {candidate.score}%
                </Tag>
              </span>
              <span className="block text-[13px] text-sc-muted">{candidate.reasons.join(' · ')}</span>
            </span>
            <Button
              size="small"
              type={selectedId === candidate.account.id ? 'primary' : 'default'}
              onClick={() => onPick(candidate)}
            >
              {selectedId === candidate.account.id ? 'Đã chọn' : 'Chọn'}
            </Button>
          </li>
        ))}
      </ul>
    </AiPanel>
  );
}
