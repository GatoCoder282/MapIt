import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type { BusinessVertical } from '@mapit/api-client';
import { TenantRegistrationStore } from '../model/tenant-registration-store';

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;
const requiredValidator = (control: AbstractControl): ValidationErrors | null =>
  Validators.required(control);
const maxLengthValidator =
  (limit: number) =>
  (control: AbstractControl): ValidationErrors | null =>
    Validators.maxLength(limit)(control);
const minLengthValidator =
  (limit: number) =>
  (control: AbstractControl): ValidationErrors | null =>
    Validators.minLength(limit)(control);
const patternValidator =
  (pattern: RegExp) =>
  (control: AbstractControl): ValidationErrors | null =>
    Validators.pattern(pattern)(control);
const emailValidator = (control: AbstractControl): ValidationErrors | null =>
  Validators.email(control);

/** Formulario de alta de una empresa en la plataforma. */
@Component({
  selector: 'mapit-tenant-registration',
  imports: [ReactiveFormsModule],
  providers: [TenantRegistrationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <p class="eyebrow">MapIt · Administración de plataforma</p>
        <h1>Registrar tenant</h1>
        <p class="intro">
          Crea una organización y define la vertical con la que comenzará a trabajar.
        </p>
      </header>

      @if (store.success(); as tenant) {
        <p class="message success" role="status">
          Tenant registrado correctamente. ID: <strong>{{ tenant.id }}</strong>
        </p>
      }

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          Nombre de la organización
          <input
            formControlName="name"
            autocomplete="organization"
            maxlength="120"
            placeholder="Ej. Restaurante Central"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <span class="field-error">Ingresa un nombre de hasta 120 caracteres.</span>
          }
        </label>

        <label>
          Slug
          <input
            formControlName="slug"
            autocomplete="off"
            maxlength="63"
            placeholder="restaurante-central"
          />
          <span class="hint">Usa minúsculas, números y guiones.</span>
          @if (form.controls.slug.invalid && form.controls.slug.touched) {
            <span class="field-error">El slug debe tener entre 2 y 63 caracteres válidos.</span>
          }
        </label>

        <label>
          Vertical de negocio
          <select formControlName="vertical">
            @for (vertical of verticals; track vertical.value) {
              <option [value]="vertical.value">{{ vertical.label }}</option>
            }
          </select>
        </label>

        <label>
          Correo del administrador
          <input
            formControlName="administratorEmail"
            type="email"
            autocomplete="email"
            maxlength="254"
            placeholder="admin@empresa.com"
          />
          @if (
            form.controls.administratorEmail.invalid && form.controls.administratorEmail.touched
          ) {
            <span class="field-error">Ingresa un correo válido.</span>
          }
        </label>

        <div class="actions">
          <button class="primary" type="submit" [disabled]="store.saving()">
            {{ store.saving() ? 'Registrando…' : 'Registrar tenant' }}
          </button>
          @if (store.success()) {
            <button class="secondary" type="button" (click)="startAnother()">Registrar otro</button>
          }
        </div>
      </form>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #f5f7fb;
    }
    .page {
      width: min(680px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 3rem 0;
    }
    .page-header {
      margin-bottom: 1.5rem;
    }
    .eyebrow {
      margin: 0 0 0.4rem;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0 0 0.5rem;
      color: #172033;
      font-size: clamp(1.8rem, 4vw, 2.6rem);
    }
    .intro {
      margin: 0;
      color: #64748b;
    }
    .card {
      display: grid;
      gap: 1.2rem;
      padding: 1.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      background: #fff;
      box-shadow: 0 12px 30px rgb(15 23 42 / 6%);
    }
    label {
      display: grid;
      gap: 0.45rem;
      color: #334155;
      font-size: 0.9rem;
      font-weight: 600;
    }
    input,
    select {
      width: 100%;
      padding: 0.7rem 0.8rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.55rem;
      color: #172033;
      background: #fff;
      font: inherit;
    }
    input:focus,
    select:focus {
      border-color: #2563eb;
      outline: 3px solid rgb(37 99 235 / 15%);
    }
    .hint {
      color: #64748b;
      font-size: 0.78rem;
      font-weight: 400;
    }
    .field-error {
      color: #b91c1c;
      font-size: 0.78rem;
      font-weight: 500;
    }
    .message {
      margin: 0 0 1.5rem;
      padding: 0.8rem 1rem;
      border-radius: 0.65rem;
    }
    .success {
      color: #166534;
      background: #dcfce7;
    }
    .error {
      color: #991b1b;
      background: #fee2e2;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.7rem;
      margin-top: 0.3rem;
    }
    button {
      padding: 0.65rem 0.9rem;
      border: 0;
      border-radius: 0.55rem;
      cursor: pointer;
      font: inherit;
      font-weight: 650;
    }
    button:disabled {
      cursor: wait;
      opacity: 0.55;
    }
    .primary {
      color: #fff;
      background: #2563eb;
    }
    .secondary {
      color: #1e40af;
      background: #dbeafe;
    }
  `,
})
export class TenantRegistration {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  protected readonly store = inject(TenantRegistrationStore);
  protected readonly verticals: ReadonlyArray<{ value: BusinessVertical; label: string }> = [
    { value: 'RESTAURANT', label: 'Restaurante' },
    { value: 'NIGHTCLUB', label: 'Discoteca' },
    { value: 'EVENT_HALL', label: 'Salón de eventos' },
    { value: 'HOTEL', label: 'Hotel' },
  ];

  protected readonly form = this.formBuilder.group({
    name: ['', [requiredValidator, maxLengthValidator(120)]],
    slug: [
      '',
      [
        requiredValidator,
        minLengthValidator(2),
        maxLengthValidator(63),
        patternValidator(SLUG_PATTERN),
      ],
    ],
    vertical: ['RESTAURANT' as BusinessVertical, requiredValidator],
    administratorEmail: ['', [requiredValidator, emailValidator, maxLengthValidator(254)]],
  });

  protected submit(): void {
    this.store.clearFeedback();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.store.register(this.form.getRawValue());
  }

  protected startAnother(): void {
    this.form.reset({
      name: '',
      slug: '',
      vertical: 'RESTAURANT',
      administratorEmail: '',
    });
    this.store.clearFeedback();
  }
}
