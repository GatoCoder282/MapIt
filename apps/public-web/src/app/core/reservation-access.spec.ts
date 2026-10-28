import { ReservationAccess } from './reservation-access';
describe('ReservationAccess', () => {
  const scope = {
    tenantSlug: 'tenant-a',
    establishmentSlug: 'venue-a',
    reservationId: 'reservation-a',
  };
  const token = 'a'.repeat(43);
  beforeEach(() => sessionStorage.clear());
  it('separa credenciales por tenant, establecimiento y reserva y sobrevive a refrescar el servicio', () => {
    const access = new ReservationAccess();
    access.save(scope, token, null);
    expect(new ReservationAccess().read(scope)).toBe(token);
    expect(access.read({ ...scope, tenantSlug: 'tenant-b' })).toBeNull();
    expect(access.read({ ...scope, reservationId: 'reservation-b' })).toBeNull();
  });
  it('rechaza tokens alterados/expirados y fragmentos ambiguos', () => {
    const access = new ReservationAccess();
    expect(access.save(scope, token, '2000-01-01T00:00:00Z')).toBe(false);
    expect(access.capture(scope, 'access=' + token + '&access=' + token)).toBe(false);
    expect(access.capture(scope, 'access=not-a-token')).toBe(false);
    expect(access.capture(scope, 'access=' + token)).toBe(true);
    expect(access.fragment(scope)).toBe('access=' + token);
    expect(access.path(scope)).not.toContain(token);
  });
});
