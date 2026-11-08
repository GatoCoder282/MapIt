import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnInit,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  LucideBuilding2,
  LucideCalendarDays,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClipboardList,
  LucideSearch,
  LucideTable,
  LucideX,
} from '@lucide/angular';
import type { AuditEventType, AuditResourceType } from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { I18nService, LocalizedDatePipe, LocalizedNumberPipe } from '@mapit/i18n';

import { localizeString, STRINGS } from '../../../core/strings';
import { auditEntryView } from '../model/audit-entry';
import { type AuditPeriod, AuditStore } from '../model/audit-store';

/** Historial de acciones de negocio visible exclusivamente para ADMIN del tenant. */
@Component({
  selector: 'mapit-audit-page',
  imports: [
    LocalizedDatePipe,
    LocalizedNumberPipe,
    LucideBuilding2,
    LucideCalendarDays,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClipboardList,
    LucideSearch,
    LucideTable,
    LucideX,
  ],
  providers: [AuditStore],
  templateUrl: './audit-page.html',
  styleUrl: './audit-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditPage implements OnInit {
  private readonly user = inject(AuthSession).user;
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private readonly detailHeading = viewChild<ElementRef<HTMLElement>>('detailHeading');
  private readonly eventButtons = viewChildren<ElementRef<HTMLButtonElement>>('eventButton');
  private readonly focusDetail = signal(false);
  private copyVersion = 0;

  protected readonly localizeString = localizeString;
  protected readonly locale = inject(I18nService).locale;
  protected readonly store = inject(AuditStore);
  protected readonly strings = STRINGS.audit;
  protected readonly copyFeedback = signal('');
  protected readonly rows = computed(() =>
    this.store.entries().map((entry) => auditEntryView(entry, this.user())),
  );
  protected readonly selected = computed(() => {
    const id = this.store.selectedId();
    return this.rows().find((item) => item.entry.id === id);
  });
  protected readonly periodOptions = computed<ReadonlyArray<{ value: AuditPeriod; label: string }>>(
    () => [
      { value: 'week', label: this.strings.last7Days },
      { value: 'month', label: this.strings.last30Days },
      { value: 'all', label: this.strings.allDates },
      { value: 'custom', label: this.strings.customDates },
    ],
  );
  protected readonly resourceOptions = computed<
    ReadonlyArray<{ value: AuditResourceType | ''; label: string }>
  >(() => [
    { value: '', label: this.strings.allResources },
    { value: 'RESERVATION', label: this.strings.resourceLabels.RESERVATION },
    { value: 'SPACE_ELEMENT', label: this.strings.resourceLabels.SPACE_ELEMENT },
  ]);
  protected readonly eventOptions = computed<
    ReadonlyArray<{ value: AuditEventType | ''; label: string }>
  >(() => [
    { value: '', label: this.strings.allEvents },
    { value: 'RESERVATION_CREATED', label: this.strings.eventLabels.RESERVATION_CREATED },
    {
      value: 'RESERVATION_STATUS_CHANGED',
      label: this.strings.eventLabels.RESERVATION_STATUS_CHANGED,
    },
    {
      value: 'SPACE_ELEMENT_STATE_CHANGED',
      label: this.strings.eventLabels.SPACE_ELEMENT_STATE_CHANGED,
    },
  ]);

  constructor() {
    afterRenderEffect({
      write: () => {
        if (!this.focusDetail()) return;
        const heading = this.detailHeading()?.nativeElement;
        if (!heading) return;
        heading.focus();
        this.focusDetail.set(false);
      },
    });
  }

  ngOnInit(): void {
    this.store.refresh();
  }

  protected openDetail(id: string): void {
    this.copyVersion++;
    this.copyFeedback.set('');
    this.store.select(id);
    this.focusDetail.set(true);
  }

  protected closeDetail(): void {
    this.copyVersion++;
    const id = this.store.selectedId();
    const opener = this.eventButtons().find(
      (button) => button.nativeElement.dataset['auditId'] === id,
    );
    this.focusDetail.set(false);
    this.store.select(null);
    (opener ?? this.pageHeading())?.nativeElement.focus();
  }

  protected async copy(value: string): Promise<void> {
    const version = ++this.copyVersion;
    try {
      await navigator.clipboard.writeText(value);
      if (version === this.copyVersion) this.copyFeedback.set(this.strings.copied);
    } catch {
      if (version === this.copyVersion) this.copyFeedback.set(this.strings.copyError);
    }
  }
}
