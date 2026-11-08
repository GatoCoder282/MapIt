import {
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import {
  PaymentsService,
  type MerchantPaymentMethod,
  type PaymentMethodWrite,
} from '@mapit/api-client';
import { AuthSession } from '@mapit/auth';
import { firstValueFrom } from 'rxjs';

import { EstablishmentContext } from '../../../core/establishment-context';
import { RuntimeConfigStore } from '../../../core/runtime-config';
import { STRINGS } from '../../../core/strings';

type NewProvider = Exclude<PaymentMethodWrite['provider'], 'MOCK_GATEWAY'>;
type CatalogDraft = PaymentMethodWrite & {
  establishmentId: string;
  accountHolderName: string;
  staticQrImage: string | null;
};
type DraftPatch = Partial<Omit<CatalogDraft, 'establishmentId' | 'provider' | 'staticQrImage'>>;
type QrError = 'format' | 'size' | 'read';
type CatalogError = 'load' | 'save' | 'forbidden' | 'unavailable' | 'invalid' | 'conflict';
type Scope = { establishmentId: string };
type ListState = {
  methods: readonly MerchantPaymentMethod[];
  loading: boolean;
  error: CatalogError | null;
};
type Editor = {
  id: string | null;
  draft: CatalogDraft;
  baseline: CatalogDraft;
};

const EMPTY_LIST: ListState = { methods: [], loading: false, error: null };
const QR_MAX_LENGTH = 350_000;
const QR_SIGNATURES: Readonly<Record<string, readonly number[]>> = {
  'image/png': [137, 80, 78, 71, 13, 10, 26, 10],
  'image/jpeg': [255, 216, 255],
};
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

@Injectable()
export class PaymentCatalogStore {
  private readonly api = inject(PaymentsService);
  private readonly context = inject(EstablishmentContext);
  private readonly session = inject(AuthSession);
  private readonly runtime = inject(RuntimeConfigStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly scope = computed(() => {
    const user = this.session.user();
    const active = this.context.active();
    return user?.role === 'ADMIN' && this.context.status() === 'ready' && active?.canManagePayments
      ? { establishmentId: active.id }
      : null;
  });
  private readonly listState = linkedSignal({ source: this.scope, computation: () => EMPTY_LIST });
  private readonly editor = linkedSignal<Scope | null, Editor | null>({
    source: this.scope,
    computation: () => null,
  });
  private readonly writeScope = signal<Scope | null>(null);
  private readonly uploading = linkedSignal({ source: this.scope, computation: () => false });
  private readonly saveErrorState = linkedSignal<Scope | null, CatalogError | null>({
    source: this.scope,
    computation: () => null,
  });
  private readonly qrErrorState = linkedSignal<Scope | null, QrError | null>({
    source: this.scope,
    computation: () => null,
  });
  private listVersion = 0;
  private uploadVersion = 0;

  readonly methods = computed(() => this.listState().methods);
  readonly loading = computed(() => this.listState().loading);
  readonly error = computed(() => message(this.listState().error));
  readonly saveError = computed(() => message(this.saveErrorState()));
  readonly qrError = this.qrErrorState.asReadonly();
  readonly busy = computed(() => !!this.writeScope() || this.uploading());
  readonly draft = computed(() => this.editor()?.draft ?? null);
  readonly editingId = computed(() => this.editor()?.id ?? null);
  readonly dirty = computed(() => {
    const editor = this.editor();
    return (
      !!editor &&
      Object.keys(editor.baseline).some((key) => {
        const field = key as keyof CatalogDraft;
        return editor.baseline[field] !== editor.draft[field];
      })
    );
  });
  readonly canManage = computed(() => this.scope() !== null);
  readonly canSave = computed(() => {
    const editor = this.editor();
    return !!editor && !this.busy() && valid(writeOf(editor.draft), editor.id === null);
  });

  constructor() {
    effect(() => {
      if (this.scope()) untracked(() => void this.load());
    });
  }

  async load(): Promise<void> {
    const scope = this.scope();
    if (!scope || scope === this.writeScope()) return;
    const version = ++this.listVersion;
    this.listState.update((list) => ({ ...list, loading: true, error: null }));
    try {
      const methods = await firstValueFrom(this.api.listPaymentMethods(scope));
      if (!this.current(scope) || version !== this.listVersion) return;
      const mockAllowed = ['development', 'dev', 'test'].includes(
        this.runtime.config().environment,
      );
      this.listState.set({
        methods: methods.filter(
          (method) =>
            (method.establishmentId == null || method.establishmentId === scope.establishmentId) &&
            (method.provider !== 'MOCK_GATEWAY' || mockAllowed),
        ),
        loading: false,
        error: null,
      });
    } catch (error) {
      if (!this.current(scope) || version !== this.listVersion) return;
      this.listState.set({ ...EMPTY_LIST, error: errorCode(error, 'load') });
    }
  }

  start(provider: NewProvider): void {
    const scope = this.scope();
    if (!scope || this.busy()) return;
    this.open(null, {
      ...scope,
      provider,
      displayName: '',
      country: '',
      currency: '',
      bankName: '',
      accountHolderName: '',
      accountReference: '',
      staticQrImage: null,
      enabled: provider === 'STATIC_BANK_QR',
    });
  }

  edit(method: MerchantPaymentMethod): void {
    const current = this.localMethod(method);
    if (!current || this.busy()) return;
    this.open(current.id, {
      establishmentId: current.establishmentId,
      provider: current.provider,
      displayName: current.displayName,
      country: current.country,
      currency: current.currency,
      bankName: current.bankName,
      accountHolderName: current.accountHolderName ?? '',
      accountReference: current.accountReference,
      staticQrImage: current.staticQrImage ?? null,
      enabled: current.enabled,
    });
  }

  canEdit(method: MerchantPaymentMethod): boolean {
    return this.localMethod(method) !== null;
  }

  cancel(): void {
    if (this.writeScope()) return;
    this.uploadVersion++;
    this.uploading.set(false);
    this.editor.set(null);
    this.qrErrorState.set(null);
    this.saveErrorState.set(null);
  }

  patch(fields: DraftPatch): void {
    this.updateDraft(fields);
  }

  async uploadQr(file: File): Promise<void> {
    const scope = this.scope();
    if (!scope || this.writeScope() || this.draft()?.provider !== 'STATIC_BANK_QR') return;
    const version = ++this.uploadVersion;
    this.uploading.set(false);
    this.qrErrorState.set(null);
    const signature = QR_SIGNATURES[file.type];
    if (!signature) {
      this.qrErrorState.set('format');
      return;
    }
    const prefix = `data:${file.type};base64,`;
    if (prefix.length + Math.ceil(file.size / 3) * 4 > QR_MAX_LENGTH) {
      this.qrErrorState.set('size');
      return;
    }
    this.uploading.set(true);
    try {
      const image = await readDataUrl(file);
      if (!this.current(scope) || version !== this.uploadVersion) return;
      const bytes = atob(image.slice(prefix.length));
      if (
        !image.startsWith(prefix) ||
        bytes.length <= signature.length ||
        !signature.every((byte, index) => bytes.charCodeAt(index) === byte)
      ) {
        this.qrErrorState.set('format');
        return;
      }
      this.updateDraft({ staticQrImage: image });
    } catch {
      if (this.current(scope) && version === this.uploadVersion) this.qrErrorState.set('read');
    } finally {
      if (this.current(scope) && version === this.uploadVersion) this.uploading.set(false);
    }
  }

  clearQr(): void {
    this.uploadVersion++;
    this.uploading.set(false);
    this.qrErrorState.set(null);
    this.updateDraft({ staticQrImage: null });
  }

  async save(): Promise<MerchantPaymentMethod | null> {
    const editor = this.editor();
    if (!editor || !this.canSave()) return null;
    const result = await this.persist(writeOf(editor.draft), editor.id);
    if (
      result &&
      this.editor() === editor &&
      this.scope()?.establishmentId === result.establishmentId
    ) {
      this.editor.set(null);
      return result;
    }
    return null;
  }

  async toggle(method: MerchantPaymentMethod): Promise<void> {
    const current = this.localMethod(method);
    if (!current || this.busy() || current.provider === 'INTEGRATED_GATEWAY') return;
    const write = { ...writeOf(current), enabled: !current.enabled };
    if (!valid(write, false)) {
      this.saveErrorState.set('invalid');
      return;
    }
    await this.persist(write, current.id);
  }

  private open(id: string | null, draft: CatalogDraft): void {
    this.cancel();
    this.editor.set({ id, draft, baseline: draft });
  }

  private updateDraft(fields: DraftPatch & { staticQrImage?: string | null }): void {
    if (this.writeScope()) return;
    this.editor.update((editor) => editor && { ...editor, draft: { ...editor.draft, ...fields } });
    this.saveErrorState.set(null);
  }

  private localMethod(
    method: MerchantPaymentMethod,
  ): (MerchantPaymentMethod & { establishmentId: string }) | null {
    const scope = this.scope();
    const current = this.methods().find((item) => item.id === method.id);
    if (!scope || !current || current.establishmentId !== scope.establishmentId) return null;
    return { ...current, ...scope };
  }

  private async persist(
    paymentMethodWrite: PaymentMethodWrite,
    id: string | null,
  ): Promise<MerchantPaymentMethod | null> {
    const scope = this.scope();
    if (!scope || this.busy() || paymentMethodWrite.establishmentId !== scope.establishmentId)
      return null;
    this.writeScope.set(scope);
    this.saveErrorState.set(null);
    try {
      const response = await firstValueFrom(
        id
          ? this.api.updatePaymentMethod({ methodId: id, paymentMethodWrite })
          : this.api.createPaymentMethod({ paymentMethodWrite }),
      );
      if (!this.current(scope)) return null;
      if (response.establishmentId !== scope.establishmentId) {
        this.saveErrorState.set('save');
        return null;
      }
      this.listVersion++;
      const local = this.methods().filter((item) => item.establishmentId === scope.establishmentId);
      this.listState.set({
        ...EMPTY_LIST,
        methods: local.some((item) => item.id === response.id)
          ? local.map((item) => (item.id === response.id ? response : item))
          : [...local, response],
      });
      return response;
    } catch (error) {
      if (this.current(scope)) this.saveErrorState.set(errorCode(error, 'save'));
      return null;
    } finally {
      this.writeScope.set(null);
    }
  }

  private current(scope: Scope): boolean {
    return !this.destroyRef.destroyed && this.scope() === scope;
  }
}

function writeOf(draft: PaymentMethodWrite): PaymentMethodWrite {
  return {
    establishmentId: draft.establishmentId ?? null,
    provider: draft.provider,
    displayName: draft.displayName.trim(),
    country: draft.country.trim().toUpperCase(),
    currency: draft.currency.trim().toUpperCase(),
    bankName: draft.bankName.trim(),
    accountHolderName: draft.accountHolderName?.trim() || null,
    accountReference: draft.accountReference.trim(),
    enabled: draft.provider === 'INTEGRATED_GATEWAY' ? false : draft.enabled,
    staticQrImage: draft.staticQrImage ?? null,
  };
}

function valid(draft: PaymentMethodWrite, isNew: boolean): boolean {
  const required = [draft.displayName, draft.bankName, draft.accountReference];
  if (isNew || draft.enabled) required.push(draft.accountHolderName ?? '');
  return (
    required.every((value) => value.length > 0 && value.length <= 120) &&
    (draft.accountHolderName?.length ?? 0) <= 120 &&
    /^[A-Z]{2}$/.test(draft.country) &&
    CURRENCIES.has(draft.currency) &&
    (draft.provider !== 'STATIC_BANK_QR' || !!draft.staticQrImage)
  );
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Expected a QR image data URL'));
    reader.onerror = () =>
      reject(new Error('Could not read the QR image', { cause: reader.error }));
    reader.readAsDataURL(file);
  });
}

function errorCode(error: unknown, fallback: CatalogError): CatalogError {
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? error.status : null;
  switch (status) {
    case 400:
      return 'invalid';
    case 403:
      return 'forbidden';
    case 404:
      return 'unavailable';
    case 409:
      return 'conflict';
    default:
      return fallback;
  }
}

function message(error: CatalogError | null): string | null {
  const strings = STRINGS.paymentMethods;
  switch (error) {
    case 'load':
      return strings.loadError;
    case 'save':
      return strings.saveError;
    case 'forbidden':
      return strings.catalogForbidden;
    case 'unavailable':
      return strings.readinessNotFound;
    case 'invalid':
      return strings.catalogInvalid;
    case 'conflict':
      return strings.catalogConflict;
    case null:
      return null;
  }
}
