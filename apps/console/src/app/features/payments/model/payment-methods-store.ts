import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  MockQrService,
  PaymentPoliciesService,
  type AccessibleEstablishment,
  type MockQrConfiguration,
  type MockQrConfigurationWrite,
  type PaymentCountry,
  type PaymentPolicy,
  type PaymentReadiness,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { firstValueFrom, forkJoin } from 'rxjs';

import { RuntimeConfigStore } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';
import { EstablishmentContext } from '../../../core/establishment-context';

export interface QrDraft {
  readonly establishmentId: string;
  readonly country: string;
  readonly bankName: string;
  readonly accountHolderName: string;
  readonly accountReference: string;
  readonly enabled: boolean;
}

interface PolicyDraft {
  enabled: boolean | null;
  currency: string;
  depositAmount: string;
  totalAmount: string;
  paymentWindowMinutes: string;
}
const EMPTY_POLICY: PolicyDraft = {
  enabled: null,
  currency: '',
  depositAmount: '',
  totalAmount: '',
  paymentWindowMinutes: '',
};

function validMoney(value: string, digits: number): boolean {
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  return !!match && (match[2]?.length ?? 0) <= digits;
}

function amountUnits(value: string, digits: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 10n ** BigInt(digits) + BigInt(fraction.padEnd(digits, '0') || '0');
}

const EMPTY: QrDraft = {
  establishmentId: '',
  country: '',
  bankName: '',
  accountHolderName: '',
  accountReference: '',
  enabled: true,
};

const QR_PATH = /^\/simulacion\/qr\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Configuración QR de prueba persistida por el servidor.
 *
 * El QR se reconstruye desde `simulationPath`; nunca se envían datos bancarios
 * dentro de la imagen. El token lo genera el backend y se rota al regenerar.
 */
@Injectable()
export class PaymentMethodsStore {
  private readonly session = inject(AuthSession);
  private readonly context = inject(EstablishmentContext);
  private readonly destroyRef = inject(DestroyRef);
  private readonly runtime = inject(RuntimeConfigStore);
  private readonly qrApi = inject(MockQrService);
  private readonly policiesApi = inject(PaymentPoliciesService);
  private readonly owner = signal(this.session.user());
  private readonly countriesState = signal<readonly PaymentCountry[]>([]);
  private readonly configurationsState = signal<readonly MockQrConfiguration[]>([]);
  private readonly draftState = signal<QrDraft>({ ...EMPTY });
  private readonly editingIdState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly savingState = signal(false);
  private readonly regeneratingState = signal(false);
  private readonly qrBusyState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly successState = signal<string | null>(null);
  private readonly qrState = signal<string | null>(null);
  private readonly qrUrlState = signal<string | null>(null);
  private readonly qrErrorState = signal<string | null>(null);
  private readonly readinessState = signal<PaymentReadiness | null>(null);
  private readonly readinessErrorState = signal<string | null>(null);
  private readonly readinessLoadingState = signal(false);
  private readonly policySavingState = signal(false);
  private readonly policyErrorState = signal<string | null>(null);
  private readonly policySuccessState = signal<string | null>(null);
  private readonly policyDraftState = signal<PolicyDraft>({ ...EMPTY_POLICY });
  private readonly writesInFlight = signal(0);
  private policyEpoch = 0;
  private policyWriteEpoch = 0;
  private requestEpoch = 0;
  private qrVersion = 0;
  private loadedActiveId: string | null = null;
  private contextGeneration = 0;
  private qrBaseline: QrDraft = { ...EMPTY };
  private policyBaseline: PolicyDraft = { ...EMPTY_POLICY };

  readonly allowed = ['development', 'dev', 'test'].includes(this.runtime.config().environment);
  readonly countries = this.countriesState.asReadonly();
  readonly configurations = this.configurationsState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly editingId = this.editingIdState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly saving = this.savingState.asReadonly();
  readonly regenerating = this.regeneratingState.asReadonly();
  readonly qrBusy = this.qrBusyState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly success = this.successState.asReadonly();
  readonly qr = this.qrState.asReadonly();
  readonly qrUrl = this.qrUrlState.asReadonly();
  readonly qrError = this.qrErrorState.asReadonly();
  readonly isAdmin = computed(() => this.session.user()?.role === 'ADMIN');
  readonly readiness = this.readinessState.asReadonly();
  readonly readinessError = this.readinessErrorState.asReadonly();
  readonly readinessLoading = this.readinessLoadingState.asReadonly();
  readonly policySaving = this.policySavingState.asReadonly();
  readonly policyError = this.policyErrorState.asReadonly();
  readonly policySuccess = this.policySuccessState.asReadonly();
  readonly policyDraft = this.policyDraftState.asReadonly();
  readonly busy = computed(() => this.writesInFlight() > 0 || this.qrBusy());
  readonly dirty = computed(
    () =>
      !sameQr(this.draft(), this.qrBaseline) ||
      !samePolicy(this.policyDraft(), this.policyBaseline),
  );
  readonly blockerLabels = computed(() =>
    (this.readiness()?.blockers ?? []).map((code) => STRINGS.paymentMethods.blockers[code]),
  );
  readonly canSavePolicy = computed(() => {
    const draft = this.policyDraft();
    if (
      !this.canManage() ||
      !this.allowed ||
      !this.readiness() ||
      this.readinessLoading() ||
      this.policySaving()
    )
      return false;
    if (
      draft.enabled === null ||
      !/^[A-Z]{3}$/.test(draft.currency) ||
      !Intl.supportedValuesOf('currency').includes(draft.currency) ||
      !/^\d+$/.test(draft.paymentWindowMinutes)
    )
      return false;
    const minutes = Number(draft.paymentWindowMinutes);
    if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes > 120) return false;
    let digits: number;
    try {
      digits =
        new Intl.NumberFormat('en', {
          style: 'currency',
          currency: draft.currency,
        }).resolvedOptions().maximumFractionDigits ?? 0;
    } catch {
      return false;
    }
    if (!validMoney(draft.depositAmount, digits) || amountUnits(draft.depositAmount, digits) === 0n)
      return false;
    if (
      draft.totalAmount.trim() &&
      (!validMoney(draft.totalAmount, digits) ||
        amountUnits(draft.totalAmount, digits) < amountUnits(draft.depositAmount, digits))
    )
      return false;
    return true;
  });

  readonly countryOptions = computed(() =>
    this.countriesState().map((item) => ({
      value: item.code,
      label: `${item.name} (${item.code})`,
    })),
  );
  readonly selectedConfiguration = computed(
    () =>
      this.configurationsState().find(
        (configuration) => configuration.id === this.editingIdState(),
      ) ?? null,
  );
  readonly bankSuggestions = computed(() => {
    const country = this.draftState().country;
    return [
      ...new Set(
        this.configurationsState()
          .filter((configuration) => configuration.country === country)
          .map((configuration) => configuration.bankName),
      ),
    ].sort((a, b) => a.localeCompare(b, 'es'));
  });
  readonly canSave = computed(
    () =>
      this.canManage() && !this.loading() && !this.busy() && this.validSelection(this.draftState()),
  );
  readonly establishmentName = (id: string): string =>
    (this.context.active()?.id === id ? this.context.active()?.name : undefined) ??
    STRINGS.paymentMethods.unknownEstablishment;
  readonly countryName = (code: string): string =>
    this.countriesState().find((item) => item.code === code)?.name ?? code;

  constructor() {
    effect(() => {
      const active = this.context.active();
      const status = this.context.status();
      untracked(() => this.changeContext(active, status));
    });
    this.destroyRef.onDestroy(() => {
      this.requestEpoch++;
      this.policyEpoch++;
      this.qrVersion++;
    });
    effect(() => {
      const user = this.session.user();
      untracked(() => {
        if (!sameUser(user, this.owner())) {
          this.owner.set(user);
          this.resetState();
          if (user && this.allowed) void this.load();
        }
      });
    });
  }

  async load(): Promise<void> {
    if (!this.canManage()) return;
    const active = this.context.active();
    if (!active || this.context.status() !== 'ready') return;
    const epoch = ++this.requestEpoch;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [countries, allConfigurations] = await firstValueFrom(
        forkJoin([this.qrApi.listMockQrCountries(), this.qrApi.listMockQrConfigurations()]),
      );
      if (!this.scopeCurrent(epoch, active.id)) return;
      const configurations = allConfigurations.filter((item) => item.establishmentId === active.id);
      this.countriesState.set(countries);
      this.configurationsState.set(configurations);
      this.loadedActiveId = active.id;
      this.loadingState.set(false);
      const [first] = configurations;
      if (first) {
        await this.initializeConfiguration(first);
      } else {
        this.startNew(active.id);
      }
    } catch (error) {
      if (!this.scopeCurrent(epoch, active.id)) return;
      this.errorState.set(this.loadError(error));
    } finally {
      if (epoch === this.requestEpoch) this.loadingState.set(false);
    }
  }

  async selectConfiguration(configuration: MockQrConfiguration): Promise<void> {
    if (!this.owns(configuration) || this.busy()) return;
    await this.initializeConfiguration(configuration);
  }

  private async initializeConfiguration(configuration: MockQrConfiguration): Promise<void> {
    if (!this.owns(configuration)) return;
    this.requestEpoch++;
    this.applyConfiguration(configuration);
    this.qrBaseline = { ...this.draft() };
    const epoch = this.requestEpoch;
    await this.loadReadiness(configuration.establishmentId);
    if (!this.current(epoch, configuration.establishmentId)) return;
    this.errorState.set(null);
    this.successState.set(null);
    await this.renderQr(configuration);
  }

  startNew(establishmentId = this.currentActiveId() ?? ''): void {
    if (!this.canManage() || !establishmentId || establishmentId !== this.currentActiveId()) return;
    this.requestEpoch++;
    this.qrVersion++;
    this.editingIdState.set(null);
    this.clearReadiness();
    this.draftState.set({ ...EMPTY, establishmentId });
    this.qrBaseline = { ...this.draft() };
    this.qrState.set(null);
    this.qrUrlState.set(null);
    this.qrErrorState.set(null);
    this.errorState.set(null);
    this.successState.set(null);
    void this.loadReadiness(establishmentId);
  }

  setCountry(code: string): void {
    this.draftState.update((draft) => ({ ...draft, country: code }));
    this.clearFeedback();
  }

  setBankName(value: string): void {
    this.draftState.update((draft) => ({ ...draft, bankName: value }));
    this.clearFeedback();
  }

  setAccountHolder(value: string): void {
    this.draftState.update((draft) => ({ ...draft, accountHolderName: value }));
    this.clearFeedback();
  }

  setAccountReference(value: string): void {
    this.draftState.update((draft) => ({ ...draft, accountReference: value }));
    this.clearFeedback();
  }

  setEnabled(enabled: boolean): void {
    this.draftState.update((draft) => ({ ...draft, enabled }));
    this.clearFeedback();
  }

  async save(): Promise<MockQrConfiguration | undefined> {
    if (!this.canManage() || this.busy() || !this.isLoadedForActive()) return;
    const activeId = this.currentActiveId()!;
    const draft = clean(this.draftState());
    if (!this.validSelection(draft)) {
      this.errorState.set(STRINGS.paymentMethods.invalid);
      this.successState.set(null);
      return;
    }
    const epoch = ++this.requestEpoch;
    this.savingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);
    const write: MockQrConfigurationWrite = draft;
    this.beginWrite();
    try {
      const id = this.editingIdState();
      if (
        id &&
        !this.configurations().some((item) => item.id === id && item.establishmentId === activeId)
      )
        return;
      const saved = id
        ? await firstValueFrom(
            this.qrApi.updateMockQrConfiguration({
              configurationId: id,
              mockQrConfigurationWrite: write,
            }),
          )
        : await firstValueFrom(
            this.qrApi.createMockQrConfiguration({ mockQrConfigurationWrite: write }),
          );
      if (!this.current(epoch, activeId) || saved.establishmentId !== activeId) return;
      this.upsert(saved);
      this.applyConfiguration(saved);
      this.qrBaseline = { ...this.draft() };
      await this.loadReadiness(saved.establishmentId);
      if (!this.current(epoch, activeId)) return;
      this.successState.set(STRINGS.paymentMethods.success);
      await this.renderQr(saved);
      return this.current(epoch, activeId) ? saved : undefined;
    } catch (error) {
      if (!this.current(epoch, activeId)) return;
      this.errorState.set(this.saveError(error));
      return;
    } finally {
      this.endWrite();
      if (epoch === this.requestEpoch) this.savingState.set(false);
    }
  }

  async toggle(configuration: MockQrConfiguration): Promise<void> {
    if (!this.canManage() || this.busy() || !this.owns(configuration)) return;
    const epoch = ++this.requestEpoch;
    const activeId = this.currentActiveId()!;
    this.savingState.set(true);
    this.errorState.set(null);
    this.beginWrite();
    try {
      const saved = await firstValueFrom(
        this.qrApi.updateMockQrConfiguration({
          configurationId: configuration.id,
          mockQrConfigurationWrite: { ...writeOf(configuration), enabled: !configuration.enabled },
        }),
      );
      if (!this.current(epoch, activeId) || saved.establishmentId !== activeId) return;
      this.upsert(saved);
      if (this.editingIdState() === saved.id) {
        this.applyConfiguration(saved);
        this.qrBaseline = { ...this.draft() };
      }
      if (this.draft().establishmentId === saved.establishmentId) {
        await this.loadReadiness(saved.establishmentId);
        if (!this.current(epoch, activeId)) return;
      }
    } catch {
      if (!this.current(epoch, activeId)) return;
      this.errorState.set(STRINGS.paymentMethods.toggleError);
    } finally {
      this.endWrite();
      if (epoch === this.requestEpoch) this.savingState.set(false);
    }
  }

  async regenerate(): Promise<void> {
    const id = this.editingIdState();
    if (
      !id ||
      !this.canManage() ||
      this.busy() ||
      !this.isLoadedForActive() ||
      !this.configurations().some(
        (item) => item.id === id && item.establishmentId === this.currentActiveId(),
      )
    )
      return;
    const epoch = ++this.requestEpoch;
    const activeId = this.currentActiveId()!;
    this.regeneratingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);
    this.beginWrite();
    try {
      const saved = await firstValueFrom(
        this.qrApi.regenerateMockQrConfiguration({ configurationId: id }),
      );
      if (!this.current(epoch, activeId) || saved.establishmentId !== activeId) return;
      this.upsert(saved);
      this.applyConfiguration(saved);
      this.qrBaseline = { ...this.draft() };
      await this.loadReadiness(saved.establishmentId);
      if (!this.current(epoch, activeId)) return;
      this.successState.set(STRINGS.paymentMethods.regenerateSuccess);
      await this.renderQr(saved);
    } catch {
      if (!this.current(epoch, activeId)) return;
      this.errorState.set(STRINGS.paymentMethods.regenerateError);
    } finally {
      this.endWrite();
      if (epoch === this.requestEpoch) this.regeneratingState.set(false);
    }
  }

  reset(): void {
    this.startNew();
  }

  setPolicyCurrency(value: string): void {
    this.policyDraftState.update((draft) => ({ ...draft, currency: value.trim().toUpperCase() }));
  }
  setPolicyDeposit(value: string): void {
    this.policyDraftState.update((draft) => ({ ...draft, depositAmount: value.trim() }));
  }
  setPolicyTotal(value: string): void {
    this.policyDraftState.update((draft) => ({ ...draft, totalAmount: value.trim() }));
  }
  setPolicyWindow(value: string): void {
    this.policyDraftState.update((draft) => ({ ...draft, paymentWindowMinutes: value.trim() }));
  }
  setPolicyEnabled(value: boolean): void {
    this.policyDraftState.update((draft) => ({ ...draft, enabled: value }));
  }

  private clearReadiness(): void {
    this.policyEpoch++;
    this.readinessState.set(null);
    this.readinessErrorState.set(null);
    this.policyDraftState.set({ ...EMPTY_POLICY });
    this.policyBaseline = { ...EMPTY_POLICY };
    this.policyErrorState.set(null);
    this.policySuccessState.set(null);
    this.readinessLoadingState.set(false);
  }

  async loadReadiness(establishmentId = this.draft().establishmentId): Promise<void> {
    this.clearReadiness();
    if (
      !this.canManage() ||
      !this.isLoadedForActive() ||
      this.currentActiveId() !== establishmentId
    )
      return;
    const epoch = this.policyEpoch;
    this.readinessLoadingState.set(true);
    try {
      const result = await firstValueFrom(
        this.policiesApi.getPaymentReadiness({ establishmentId }),
      );
      if (
        epoch !== this.policyEpoch ||
        !this.isLoadedForActive() ||
        this.currentActiveId() !== establishmentId
      )
        return;
      this.readinessState.set(result);
      if (result.policy)
        this.policyDraftState.set({
          ...result.policy,
          totalAmount: result.policy.totalAmount ?? '',
          paymentWindowMinutes: String(result.policy.paymentWindowMinutes),
        });
      this.policyBaseline = { ...this.policyDraftState() };
    } catch (error) {
      if (
        epoch === this.policyEpoch &&
        this.isLoadedForActive() &&
        this.currentActiveId() === establishmentId
      )
        this.readinessErrorState.set(
          statusOf(error) === 404
            ? STRINGS.paymentMethods.readinessNotFound
            : statusOf(error) === 403
              ? STRINGS.paymentMethods.readinessForbidden
              : STRINGS.paymentMethods.readinessError,
        );
    } finally {
      if (epoch === this.policyEpoch) this.readinessLoadingState.set(false);
    }
  }

  async savePolicy(): Promise<void> {
    if (!this.canManage() || this.busy() || !this.isLoadedForActive() || !this.canSavePolicy()) {
      this.policyErrorState.set(STRINGS.paymentMethods.policyInvalid);
      return;
    }
    const establishmentId = this.draft().establishmentId;
    const epochBeforeSave = this.policyEpoch;
    const contextGeneration = this.contextGeneration;
    const activeId = this.currentActiveId();
    if (!activeId || activeId !== establishmentId) return;
    const draft = this.policyDraft();
    const policy: PaymentPolicy = {
      enabled: draft.enabled!,
      currency: draft.currency,
      depositAmount: draft.depositAmount,
      totalAmount: draft.totalAmount || null,
      paymentWindowMinutes: Number(draft.paymentWindowMinutes),
    };
    this.policySavingState.set(true);
    const writeEpoch = ++this.policyWriteEpoch;
    this.beginWrite();
    this.policyErrorState.set(null);
    this.policySuccessState.set(null);
    try {
      await firstValueFrom(
        this.policiesApi.savePaymentPolicy({ establishmentId, paymentPolicy: policy }),
      );
      // loadReadiness incrementa policyEpoch internamente vía clearReadiness(),
      // por eso no se puede comparar con epochBeforeSave después de este await.
      // Solo se cancela si el establecimiento cambió antes de que llegara la respuesta.
      if (
        epochBeforeSave !== this.policyEpoch ||
        contextGeneration !== this.contextGeneration ||
        !this.isLoadedForActive() ||
        this.currentActiveId() !== activeId
      )
        return;
      await this.loadReadiness(establishmentId);
      if (
        contextGeneration === this.contextGeneration &&
        this.isLoadedForActive() &&
        this.currentActiveId() === activeId &&
        this.readiness()
      ) {
        this.policyBaseline = { ...this.policyDraftState() };
        this.policySuccessState.set(STRINGS.paymentMethods.policySaved);
      }
    } catch {
      if (epochBeforeSave === this.policyEpoch && this.currentActiveId() === activeId)
        this.policyErrorState.set(STRINGS.paymentMethods.policySaveError);
    } finally {
      this.endWrite();
      if (writeEpoch === this.policyWriteEpoch) this.policySavingState.set(false);
    }
  }

  private applyConfiguration(configuration: MockQrConfiguration): void {
    this.editingIdState.set(configuration.id);
    this.draftState.set(writeOf(configuration));
  }

  private upsert(configuration: MockQrConfiguration): void {
    this.configurationsState.update((configurations) => {
      const index = configurations.findIndex((item) => item.id === configuration.id);
      if (index < 0) return [...configurations, configuration];
      return configurations.map((item) => (item.id === configuration.id ? configuration : item));
    });
  }

  private async renderQr(configuration: MockQrConfiguration): Promise<void> {
    const version = ++this.qrVersion;
    this.qrBusyState.set(true);
    this.qrState.set(null);
    this.qrUrlState.set(null);
    this.qrErrorState.set(null);
    try {
      const origin = this.runtime.config().paymentPublicOrigin ?? 'http://localhost:4300';
      const base = new URL(origin);
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
      if (
        (base.protocol !== 'https:' && !(base.protocol === 'http:' && local)) ||
        base.username ||
        base.password ||
        base.search ||
        base.hash ||
        !QR_PATH.test(configuration.simulationPath)
      ) {
        throw new Error('invalid-qr-target');
      }
      const url = new URL(configuration.simulationPath, base.origin);
      if (url.origin !== base.origin || url.search || url.hash)
        throw new Error('invalid-qr-target');
      const imported = await import('qrcode');
      if (version !== this.qrVersion || !this.isConfigActive(configuration)) return;
      const qr = imported.default ?? imported;
      const image = await qr.toDataURL(url.href, {
        width: 280,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (version !== this.qrVersion || !this.isConfigActive(configuration)) return;
      this.qrUrlState.set(url.href);
      this.qrState.set(image);
    } catch {
      if (version !== this.qrVersion || !this.isConfigActive(configuration)) return;
      this.qrErrorState.set(STRINGS.paymentMethods.qrError);
    } finally {
      if (version === this.qrVersion) this.qrBusyState.set(false);
    }
  }

  private resetState(): void {
    this.clearReadiness();
    this.requestEpoch++;
    this.qrVersion++;
    this.countriesState.set([]);
    this.configurationsState.set([]);
    this.draftState.set({ ...EMPTY });
    this.editingIdState.set(null);
    this.loadingState.set(false);
    this.savingState.set(false);
    this.regeneratingState.set(false);
    this.qrBusyState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
    this.qrState.set(null);
    this.qrUrlState.set(null);
    this.qrErrorState.set(null);
    this.loadedActiveId = null;
    this.qrBaseline = { ...EMPTY };
    this.policyBaseline = { ...EMPTY_POLICY };
  }

  private clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  private validSelection(draft: QrDraft): boolean {
    return (
      valid(draft) &&
      this.isLoadedForActive() &&
      draft.establishmentId === this.currentActiveId() &&
      this.countriesState().some((item) => item.code === draft.country)
    );
  }

  private canManage(): boolean {
    return (
      this.allowed &&
      this.isAdmin() &&
      !!this.owner() &&
      this.context.status() === 'ready' &&
      !!this.context.active()?.canManagePayments
    );
  }

  private currentActiveId(): string | null {
    const active = this.context.active();
    return this.context.status() === 'ready' && active?.canManagePayments ? active.id : null;
  }

  private isLoadedForActive(): boolean {
    const id = this.currentActiveId();
    return !!id && this.loadedActiveId === id;
  }

  private scopeCurrent(epoch: number, activeId: string): boolean {
    return epoch === this.requestEpoch && this.canManage() && this.currentActiveId() === activeId;
  }

  private current(epoch: number, activeId: string): boolean {
    return this.scopeCurrent(epoch, activeId) && this.isLoadedForActive();
  }

  private owns(configuration: MockQrConfiguration): boolean {
    return (
      this.isLoadedForActive() &&
      configuration.establishmentId === this.currentActiveId() &&
      this.configurations().some(
        (item) =>
          item.id === configuration.id && item.establishmentId === configuration.establishmentId,
      )
    );
  }

  private isConfigActive(configuration: MockQrConfiguration): boolean {
    return this.isLoadedForActive() && configuration.establishmentId === this.currentActiveId();
  }

  private changeContext(active: AccessibleEstablishment | null, status: string): void {
    const activeId = status === 'ready' && active?.canManagePayments ? active.id : null;
    if (activeId === this.loadedActiveId && activeId !== null) return;
    this.contextGeneration++;
    this.requestEpoch++;
    this.policyEpoch++;
    this.qrVersion++;
    this.loadedActiveId = null;
    this.configurationsState.set([]);
    this.draftState.set({ ...EMPTY, establishmentId: activeId ?? '' });
    this.editingIdState.set(null);
    this.qrBaseline = { ...this.draftState() };
    this.policyBaseline = { ...EMPTY_POLICY };
    this.clearReadiness();
    this.qrState.set(null);
    this.qrUrlState.set(null);
    this.qrErrorState.set(null);
    this.qrBusyState.set(false);
    this.savingState.set(false);
    this.regeneratingState.set(false);
    this.loadingState.set(false);
    this.errorState.set(null);
    this.successState.set(null);
    if (activeId && this.canManage()) void this.load();
  }

  private beginWrite(): void {
    this.writesInFlight.update((count) => count + 1);
  }

  private endWrite(): void {
    this.writesInFlight.update((count) => Math.max(0, count - 1));
  }

  private loadError(error: unknown): string {
    const status = statusOf(error);
    if (status === 403) return STRINGS.paymentMethods.forbidden;
    if (status === 404) return STRINGS.paymentMethods.unavailable;
    return STRINGS.paymentMethods.loadError;
  }

  private saveError(error: unknown): string {
    const status = statusOf(error);
    if (status === 409) return STRINGS.paymentMethods.duplicate;
    if (status === 400) return STRINGS.paymentMethods.invalid;
    if (status === 403) return STRINGS.paymentMethods.forbidden;
    if (status === 404) return STRINGS.paymentMethods.unavailable;
    return STRINGS.paymentMethods.saveError;
  }
}

function writeOf(configuration: MockQrConfiguration): QrDraft {
  return {
    establishmentId: configuration.establishmentId,
    country: configuration.country,
    bankName: configuration.bankName,
    accountHolderName: configuration.accountHolderName,
    accountReference: configuration.accountReference,
    enabled: configuration.enabled,
  };
}

function clean(draft: QrDraft): QrDraft {
  return {
    ...draft,
    country: draft.country.trim().toUpperCase(),
    bankName: draft.bankName.trim(),
    accountHolderName: draft.accountHolderName.trim(),
    accountReference: draft.accountReference.trim(),
  };
}

function valid(draft: QrDraft): boolean {
  return (
    draft.establishmentId.length > 0 &&
    /^[A-Z]{2}$/.test(draft.country) &&
    [draft.bankName, draft.accountHolderName, draft.accountReference].every(
      (value) => value.trim().length > 0 && value.trim().length <= 120,
    )
  );
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : undefined;
}

function sameUser(
  current: ReturnType<AuthSession['user']>,
  previous: ReturnType<AuthSession['user']>,
): boolean {
  return (
    current?.id === previous?.id &&
    current?.tenantId === previous?.tenantId &&
    current?.role === previous?.role
  );
}

function sameQr(left: QrDraft, right: QrDraft): boolean {
  return Object.keys(left).every(
    (key) => left[key as keyof QrDraft] === right[key as keyof QrDraft],
  );
}

function samePolicy(left: PolicyDraft, right: PolicyDraft): boolean {
  return Object.keys(left).every(
    (key) => left[key as keyof PolicyDraft] === right[key as keyof PolicyDraft],
  );
}
