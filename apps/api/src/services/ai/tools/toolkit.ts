import { z } from 'zod';

import type { AssistantRole } from '@sports-center/shared';

import type { FunctionDeclaration } from '~/services/ai/gemini.client';
import sportService from '~/services/sport.service';
import { addDays, todayInCenter } from '~/utils/time';

/** Who is asking. Tools read only what this account may see; the model never chooses the account. */
export interface ToolContext {
  accountId: string;
  role: AssistantRole;
}

/** The JSON schema of a tool's arguments, as Gemini reads it. */
export type ToolParameters = NonNullable<FunctionDeclaration['parameters']>;

export interface Tool {
  declaration: FunctionDeclaration;
  /** Checks the arguments the model sent before anything runs. */
  args: z.ZodType;
  run: (context: ToolContext, args: never) => Promise<unknown>;
}

export const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
/** The model miscounts weekdays; every date it is given carries its weekday. */
export const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;

export const MAX_SCHEDULE_DAYS = 14;

export const isoDate = z.iso.date('Ngày phải có dạng YYYY-MM-DD');
export const noArgs = z.object({});
export const classIdArg = z.object({ classId: z.uuid('Mã lớp không hợp lệ') });

export const dateRangeArgs = z.object({ from: isoDate.optional(), to: isoDate.optional() });
export const dateRangeParams: ToolParameters = {
  type: 'OBJECT',
  properties: {
    from: { type: 'STRING', format: 'date', description: 'Từ ngày, YYYY-MM-DD' },
    to: { type: 'STRING', format: 'date', description: 'Đến ngày, YYYY-MM-DD' },
  },
  required: [],
};

/** A range of at most MAX_SCHEDULE_DAYS days, from today for a week by default; null when out of bounds. */
export const dateRange = (args: { from?: string; to?: string }) => {
  const from = args.from ?? todayInCenter();
  const to = args.to ?? addDays(from, 7);
  return to < from || to > addDays(from, MAX_SCHEDULE_DAYS - 1) ? null : { from, to };
};

export const badRange = { error: `Khoảng ngày phải hợp lệ và tối đa ${MAX_SCHEDULE_DAYS} ngày` };

export const findSportId = async (name?: string) => {
  if (!name) return undefined;
  const wanted = name.toLowerCase();
  const sports = await sportService.list(false);
  return sports.find((sport) => sport.name.toLowerCase().includes(wanted))?.id ?? null;
};

export const tool = <S extends z.ZodType>(
  declaration: FunctionDeclaration,
  args: S,
  run: (context: ToolContext, args: z.infer<S>) => Promise<unknown>,
): Tool => ({ declaration, args, run: run as Tool['run'] });
