import { z } from 'zod';

export const timeOfDaySchema = z
  .string('Giờ không hợp lệ')
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ phải có dạng HH:mm');
