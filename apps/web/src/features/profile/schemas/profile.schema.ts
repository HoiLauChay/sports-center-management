import { updateMeBodySchema } from '@sports-center/shared';
import type { z } from 'zod';

export const profileSchema = updateMeBodySchema;

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormValues = z.infer<typeof profileSchema>;
