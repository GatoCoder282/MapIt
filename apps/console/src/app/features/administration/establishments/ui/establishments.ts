import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Establishment, EstablishmentType } from '@mapit/api-client';
import { EstablishmentsStore } from '../model/establishments-store';

/** Pantalla de gestión de establecimientos del tenant (CU-04). */
@Component({
  selector: 'mapit-establishments',
  imports: [DatePipe],
  providers: [EstablishmentsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">MapIt · administración</p>
          <h1>Establecimientos</h1>
          <p class="intro">Los lugares físicos que tu empresa opera en MapIt.</p>
        </div>
        <button class="secondary" type="button" (click)="store.startNew()">
          Nuevo establecimiento
        </button>
      </header>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <section class="workspace">
        <article class="card form-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">{{ store.isEditing() ? 'Edición' : 'Alta' }}</p>
              <h2>{{ store.isEditing() ? 'Editar establecimiento' : 'Crear establecimiento' }}</h2>
            </div>
          </div>

          <label>
            Nombre
            <input
              #name
              [value]="store.draft().name"
              maxlength="120"
              placeholder="Ej. Bar Central"
              (input)="store.setName(name.value)"
            />
          </label>

          <label>
            Tipo
            <select
              #type
              [value]="store.draft().type"
              [disabled]="store.isEditing()"
              (change)="onTypeChange(type.value)"
            >
              @for (option of store.types; track option) {
                <option [value]="option" [selected]="option === store.draft().type">
                  {{ label(option) }}
                </option>
              }
            </select>
          </label>
          @if (store.isEditing()) {
            <p class="hint">
              El tipo no se puede cambiar: define qué plantillas de elemento aplican al mapa.
            </p>
          }

          <label>
            Slug
            <input
              #slug
              [value]="store.draft().slug"
              maxlength="63"
              placeholder="bar-central"
              (input)="store.setSlug(slug.value)"
            />
          </label>
          <p class="hint">Se usa en la URL pública de reserva. Minúsculas, dígitos y guiones.</p>

          <label>
            Zona horaria
            <input
              #timezone
              [value]="store.draft().timezone"
              maxlength="64"
              placeholder="America/La_Paz"
              (input)="store.setTimezone(timezone.value)"
            />
          </label>

          <div class="actions">
            <button
              class="primary"
              type="button"
              [disabled]="store.saving()"
              (click)="store.save()"
            >
              {{
                store.saving()
                  ? 'Guardando…'
                  : store.isEditing()
                    ? 'Guardar cambios'
                    : 'Crear establecimiento'
              }}
            </button>
            @if (store.isEditing()) {
              <button
                class="secondary"
                type="button"
                [disabled]="store.saving()"
                (click)="store.startNew()"
              >
                Cancelar
              </button>
            }
          </div>
        </article>

        <article class="card list-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">Consulta</p>
              <h2>Establecimientos registrados</h2>
            </div>
            <span class="count">{{ store.items().length }}</span>
          </div>

          @if (store.loading()) {
            <p class="empty">Cargando establecimientos…</p>
          } @else if (store.items().length === 0) {
            <p class="empty">Todavía no hay establecimientos. Crea el primero.</p>
          } @else {
            <div class="items">
              @for (item of store.items(); track item.id) {
                <div class="item-row">
                  <div class="item-info">
                    <div class="item-title">
                      <strong>{{ item.name }}</strong>
                      <span class="badge">{{ label(item.type) }}</span>
                    </div>
                    <p>
                      <code>/{{ item.slug }}</code> · {{ item.timezone }}
                    </p>
                    <small>Actualizado {{ item.updatedAt | date: 'short' }}</small>
                  </div>
                  <div class="row-actions">
                    <button
                      class="link-button"
                      type="button"
                      [disabled]="store.saving()"
                      (click)="store.edit(item)"
                    >
                      Editar
                    </button>
                    <button
                      class="danger"
                      type="button"
                      [disabled]="store.saving()"
                      (click)="confirmRemove(item)"
                    >
                      Dar de baja
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </article>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100dvh;
      background: #f5f7fb;
    }
    .page {
      width: min(1120px, calc(100% - 2rem));
      margin: 0 auto;
      padding: 3rem 0;
    }
    .page-header,
    .card-heading,
    .item-title,
    .actions,
    .row-actions {
      display: flex;
      align-items: center;
    }
    .page-header,
    .card-heading {
      justify-content: space-between;
      gap: 1rem;
    }
    .page-header {
      margin-bottom: 2rem;
    }
    .eyebrow {
      margin: 0 0 0.4rem;
      color: #2563eb;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    h1 {
      margin: 0;
      color: #172033;
      font-size: clamp(1.8rem, 4vw, 2.6rem);
    }
    h2 {
      margin: 0;
      color: #172033;
      font-size: 1.15rem;
    }
    .intro {
      margin: 0.5rem 0 0;
      color: #64748b;
    }
    .message {
      margin: 0 0 1.5rem;
      padding: 0.85rem 1rem;
      border-radius: 0.65rem;
    }
    .error {
      color: #991b1b;
      background: #fee2e2;
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
      gap: 1.5rem;
      align-items: start;
    }
    .card {
      padding: 1.5rem;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      background: #fff;
    }
    .card-heading {
      margin-bottom: 1.25rem;
    }
    .form-card label {
      display: block;
      margin-bottom: 0.35rem;
      color: #334155;
      font-size: 0.9rem;
    }
    input,
    select {
      display: block;
      width: 100%;
      margin-top: 0.35rem;
      padding: 0.6rem 0.7rem;
      border: 1px solid #cbd5f5;
      border-radius: 0.55rem;
      color: #172033;
      font: inherit;
      background: #fff;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: #2563eb;
    }
    select:disabled {
      background: #f1f5f9;
      color: #64748b;
      cursor: not-allowed;
    }
    .hint {
      margin: 0.35rem 0 1rem;
      color: #94a3b8;
      font-size: 0.78rem;
    }
    .actions {
      gap: 0.75rem;
      margin-top: 1.25rem;
    }
    button {
      padding: 0.6rem 1.1rem;
      border: none;
      border-radius: 0.55rem;
      font: inherit;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .primary {
      color: #fff;
      background: #2563eb;
    }
    .secondary {
      color: #1e40af;
      background: #dbeafe;
    }
    .count {
      padding: 0.15rem 0.7rem;
      border-radius: 999px;
      color: #1e40af;
      background: #dbeafe;
    }
    .empty {
      margin: 0;
      color: #64748b;
    }
    .items {
      display: grid;
      gap: 0.75rem;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.9rem 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
    }
    .item-title {
      gap: 0.6rem;
    }
    .badge {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      color: #166534;
      background: #dcfce7;
      font-size: 0.72rem;
    }
    .item-info p {
      margin: 0.35rem 0;
      color: #64748b;
      font-size: 0.9rem;
    }
    .item-info small {
      color: #94a3b8;
    }
    code {
      padding: 0.05rem 0.3rem;
      border-radius: 0.3rem;
      background: #f1f5f9;
    }
    .row-actions {
      gap: 0.5rem;
    }
    .link-button {
      padding: 0.4rem 0.6rem;
      color: #2563eb;
      background: transparent;
    }
    .danger {
      padding: 0.4rem 0.7rem;
      color: #b91c1c;
      background: #fee2e2;
    }
    @media (max-width: 900px) {
      .workspace {
        grid-template-columns: 1fr;
      }
      .item-row {
        flex-direction: column;
      }
    }
  `,
})
export class Establishments {
  protected readonly store = inject(EstablishmentsStore);

  private static readonly ETIQUETAS: Record<EstablishmentType, string> = {
    RESTAURANT: 'Restaurante',
    NIGHTCLUB: 'Discoteca',
    EVENT_HALL: 'Salón de eventos',
    HOTEL: 'Hotel',
  };

  protected label(type: EstablishmentType): string {
    return Establishments.ETIQUETAS[type];
  }

  protected onTypeChange(value: string): void {
    this.store.setType(value as EstablishmentType);
  }

  protected confirmRemove(item: Establishment): void {
    if (
      confirm(`¿Dar de baja "${item.name}"? Dejará de aparecer, pero no se borra el histórico.`)
    ) {
      this.store.remove(item.id);
    }
  }
}
