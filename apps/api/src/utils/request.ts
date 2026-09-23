import type { Request } from 'express';

export const getClientIp = (req: Request) => req.get('x-real-ip') ?? req.ip;
