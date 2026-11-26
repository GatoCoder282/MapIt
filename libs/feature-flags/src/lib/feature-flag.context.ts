/** Contexto de presentación; sessionId es un nonce por login, nunca JWT ni credencial. */
export interface FeatureFlagContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionId: string;
}

export function validFeatureFlagContext(context: FeatureFlagContext): boolean {
  return (
    typeof context.tenantId === 'string' &&
    typeof context.userId === 'string' &&
    typeof context.sessionId === 'string' &&
    /^[a-z0-9][a-z0-9-]{1,62}$/.test(context.tenantId) &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(context.userId) &&
    /^[A-Za-z0-9_-]{1,128}$/.test(context.sessionId)
  );
}
