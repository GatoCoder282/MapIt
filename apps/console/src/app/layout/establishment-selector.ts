import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  type AfterViewInit,
  type ElementRef,
  type OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import type { AccessibleEstablishment } from '@mapit/api-client';
import { LucideArrowRight, LucideCheck, LucideStore } from '@lucide/angular';

import { STRINGS } from '../core/strings';

type EstablishmentStatus = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  selector: 'mapit-establishment-selector',
  imports: [LucideArrowRight, LucideCheck, LucideStore, NgOptimizedImage],
  templateUrl: './establishment-selector.html',
  styleUrl: './establishment-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentSelector implements AfterViewInit, OnDestroy {
  readonly establishments = input.required<readonly AccessibleEstablishment[]>();
  readonly status = input.required<EstablishmentStatus>();
  readonly canDismiss = input(false);
  readonly confirmed = output<string>();
  readonly dismissed = output<void>();
  readonly retry = output<void>();
  readonly signOut = output<void>();

  protected readonly strings = STRINGS.establishmentContext;
  protected readonly selectedId = signal<string | null>(null);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    effect(() => {
      const selected = this.selectedId();
      if (selected && !this.establishments().some((item) => item.id === selected)) {
        this.selectedId.set(null);
      }
    });
  }

  ngAfterViewInit(): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog) return;
    dialog.showModal();
    const firstRadio = dialog.querySelector<HTMLInputElement>('input[type="radio"]');
    (firstRadio ?? this.heading()?.nativeElement)?.focus();
  }

  ngOnDestroy(): void {
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open) dialog.close();
  }

  protected dismiss(): void {
    if (this.canDismiss()) this.dismissed.emit();
  }

  protected preventDismiss(event: Event): void {
    event.preventDefault();
    this.dismiss();
  }

  protected choose(id: string): void {
    if (this.establishments().some((item) => item.id === id)) this.selectedId.set(id);
  }

  protected continue(): void {
    const id = this.selectedId();
    if (id && this.establishments().some((item) => item.id === id)) this.confirmed.emit(id);
  }
}
