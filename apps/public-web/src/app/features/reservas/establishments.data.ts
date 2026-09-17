/**
 * Datos mock de la página Reservas (listado de tenantes).
 * TODO(CU-15): reemplazar por el endpoint público de tenants cuando exista
 * en el contrato OpenAPI. Por ahora el contenido replica la referencia visual.
 *
 * Las imágenes (`image`) son opcionales: mientras no haya fotos reales de los
 * establecimientos, la tarjeta muestra un placeholder degradado por categoría.
 * Cuando el usuario aporte las fotos, basta con guardarlas en
 * `apps/public-web/public/assets/img/` y rellenar `image` + `imageAlt` aquí.
 */

export type VenueCategory = 'restaurante' | 'discoteca' | 'eventos' | 'hotel';

export interface Establishment {
  readonly id: string;
  readonly name: string;
  readonly city: string;
  readonly category: VenueCategory;
  readonly categoryLabel: string;
  readonly rating: number;
  readonly reviews: number;
  /** Foto real del establecimiento; si falta, se renderiza un placeholder. */
  readonly image?: string;
  readonly imageAlt?: string;
  readonly badge?: { readonly text: string; readonly tone: 'available' | 'dark' };
  readonly amenities: readonly string[];
}

export const ESTABLISHMENTS: readonly Establishment[] = [
  {
    id: 'la-bahia',
    name: 'Restaurante La Bahía',
    city: 'Cochabamba',
    category: 'restaurante',
    categoryLabel: 'Restaurante',
    rating: 4.8,
    reviews: 124,
    badge: { text: 'Disponible hoy', tone: 'available' },
    amenities: ['Terraza', 'WiFi', 'Estacionamiento'],
  },
  {
    id: 'club-eclipse',
    name: 'Club Eclipse',
    city: 'Cochabamba',
    category: 'discoteca',
    categoryLabel: 'Discoteca',
    rating: 4.6,
    reviews: 98,
    badge: { text: '12 espacios disponibles', tone: 'dark' },
    amenities: ['VIP', 'Pista de baile', 'Bar'],
  },
  {
    id: 'los-tajibos',
    name: 'Hotel Los Tajibos',
    city: 'Santa Cruz',
    category: 'hotel',
    categoryLabel: 'Hotel',
    rating: 4.7,
    reviews: 210,
    badge: { text: 'Disponible esta semana', tone: 'available' },
    amenities: ['Piscina', 'Spa', 'Restaurante'],
  },
  {
    id: 'salon-real',
    name: 'Salón Real',
    city: 'Cochabamba',
    category: 'eventos',
    categoryLabel: 'Eventos',
    rating: 4.5,
    reviews: 87,
    badge: { text: 'Disponibilidad inmediata', tone: 'available' },
    amenities: ['Capacidad 500', 'Sonido', 'Pantalla LED'],
  },
  {
    id: 'sky-lounge',
    name: 'Sky Lounge',
    city: 'Cochabamba',
    category: 'restaurante',
    categoryLabel: 'Restaurante',
    rating: 4.7,
    reviews: 156,
    badge: { text: 'Disponible hoy', tone: 'available' },
    amenities: ['Terraza', 'Bar', 'Vista panorámica'],
  },
  {
    id: 'gran-amazona',
    name: 'Hotel Gran Amazona',
    city: 'Santa Cruz',
    category: 'hotel',
    categoryLabel: 'Hotel',
    rating: 4.4,
    reviews: 92,
    badge: { text: 'Disponible esta semana', tone: 'available' },
    amenities: ['Piscina', 'Gimnasio', 'Restaurante'],
  },
];
