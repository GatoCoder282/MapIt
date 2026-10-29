import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  EstablishmentsService,
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
  private readonly runtime = inject(RuntimeConfigStore);
  private readonly qrApi = inject(MockQrService);
  private readonly establishmentsApi = inject(EstablishmentsService);
  private readonly policiesApi = inject(PaymentPoliciesService);
  private readonly owner = signal(this.session.user());
  private readonly establishmentsState = signal<readonly AccessibleEstablishment[]>([]);
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
  private policyEpoch = 0;
  private requestEpoch = 0;
  private qrVersion = 0;

  readonly allowed = ['development', 'dev', 'test'].includes(this.runtime.config().environment);
  readonly establishments = this.establishmentsState.asReadonly();
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
  readonly blockerLabels = computed(() =>
    (this.readiness()?.blockers ?? []).map((code) => STRINGS.paymentMethods.blockers[code]),
  );
  readonly canSavePolicy = computed(() => {
    const draft = this.policyDraft();
    if (
      !this.isAdmin() ||
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

  readonly establishmentOptions = computed(() =>
    this.establishmentsState().map((item) => ({
      value: item.id,
      label: item.name,
      description: item.address ?? '',
    })),
  );
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
      this.allowed && !this.loading() && !this.saving() && this.validSelection(this.draftState()),
  );
  readonly establishmentName = (id: string): string =>
    this.establishmentsState().find((item) => item.id === id)?.name ??
    STRINGS.paymentMethods.unknownEstablishment;
  readonly countryName = (code: string): string =>
    this.countriesState().find((item) => item.code === code)?.name ?? code;

  constructor() {
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
    if (this.session.user() && this.allowed) void this.load();
  }

  async load(): Promise<void> {
    if (!this.allowed || !this.owner()) return;
    const epoch = ++this.requestEpoch;
    this.loadingState.set(true);
    this.errorState.set(null);
    try {
      const [establishments, countries, configurations] = await firstValueFrom(
        forkJoin([
          this.establishmentsApi.listAccessibleEstablishments(),
          this.qrApi.listMockQrCountries(),
          this.qrApi.listMockQrConfigurations(),
        ]),
      );
      if (epoch !== this.requestEpoch) return;
      this.establishmentsState.set(establishments.filter((item) => item.canManagePayments));
      this.countriesState.set(countries);
      this.configurationsState.set(configurations);
      this.loadingState.set(false);
      const [first] = configurations;
      if (first) {
        await this.selectConfiguration(first);
      } else {
        this.startNew();
      }
    } catch (error) {
      if (epoch !== this.requestEpoch) return;
      this.errorState.set(this.loadError(error));
    } finally {
      if (epoch === this.requestEpoch) this.loadingState.set(false);
    }
  }

  async selectConfiguration(configuration: MockQrConfiguration): Promise<void> {
    this.requestEpoch++;
    this.applyConfiguration(configuration);
    await this.loadReadiness(configuration.establishmentId);
    this.errorState.set(null);
    this.successState.set(null);
    await this.renderQr(configuration);
  }

  startNew(): void {
    this.requestEpoch++;
    this.qrVersion++;
    this.editingIdState.set(null);
    this.clearReadiness();
    this.draftState.set({ ...EMPTY });
    this.qrState.set(null);
    this.qrUrlState.set(null);
    this.qrErrorState.set(null);
    this.errorState.set(null);
    this.successState.set(null);
  }

  setEstablishment(id: string): void {
    this.draftState.update((draft) => ({ ...draft, establishmentId: id }));
    void this.loadReadiness(id);
    this.clearFeedback();
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

  async save(): Promise<void> {
    if (!this.allowed || !this.owner()) return;
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
    try {
      const id = this.editingIdState();
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
      if (epoch !== this.requestEpoch) return;
      this.upsert(saved);
      this.applyConfiguration(saved);
      await this.loadReadiness(saved.establishmentId);
      this.successState.set(STRINGS.paymentMethods.success);
      await this.renderQr(saved);
    } catch (error) {
      if (epoch !== this.requestEpoch) return;
      this.errorState.set(this.saveError(error));
    } finally {
      if (epoch === this.requestEpoch) this.savingState.set(false);
    }
  }

  async toggle(configuration: MockQrConfiguration): Promise<void> {
    if (!this.allowed || !this.owner()) return;
    const epoch = ++this.requestEpoch;
    this.errorState.set(null);
    try {
      const saved = await firstValueFrom(
        this.qrApi.updateMockQrConfiguration({
          configurationId: configuration.id,
          mockQrConfigurationWrite: { ...writeOf(configuration), enabled: !configuration.enabled },
        }),
      );
      if (epoch !== this.requestEpoch) return;
      this.upsert(saved);
      if (this.editingIdState() === saved.id) this.applyConfiguration(saved);
      if (this.draft().establishmentId === saved.establishmentId)
        await this.loadReadiness(saved.establishmentId);
    } catch {
      if (epoch !== this.requestEpoch) return;
      this.errorState.set(STRINGS.paymentMethods.toggleError);
    }
  }

  async regenerate(): Promise<void> {
    const id = this.editingIdState();
    if (!id || !this.allowed || !this.owner()) return;
    const epoch = ++this.requestEpoch;
    this.regeneratingState.set(true);
    this.errorState.set(null);
    this.successState.set(null);
    try {
      const saved = await firstValueFrom(
        this.qrApi.regenerateMockQrConfiguration({ configurationId: id }),
      );
      if (epoch !== this.requestEpoch) return;
      this.upsert(saved);
      this.applyConfiguration(saved);
      await this.loadReadiness(saved.establishmentId);
      this.successState.set(STRINGS.paymentMethods.regenerateSuccess);
      await this.renderQr(saved);
    } catch {
      if (epoch !== this.requestEpoch) return;
      this.errorState.set(STRINGS.paymentMethods.regenerateError);
    } finally {
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
    this.policyErrorState.set(null);
    this.policySuccessState.set(null);
    this.readinessLoadingState.set(false);
  }

  async loadReadiness(establishmentId = this.draft().establishmentId): Promise<void> {
    this.clearReadiness();
    if (
      !this.isAdmin() ||
      !this.allowed ||
      !this.establishments().some((item) => item.id === establishmentId)
    )
      return;
    const epoch = this.policyEpoch;
    this.readinessLoadingState.set(true);
    try {
      const result = await firstValueFrom(
        this.policiesApi.getPaymentReadiness({ establishmentId }),
      );
      if (epoch !== this.policyEpoch) return;
      this.readinessState.set(result);
      if (result.policy)
        this.policyDraftState.set({
          ...result.policy,
          totalAmount: result.policy.totalAmount ?? '',
          paymentWindowMinutes: String(result.policy.paymentWindowMinutes),
        });
    } catch (error) {
      if (epoch === this.policyEpoch)
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
    if (!this.canSavePolicy()) {
      this.policyErrorState.set(STRINGS.paymentMethods.policyInvalid);
      return;
    }
    const establishmentId = this.draft().establishmentId;
    const epochBeforeSave = this.policyEpoch;
    const draft = this.policyDraft();
    const policy: PaymentPolicy = {
      enabled: draft.enabled!,
      currency: draft.currency,
      depositAmount: draft.depositAmount,
      totalAmount: draft.totalAmount || null,
      paymentWindowMinutes: Number(draft.paymentWindowMinutes),
    };
    this.policySavingState.set(true);
    this.policyErrorState.set(null);
    this.policySuccessState.set(null);
    try {
      await firstValueFrom(
        this.policiesApi.savePaymentPolicy({ establishmentId, paymentPolicy: policy }),
      );
      // loadReadiness incrementa policyEpoch internamente vía clearReadiness(),
      // por eso no se puede comparar con epochBeforeSave después de este await.
      // Solo se cancela si el establecimiento cambió antes de que llegara la respuesta.
      if (epochBeforeSave !== this.policyEpoch) return;
      await this.loadReadiness(establishmentId);
      // Tras loadReadiness el policyEpoch ya es diferente; se verifica por establecimiento.
      if (this.draft().establishmentId === establishmentId && this.readiness())
        this.policySuccessState.set(STRINGS.paymentMethods.policySaved);
    } catch {
      if (epochBeforeSave === this.policyEpoch)
        this.policyErrorState.set(STRINGS.paymentMethods.policySaveError);
    } finally {
      this.policySavingState.set(false);
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
      const qr = imported.default ?? imported;
      const image = await qr.toDataURL(url.href, {
        width: 280,
        margin: 3,
        errorCorrectionLevel: 'M',
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      if (version !== this.qrVersion) return;
      this.qrUrlState.set(url.href);
      this.qrState.set(image);
    } catch {
      if (version !== this.qrVersion) return;
      this.qrErrorState.set(STRINGS.paymentMethods.qrError);
    } finally {
      if (version === this.qrVersion) this.qrBusyState.set(false);
    }
  }

  private resetState(): void {
    this.clearReadiness();
    this.requestEpoch++;
    this.qrVersion++;
    this.establishmentsState.set([]);
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
  }

  private clearFeedback(): void {
    this.errorState.set(null);
    this.successState.set(null);
  }

  private validSelection(draft: QrDraft): boolean {
    return (
      valid(draft) &&
      this.establishmentsState().some((item) => item.id === draft.establishmentId) &&
      this.countriesState().some((item) => item.code === draft.country)
    );
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
