import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { type MerchantPaymentMethod, type MockQrConfiguration } from '@mapit/api-client';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCheck,
  LucideCreditCard,
  LucideEllipsisVertical,
  LucideFlaskConical,
  LucidePlus,
  LucideCircleCheck,
  LucidePause,
  LucideQrCode,
  LucideStore,
} from '@lucide/angular';
import { EstablishmentContext } from '../../../core/establishment-context';
import { confirmOperationalExit } from '../../../core/operational-exit-guard';
import { STRINGS } from '../../../core/strings';
import { PaymentCatalogStore } from '../model/payment-catalog-store';
import { PaymentMethodsStore } from '../model/payment-methods-store';
import { SearchSelect } from './search-select';

type Provider = MerchantPaymentMethod['provider'];
type Screen = 'list' | 'policies' | 'type' | 'configure' | 'review' | 'success' | 'detail';
type Saved = { readonly enabled: boolean; readonly edited: boolean };

@Component({
  selector: 'mapit-payment-methods',
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    NgTemplateOutlet,
    SearchSelect,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCheck,
    LucideCircleCheck,
    LucideCreditCard,
    LucideEllipsisVertical,
    LucideFlaskConical,
    LucidePlus,
    LucidePause,
    LucideQrCode,
    LucideStore,
  ],
  providers: [PaymentMethodsStore, PaymentCatalogStore],
  templateUrl: './payment-methods.html',
  styleUrls: ['./payment-methods.scss', './payment-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethods {
  private readonly context = inject(EstablishmentContext);
  protected readonly strings = STRINGS.paymentMethods;
  protected readonly copy = STRINGS.paymentFlow;
  protected readonly store = inject(PaymentMethodsStore);
  protected readonly catalog = inject(PaymentCatalogStore);
  protected readonly methodTotals = computed(() => {
    const methods = [...this.catalog.methods(), ...this.store.configurations()];
    const active = methods.filter((method) => method.enabled).length;
    return { active, inactive: methods.length - active };
  });
  protected readonly active = computed(() =>
    this.context.status() === 'ready' ? this.context.active() : null,
  );
  private readonly scope = computed(() => this.active()?.id ?? null);
  protected readonly screen = linkedSignal<Screen>(() => {
    this.scope();
    return 'list';
  });
  protected readonly provider = linkedSignal<Provider | null>(() => {
    this.scope();
    return null;
  });
  private readonly legacyMock = linkedSignal(() => {
    this.scope();
    return false;
  });
  protected readonly saved = linkedSignal<Saved | null>(() => {
    this.scope();
    return null;
  });
  protected readonly detail = linkedSignal<MerchantPaymentMethod | null>(() => {
    this.scope();
    return null;
  });
  protected readonly invalid = linkedSignal(() => {
    this.screen();
    return false;
  });
  protected readonly mock = computed(
    () => this.provider() === 'MOCK_GATEWAY' && !this.legacyMock(),
  );
  protected readonly editing = computed(() =>
    this.mock() ? !!this.store.editingId() : !!this.catalog.editingId(),
  );
  protected readonly canProceed = computed(() =>
    this.mock() ? this.store.canSave() : this.catalog.canSave(),
  );
  protected readonly busy = computed(() => this.store.busy() || this.catalog.busy());
  protected readonly steps = ['type', 'configure', 'review'] as const;
  protected readonly stepIndex = computed(() =>
    this.steps.findIndex((step) => step === this.screen()),
  );
  protected readonly providers = computed<readonly Provider[]>(() => {
    const providers: Provider[] = ['STATIC_BANK_QR', 'INTEGRATED_GATEWAY'];
    if (this.store.allowed && !this.store.loading() && this.store.countries().length > 0) {
      providers.push('MOCK_GATEWAY');
    }
    return providers;
  });

  private readonly heading = viewChild<ElementRef<HTMLElement>>('viewHeading');

  constructor() {
    afterRenderEffect(() => {
      if (this.screen() !== 'list' || this.hasNavigated) this.heading()?.nativeElement.focus();
    });
  }

  private hasNavigated = false;

  canDeactivate(): boolean {
    return confirmOperationalExit(this.busy(), this.store.dirty() || this.catalog.dirty());
  }

  protected providerLabel(provider: Provider): string {
    switch (provider) {
      case 'STATIC_BANK_QR':
        return this.copy.bankQr;
      case 'INTEGRATED_GATEWAY':
        return this.copy.gateway;
      case 'MOCK_GATEWAY':
        return this.copy.mock;
    }
  }

  protected providerInfo(provider: Provider): string {
    switch (provider) {
      case 'STATIC_BANK_QR':
        return this.copy.bankQrInfo;
      case 'INTEGRATED_GATEWAY':
        return this.copy.gatewayInfo;
      case 'MOCK_GATEWAY':
        return this.copy.mockInfo;
    }
  }

  protected start(): void {
    if (this.busy() || !this.catalog.canManage()) return;
    this.legacyMock.set(false);
    this.provider.set(null);
    this.saved.set(null);
    this.show('type');
  }

  protected show(screen: Screen): void {
    this.hasNavigated = true;
    this.screen.set(screen);
  }

  protected choose(): void {
    const provider = this.provider();
    if (!provider || !this.providers().includes(provider) || this.busy()) return;
    if (this.screen() !== 'type') return;
    if (provider === 'MOCK_GATEWAY') {
      if (this.catalog.dirty() && !confirmOperationalExit(false, true)) return;
      this.catalog.cancel();
      if (this.store.editingId() || this.store.draft().establishmentId !== this.scope()) {
        this.store.startNew();
      }
    } else if (this.catalog.draft()?.provider !== provider) {
      if (!confirmOperationalExit(false, this.store.dirty() || this.catalog.dirty())) return;
      if (this.store.dirty()) this.store.startNew();
      this.catalog.start(provider);
    }
    this.show('configure');
  }

  protected editMock(method: MockQrConfiguration): void {
    if (this.busy() || method.establishmentId !== this.scope()) return;
    this.legacyMock.set(false);
    this.provider.set('MOCK_GATEWAY');
    void this.store.selectConfiguration(method);
    this.show('configure');
  }

  protected view(method: MerchantPaymentMethod): void {
    this.detail.set(method);
    this.show('detail');
  }

  protected edit(method: MerchantPaymentMethod): void {
    if (this.busy()) return;
    this.catalog.edit(method);
    if (this.catalog.editingId() !== method.id) return;
    this.legacyMock.set(method.provider === 'MOCK_GATEWAY');
    this.provider.set(method.provider);
    this.show('configure');
  }

  protected review(form: HTMLFormElement): void {
    if (this.screen() !== 'configure') return;
    if (!form.reportValidity()) return;
    if (!this.canProceed()) {
      this.invalid.set(true);
      return;
    }
    this.show('review');
  }

  protected async save(): Promise<void> {
    if (this.screen() !== 'review' || !this.canProceed() || this.busy()) return;
    const scope = this.scope();
    const edited = this.editing();
    const saved = this.mock() ? await this.store.save() : await this.catalog.save();
    if (!saved || scope !== this.scope() || this.screen() !== 'review') return;
    this.saved.set({ enabled: saved.enabled, edited });
    this.show('success');
  }

  protected cancel(): void {
    if (!this.canDeactivate()) return;
    if (this.mock() || this.store.dirty()) this.store.startNew();
    this.catalog.cancel();
    this.provider.set(null);
    this.saved.set(null);
    this.detail.set(null);
    this.show('list');
  }

  protected upload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file) void this.catalog.uploadQr(file);
    input.value = '';
  }
}
