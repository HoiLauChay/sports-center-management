import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';
import type { Server } from 'node:http';
import { PDFDocument } from 'pdf-lib';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { cookieOf, createAccount, startServer } from './helpers/http';

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  ({ server } = await startServer(''));
  baseUrl = `http://localhost:${(server.address() as { port: number }).port}/api/v1/reports/export`;
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('report export', () => {
  test('a manager downloads reports as Excel and PDF with Vietnamese labels', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const to = todayInCenter();
    const range = `from=${addDays(to, -6)}&to=${to}`;
    const download = (query: string) => fetch(`${baseUrl}?${query}`, { headers: { cookie: cookieOf(manager) } });

    const xlsx = await download(`report=revenue&format=xlsx&${range}`);
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers.get('content-disposition')).toContain('.xlsx');
    const files = unzipSync(new Uint8Array(await xlsx.arrayBuffer()));
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('Theo phương thức');

    const pdf = await download(`report=facilities&format=pdf&${range}`);
    expect([pdf.status, pdf.headers.get('content-type')]).toEqual([200, 'application/pdf']);
    expect((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount()).toBeGreaterThan(0);

    const member = await createAccount('MEMBER', 'member@example.com');
    const denied = await fetch(`${baseUrl}?report=overview&format=pdf&${range}`, {
      headers: { cookie: cookieOf(member) },
    });
    expect(denied.status).toBe(403);
  });
});
