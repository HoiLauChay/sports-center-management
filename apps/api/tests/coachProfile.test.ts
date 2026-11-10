import type { CoachPublicProfile } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(resetDatabase);

describe('coach public profile', () => {
  test('a member sees the coach bio and approved sports, never contact details', async () => {
    const coach = await createAccount('COACH', 'coach@example.com', {
      fullName: 'Coach A',
      phone: '0900000001',
      address: 'Somewhere',
      dateOfBirth: new Date('1990-01-01'),
      coachProfile: { create: { bio: 'Bio', experience: '5 năm', certifications: 'Cert' } },
    });
    const [tennis, yoga, swim] = await Promise.all(
      ['Tennis', 'Yoga', 'Bơi'].map((name) => prisma.sport.create({ data: { name } })),
    );
    await prisma.coachSpecialization.createMany({
      data: [
        { coachId: coach.id, sportId: yoga!.id, status: 'APPROVED', experienceYears: 3 },
        { coachId: coach.id, sportId: tennis!.id, status: 'APPROVED' },
        { coachId: coach.id, sportId: swim!.id, status: 'PENDING' },
      ],
    });
    const member = await createAccount('MEMBER', 'member@example.com');

    const response = await request('GET', `/coaches/${coach.id}`, member);
    expect(response.status).toBe(200);
    const profile = await readResult<CoachPublicProfile>(response);
    expect(profile).toEqual({
      id: coach.id,
      fullName: 'Coach A',
      avatarUrl: null,
      coverImageUrl: null,
      bio: 'Bio',
      experience: '5 năm',
      certifications: 'Cert',
      sports: [
        { id: tennis!.id, name: 'Tennis', iconUrl: null, experienceYears: null },
        { id: yoga!.id, name: 'Yoga', iconUrl: null, experienceYears: 3 },
      ],
    });
  });

  test('an account that is not an active coach has no coach profile', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const locked = await createAccount('COACH', 'locked@example.com', { status: 'BANNED' });

    expect((await request('GET', `/coaches/${member.id}`, member)).status).toBe(404);
    expect((await request('GET', `/coaches/${locked.id}`, member)).status).toBe(404);
  });
});
