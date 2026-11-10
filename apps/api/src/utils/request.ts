import type { Request } from 'express';

/**
 * `x-real-ip` is set by Vercel's proxy, which overwrites whatever the client sent. Anywhere else the header is the
 * client's own word, so it is ignored and the socket address is used.
 */
const behindVercel = process.env.VERCEL === '1';

export const getClientIp = (req: Request) => (behindVercel ? (req.get('x-real-ip') ?? req.ip) : req.ip);
