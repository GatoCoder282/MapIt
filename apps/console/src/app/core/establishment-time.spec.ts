import { establishmentInstant, establishmentWallTime } from './establishment-time';

it('converts the establishment wall time independently of the browser timezone', () => {
  expect(establishmentInstant('2026-11-18T20:00', 'America/La_Paz')).toBe(
    '2026-11-19T00:00:00.000Z',
  );
  expect(establishmentWallTime('2026-11-19T00:00:00.000Z', 'America/La_Paz')).toBe(
    '2026-11-18T20:00',
  );
});

it('rejects dates and local times that do not exist', () => {
  expect(establishmentInstant('2026-03-08T02:30', 'America/New_York')).toBeNull();
  expect(establishmentInstant('2026-02-30T12:00', 'America/La_Paz')).toBeNull();
});
