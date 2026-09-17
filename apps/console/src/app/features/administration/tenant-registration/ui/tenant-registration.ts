import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import type { BusinessVertical } from '@mapit/api-client';
import { STRINGS } from '../../../../core/strings';
import { SLUG_PATTERN } from '../../../../core/patterns';
import { TenantRegistrationStore } from '../model/tenant-registration-store';
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
  imports: [ReactiveFormsModule, RouterLink],
  providers: [TenantRegistrationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <p class="eyebrow">{{ strings.tenantForm.createEyebrow }}</p>
        <h1>{{ strings.tenantForm.createTitle }}</h1>
        <p class="intro">{{ strings.tenantForm.createIntro }}</p>
      </header>

      @if (store.success(); as tenant) {
        <div class="message success" role="status">
          <p>
            {{ strings.tenantForm.successCreate }} {{ strings.tenantForm.successIdPrefix }}
            <strong>{{ tenant.id }}</strong>
          </p>
          <a class="link" routerLink="/admin/tenants">{{ strings.tenantForm.backToList }}</a>
        </div>
      }

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label>
          {{ strings.tenantForm.nameLabel }}
          <input
            formControlName="name"
            autocomplete="organization"
            maxlength="120"
            [placeholder]="strings.tenantForm.namePlaceholder"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <span class="field-error">{{ strings.tenantForm.nameError }}</span>
          }
        </label>

        <label>
          {{ strings.tenantForm.slugLabel }}
          <input
            formControlName="slug"
            autocomplete="off"
            maxlength="63"
            [placeholder]="strings.tenantForm.slugPlaceholder"
          />
          <span class="hint">{{ strings.tenantForm.slugHint }}</span>
          @if (form.controls.slug.invalid && form.controls.slug.touched) {
            <span class="field-error">{{ strings.tenantForm.slugError }}</span>
          }
        </label>

        <label>
          {{ strings.tenantForm.verticalLabel }}
          <select formControlName="vertical">
            @for (vertical of verticals; track vertical.value) {
              <option [value]="vertical.value">{{ vertical.label }}</option>
            }
          </select>
        </label>

        <label>
          {{ strings.tenantForm.adminEmailLabel }}
          <input
            formControlName="administratorEmail"
            type="email"
            autocomplete="email"
            maxlength="254"
            [placeholder]="strings.tenantForm.adminEmailPlaceholder"
          />
          @if (
            form.controls.administratorEmail.invalid && form.controls.administratorEmail.touched
          ) {
            <span class="field-error">{{ strings.tenantForm.adminEmailError }}</span>
          }
        </label>

        <div class="actions">
          <button class="primary" type="submit" [disabled]="store.saving()">
            {{ store.saving() ? strings.tenantForm.submitSaving : strings.tenantForm.submitCreate }}
          </button>
          @if (store.success()) {
            <button class="secondary" type="button" (click)="startAnother()">
              {{ strings.tenantForm.registerAnother }}
            </button>
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
    .message p {
      margin: 0 0 0.4rem;
    }
    .link {
      color: #166534;
      font-weight: 600;
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
  protected readonly strings = STRINGS;
  protected readonly verticals: ReadonlyArray<{ value: BusinessVertical; label: string }> = (
    ['RESTAURANT', 'NIGHTCLUB', 'EVENT_HALL', 'HOTEL'] as const
  ).map((value) => ({ value, label: STRINGS.verticals[value] }));

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
