import { HttpErrorResponse } from '@angular/common/http';

export type ObservabilityStatus = 'loading' | 'loaded' | 'disabled' | 'missing' | 'error';

/** Distingue sección apagada, empresa inexistente y fallo técnico. */
export function observabilityFailure(error: unknown): ObservabilityStatus {
  if (!(error instanceof HttpErrorResponse) || error.status !== 404) return 'error';
  const type = (error.error as { type?: string } | null)?.type ?? '';
  return type.endsWith('tenant-not-found') ? 'missing' : 'disabled';
}
