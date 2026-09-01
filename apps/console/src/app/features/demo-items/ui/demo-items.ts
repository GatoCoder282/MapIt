import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DemoItemsStore } from '../model/demo-items-store';

/** Pantalla de demostración con alta, consulta, edición y eliminación. */
@Component({
  selector: 'mapit-demo-items',
  imports: [DatePipe],
  providers: [DemoItemsStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">MapIt · prueba de integración</p>
          <h1>Elementos de demostración</h1>
          <p class="intro">CRUD completo conectado a Angular, Spring Boot y PostgreSQL.</p>
        </div>
        <button class="secondary" type="button" (click)="store.startNew()">Nuevo elemento</button>
      </header>

      @if (store.error(); as error) {
        <p class="message error" role="alert">{{ error }}</p>
      }

      <section class="workspace">
        <article class="card form-card">
          <div class="card-heading">
            <div>
              <p class="eyebrow">{{ store.isEditing() ? 'Edición' : 'Alta' }}</p>
              <h2>{{ store.isEditing() ? 'Editar elemento' : 'Crear elemento' }}</h2>
            </div>
          </div>

          <label>
            Nombre
            <input
              #name
              [value]="store.draft().name"
              maxlength="120"
              placeholder="Ej. Mesa terraza"
              (input)="store.setName(name.value)"
            />
          </label>

          <label>
            Descripción
            <textarea
              #description
              [value]="store.draft().description"
              maxlength="500"
              placeholder="Describe el elemento"
              rows="4"
              (input)="store.setDescription(description.value)"
            ></textarea>
          </label>

          <label class="checkbox">
            <input
              #active
              type="checkbox"
              [checked]="store.draft().active"
              (change)="store.setActive(active.checked)"
            />
            Elemento activo
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
                    : 'Crear elemento aaaaaa'
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
              <h2>Elementos guardados</h2>
            </div>
            <span class="count">{{ store.items().length }}</span>
          </div>

          @if (store.loading()) {
            <p class="empty">Cargando elementos…</p>
          } @else if (store.items().length === 0) {
            <p class="empty">Todavía no hay elementos. Crea el primero.</p>
          } @else {
            <div class="items">
              @for (item of store.items(); track item.id) {
                <div class="item-row">
                  <div class="item-info">
                    <div class="item-title">
                      <strong>{{ item.name }}</strong>
                      <span [class.inactive]="!item.active">{{
                        item.active ? 'Activo' : 'Inactivo'
                      }}</span>
                    </div>
                    <p>{{ item.description || 'Sin descripción' }}</p>
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
                      (click)="store.remove(item.id)"
                    >
                      Eliminar
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
    .eyebrow {
      margin: 0 0 0.4rem;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1,
    h2,
    p {
      margin-top: 0;
    }
    h1 {
      margin-bottom: 0.5rem;
      color: #172033;
      font-size: clamp(1.8rem, 4vw, 2.6rem);
    }
    h2 {
      margin-bottom: 0;
      color: #172033;
      font-size: 1.15rem;
    }
    .intro {
      margin-bottom: 0;
      color: #64748b;
    }
    .message {
      margin: 1.5rem 0 0;
      padding: 0.8rem 1rem;
      border-radius: 0.65rem;
    }
    .error {
      color: #991b1b;
      background: #fee2e2;
    }
    .workspace {
      display: grid;
      grid-template-columns: minmax(260px, 0.8fr) minmax(0, 1.2fr);
      gap: 1.25rem;
      margin-top: 2rem;
    }
    .card {
      padding: 1.4rem;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      background: #fff;
      box-shadow: 0 12px 30px rgb(15 23 42 / 6%);
    }
    .form-card label {
      display: grid;
      gap: 0.45rem;
      margin-top: 1.25rem;
      color: #334155;
      font-size: 0.9rem;
      font-weight: 600;
    }
    input:not([type='checkbox']),
    textarea {
      width: 100%;
      padding: 0.7rem 0.8rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.55rem;
      color: #172033;
      font: inherit;
      resize: vertical;
    }
    input:focus,
    textarea:focus {
      border-color: #2563eb;
      outline: 3px solid rgb(37 99 235 / 15%);
    }
    .checkbox {
      display: flex !important;
      grid-template-columns: none !important;
      align-items: center;
      gap: 0.6rem !important;
    }
    .checkbox input {
      accent-color: #2563eb;
    }
    .actions {
      flex-wrap: wrap;
      gap: 0.7rem;
      margin-top: 1.5rem;
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
    .count {
      display: grid;
      min-width: 2rem;
      min-height: 2rem;
      place-items: center;
      border-radius: 999px;
      color: #1e40af;
      background: #dbeafe;
      font-weight: 700;
    }
    .empty {
      margin: 2rem 0 0;
      color: #64748b;
      text-align: center;
    }
    .items {
      margin-top: 1.25rem;
    }
    .item-row {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 0;
      border-top: 1px solid #e2e8f0;
    }
    .item-title {
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .item-title span {
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      color: #166534;
      background: #dcfce7;
      font-size: 0.72rem;
      font-weight: 700;
    }
    .item-title .inactive {
      color: #475569;
      background: #e2e8f0;
    }
    .item-info p {
      margin: 0.45rem 0;
      color: #64748b;
    }
    small {
      color: #94a3b8;
    }
    .row-actions {
      align-items: flex-start;
      flex-shrink: 0;
      gap: 0.5rem;
    }
    .link-button {
      padding-inline: 0;
      color: #2563eb;
      background: transparent;
    }
    .danger {
      padding-inline: 0;
      color: #dc2626;
      background: transparent;
    }
    @media (max-width: 760px) {
      .page {
        padding: 2rem 0;
      }
      .page-header {
        align-items: flex-start;
        flex-direction: column;
      }
      .workspace {
        grid-template-columns: 1fr;
      }
      .item-row {
        flex-direction: column;
      }
    }
  `,
})
export class DemoItems {
  protected readonly store = inject(DemoItemsStore);
}
