import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  BusinessApplicationDetail,
  BusinessApplicationPage,
  BusinessApplicationStatus,
} from '@mapit/api-client';
import type { Observable } from 'rxjs';
import { BusinessApplicationsApi } from '../data/business-applications-api';

@Injectable()
export class BusinessApplicationsStore {
  private readonly api = inject(BusinessApplicationsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly search = signal('');
  readonly status = signal<BusinessApplicationStatus | ''>('PENDING');
  readonly page = signal(0);
  readonly result = signal<BusinessApplicationPage | null>(null);
  readonly selected = signal<BusinessApplicationDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly deciding = signal(false);
  readonly decisionError = signal(false);
  private request = 0;

  load(): void {
    const current = ++this.request;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .list(this.search().trim(), this.status(), this.page())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (current === this.request) {
            this.result.set(result);
            this.loading.set(false);
          }
        },
        error: () => {
          if (current === this.request) {
            this.error.set(true);
            this.loading.set(false);
          }
        },
      });
  }

  filter(search: string, status: BusinessApplicationStatus | ''): void {
    this.search.set(search);
    this.status.set(status);
    this.page.set(0);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  loadDetail(id: string): void {
    const current = ++this.request;
    this.loading.set(true);
    this.error.set(false);
    this.api
      .detail(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (current === this.request) {
            this.selected.set(detail);
            this.loading.set(false);
          }
        },
        error: () => {
          if (current === this.request) {
            this.error.set(true);
            this.loading.set(false);
          }
        },
      });
  }

  approve(id: string, slug: string): void {
    this.decide(this.api.approve(id, slug));
  }

  reject(id: string, reason: string): void {
    this.decide(this.api.reject(id, reason));
  }

  private decide(result: Observable<BusinessApplicationDetail>): void {
    this.deciding.set(true);
    this.decisionError.set(false);
    result.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => {
        this.selected.set(detail);
        this.deciding.set(false);
      },
      error: () => {
        this.decisionError.set(true);
        this.deciding.set(false);
      },
    });
  }
}
