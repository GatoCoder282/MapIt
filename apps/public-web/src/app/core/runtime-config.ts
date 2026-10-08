import { Injectable, inject, provideAppInitializer, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Logger, type LogLevel } from '@mapit/logging';
import { API_BASE_URL } from './config';

interface PublicConfig {
  readonly apiBaseUrl: string;
  readonly environment: string;
  readonly logLevel: LogLevel;
}

@Injectable({ providedIn: 'root' })
export class PublicRuntimeConfig {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(Logger);
  private readonly state = signal<PublicConfig>({
    apiBaseUrl: API_BASE_URL,
    environment: 'development',
    logLevel: 'INFO',
  });
  readonly config = this.state.asReadonly();

  async load(): Promise<void> {
    try {
      const config = await firstValueFrom(
        this.http.get<Partial<PublicConfig>>('/assets/config.json'),
      );
      this.state.update((current) => ({ ...current, ...config }));
      this.logger.configure(this.config());
    } catch {
      this.logger.configure(this.config());
      this.logger.log('WARN', 'config.fallback');
    }
  }
}

export function providePublicRuntimeConfig() {
  return provideAppInitializer(() => inject(PublicRuntimeConfig).load());
}
