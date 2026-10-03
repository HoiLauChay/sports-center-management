import { env } from '~/configs/env';

export interface SepayTransaction {
  id: string;
  transaction_date: string;
  account_number: string;
  transfer_type: 'in' | 'out';
  amount_in: number;
  transaction_content: string;
  reference_number: string | null;
  bank_brand_name: string;
  webhook_success: number | null;
}

interface SepayPage {
  data: SepayTransaction[];
  meta: { pagination: { has_more: boolean } };
}

const PER_PAGE = 100;
const TIMEOUT_MS = 10_000;

export class SepayUnavailableError extends Error {}

const fetchPage = async (query: Record<string, string>, page: number): Promise<SepayPage> => {
  const params = new URLSearchParams({
    ...query,
    transfer_type: 'in',
    transaction_date_sort: 'asc',
    per_page: String(PER_PAGE),
    page: String(page),
  });
  const url = `${env.SEPAY_API_BASE_URL!.replace(/\/$/, '')}/v2/transactions?${params}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${env.SEPAY_API_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SepayUnavailableError(`SePay request failed: ${(err as Error).message}`);
  }
  if (!response.ok) throw new SepayUnavailableError(`SePay responded ${response.status}`);
  return (await response.json()) as SepayPage;
};

export const sepayApi = {
  isConfigured: () => Boolean(env.SEPAY_API_BASE_URL && env.SEPAY_API_TOKEN && env.SEPAY_BANK_ACCOUNT),

  async *incomingPages({ from, to }: { from: string; to?: string }) {
    const query = { transaction_date_from: from, ...(to && { transaction_date_to: to }) };
    for (let page = 1; ; page++) {
      const { data, meta } = await fetchPage(query, page);
      yield data.filter(
        (row) => row.transfer_type === 'in' && row.amount_in > 0 && row.account_number === env.SEPAY_BANK_ACCOUNT,
      );
      if (!meta.pagination.has_more) return;
    }
  },
};
