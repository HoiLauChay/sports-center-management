import type { Evaluation, SessionNote } from '@sports-center/shared';

import { toSessionResponse } from '~/mappers/class.mapper';
import type { EvaluationRow, TrainingSessionRow } from '~/repositories/training.repository';

export const toSessionNoteResponse = (row: TrainingSessionRow): SessionNote | null =>
  row.noteTitle === null || row.noteUpdatedAt === null
    ? null
    : {
        title: row.noteTitle,
        content: row.noteContent ?? '',
        attachments: Array.isArray(row.noteAttachments) ? (row.noteAttachments as string[]) : [],
        updatedAt: row.noteUpdatedAt.toISOString(),
      };

export const toEvaluationResponse = (row: EvaluationRow): Evaluation => ({
  id: row.id,
  session: toSessionResponse(row.session),
  account: row.account,
  coach: row.coach,
  rating: row.rating,
  comment: row.comment,
  createdAt: row.createdAt.toISOString(),
});
