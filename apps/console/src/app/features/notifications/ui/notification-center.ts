import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { LucideBell } from '@lucide/angular';
import { I18nService, LocalizedDatePipe, LocalizedNumberPipe } from '@mapit/i18n';
import { STRINGS } from '../../../core/strings';
import { NotificationsStore } from '../model/notifications-store';

@Component({
  selector: 'mapit-notification-center',
  imports: [LucideBell, LocalizedDatePipe, LocalizedNumberPipe],
  providers: [NotificationsStore],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationCenter {
  protected readonly vm = inject(NotificationsStore);
  protected readonly strings = STRINGS.notifications;
  protected readonly locale = inject(I18nService).locale;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly bell = viewChild<ElementRef<HTMLButtonElement>>('bell');
  private readonly heading = viewChild<ElementRef<HTMLHeadingElement>>('heading');
  protected readonly open = linkedSignal(() => {
    this.vm.access.context();
    this.vm.access.enabled();
    return false;
  });
  protected readonly label = computed(() => {
    const count = this.vm.unreadCount();
    return count === null
      ? this.strings.title
      : this.strings.bellCount.replace(
          '{count}',
          new Intl.NumberFormat(this.locale()).format(count),
        );
  });

  protected toggle(): void {
    this.open.update((value) => !value);
    if (this.open()) {
      if (this.vm.status() === 'idle') this.vm.loadFirst();
      setTimeout(() => {
        if (this.open()) this.heading()?.nativeElement.focus();
      });
    }
  }

  protected close(): void {
    this.open.set(false);
    this.bell()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  protected escape(event: Event): void {
    if (!this.open()) return;
    event.preventDefault();
    this.close();
  }

  @HostListener('document:click', ['$event'])
  protected outside(event: Event): void {
    if (
      this.open() &&
      event.target instanceof Node &&
      !this.element.nativeElement.contains(event.target)
    ) {
      this.open.set(false);
    }
  }
}
