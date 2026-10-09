import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TemplatesStore } from '../model/templates-store';
import { ElementTemplateFormComponent } from './element-template-form';
import { ElementTypeIconComponent } from './element-type-icon';
import type { ElementTemplate } from '@mapit/api-client';
import { STRINGS } from '../../../core/strings';

@Component({
  selector: 'mapit-element-template-list',
  imports: [ElementTemplateFormComponent, ElementTypeIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="templates-container">
      <div class="templates-header">
        <div class="header-copy">
          <p class="templates-title">{{ strings.title }}</p>
          <p class="templates-subtitle">{{ strings.subtitle }}</p>
        </div>
        <button class="btn-primary" type="button" (click)="startCreate()">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {{ strings.createButton }}
        </button>
      </div>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      @if (loading()) {
        <div class="state">{{ strings.loading }}</div>
      } @else if (templates().length === 0) {
        <div class="state empty">{{ strings.empty }}</div>
      }

      @if (templates().length > 0) {
        <table class="templates-table">
          <thead>
            <tr>
              <th>{{ strings.list.nameHeader }}</th>
              <th>{{ strings.list.typeHeader }}</th>
              <th>{{ strings.list.actionsHeader }}</th>
            </tr>
          </thead>
          <tbody>
            @for (template of templates(); track template.id) {
              <tr>
                <td>
                  <span class="template-name">
                    <mapit-element-type-icon [type]="template.type" [size]="28" />
                    {{ template.name }}
                  </span>
                </td>
                <td>{{ typeLabel(template.type) }}</td>
                <td>
                  <div class="template-actions">
                    <button
                      class="btn-secondary"
                      type="button"
                      [disabled]="store.saving()"
                      (click)="startEdit(template)"
                    >
                      {{ strings.list.editButton }}
                    </button>
                    <button
                      class="btn-secondary btn-delete"
                      type="button"
                      [disabled]="store.saving()"
                      (click)="deleteTemplate(template)"
                      [title]="strings.list.deleteButton"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path
                          d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }

      @if (showForm()) {
        <mapit-element-template-form (saved)="onSaved()" (formClosed)="onClosed()" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 1.5rem;
      max-width: 800px;
      margin: 0 auto;
    }

    .templates-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .templates-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
    }

    .header-copy {
      flex: 1;
    }

    .templates-title {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--mapit-color-text);
      letter-spacing: -0.01em;
    }

    .templates-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.9375rem;
      color: var(--mapit-color-text-muted);
    }

    .state {
      padding: 3rem 1.5rem;
      text-align: center;
      font-size: 0.875rem;
      color: var(--mapit-color-text-muted);
    }

    .empty {
      border: 1px dashed var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      background: var(--mapit-color-surface-low);
    }

    .message {
      margin: 0;
      padding: 0.75rem 1rem;
      border-radius: var(--mapit-radius);
      font-size: 0.875rem;
    }
    .error {
      color: var(--mapit-color-error);
      background: #fef2f2;
      border: 1px solid #fca5a5;
    }

    .templates-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--mapit-color-surface);
      border: 1px solid var(--mapit-color-border);
      border-radius: var(--mapit-radius);
      overflow: hidden;
    }

    .templates-table th,
    .templates-table td {
      padding: 0.75rem 1rem;
      text-align: left;
      font-size: 0.875rem;
    }

    .templates-table th {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--mapit-color-text-muted);
      background: var(--mapit-color-surface-low);
      border-bottom: 1px solid var(--mapit-color-border);
    }

    .templates-table td {
      color: var(--mapit-color-text);
      vertical-align: middle;
    }
    .templates-table tbody tr {
      border-top: 1px solid var(--mapit-color-border);
    }

    .template-name {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .template-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-primary,
    .btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: var(--mapit-radius-input);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .btn-primary {
      padding: 0.55rem 1.1rem;
      border: none;
      border-radius: var(--mapit-radius);
      background: var(--mapit-color-primary);
      color: var(--mapit-color-on-primary);
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.08);
    }
    .btn-primary:hover:not(:disabled) {
      background: color-mix(in srgb, var(--mapit-color-primary) 85%, black);
    }
    .btn-primary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--mapit-color-focus-ring);
    }

    .btn-secondary {
      border: 1px solid var(--mapit-color-border);
      background: var(--mapit-color-surface);
      color: var(--mapit-color-text);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--mapit-color-surface-low);
    }
    .btn-secondary:disabled,
    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-delete {
      padding: 0.5rem;
      color: var(--mapit-color-error);
    }
    .btn-delete:hover:not(:disabled) {
      background: #fef2f2;
      border-color: #fca5a5;
    }
  `,
})
export class ElementTemplateListPageComponent {
  protected readonly store = inject(TemplatesStore);
  protected readonly strings = STRINGS.spaces.templates;
  protected readonly typeStrings = STRINGS.spaces.elements.types;
  protected readonly showForm = signal(false);

  protected readonly templates = computed(() => this.store.templates());
  protected readonly loading = computed(() => this.store.loading());

  constructor() {
    this.store.loadTemplates();
  }

  protected startCreate(): void {
    this.store.startNew();
    this.showForm.set(true);
  }

  protected startEdit(template: ElementTemplate): void {
    this.store.editTemplate(template);
    this.showForm.set(true);
  }

  protected deleteTemplate(template: ElementTemplate): void {
    if (confirm(this.strings.form.deleteConfirm.replace('{name}', template.name))) {
      this.store.deleteTemplate(template.id).subscribe();
    }
  }

  protected onSaved(): void {
    this.showForm.set(false);
  }

  protected onClosed(): void {
    this.showForm.set(false);
    this.store.startNew();
  }

  protected typeLabel(type: string): string {
    return this.typeStrings[type as keyof typeof this.typeStrings] ?? type;
  }
}
