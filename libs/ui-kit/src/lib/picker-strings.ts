export const PICKER_STRINGS = {
  /** Placeholder del input cuando no hay zona elegida. */
  timezonePlaceholder: 'Buscar zona horaria…',
  /** Estado vacío del listbox cuando el filtro no devuelve nada. */
  timezoneNoResults: 'Sin coincidencias',
  /** Descripción accesible del control. */
  timezoneAria: 'Zona horaria con buscador',
} as const;

export type PickerStrings = typeof PICKER_STRINGS;
