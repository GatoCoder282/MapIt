/**
 * Textos centralizados para la gestión de Pisos y Sectores (CU-05).
 * Fuente única de verdad para la UI: no hay textos quemados en templates ni lógica.
 */
export const SPACES_STRINGS = {
  floors: {
    title: 'Plantas',
    subtitle: 'Gestión de pisos del establecimiento',
    empty: 'No hay plantas registradas. Crea la primera.',
    loading: 'Cargando plantas…',
    createButton: 'Nueva planta',
    form: {
      createTitle: 'Crear planta',
      editTitle: 'Editar planta',
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Planta baja',
      nameMaxLength: 100,
      nameRequired: 'El nombre es obligatorio.',
      nameTooLong: 'El nombre no puede exceder los 100 caracteres.',
      cancelButton: 'Cancelar',
      saveButton: 'Crear planta',
      updateButton: 'Guardar cambios',
      saving: 'Guardando…',
    },
    list: {
      nameHeader: 'Nombre',
      slugHeader: 'Slug',
      levelHeader: 'Nivel',
      actionsHeader: 'Acciones',
      editButton: 'Editar',
      deleteButton: 'Eliminar',
      deleteConfirm: '¿Eliminar la planta "{name}"? Esta acción no se puede deshacer.',
    },
    errors: {
      loadFailed: 'No se pudieron cargar las plantas.',
      saveFailed: 'No se pudo guardar la planta.',
      deleteFailed: 'No se pudo eliminar la planta.',
      slugConflict: 'Ya existe una planta con ese slug.',
      notFound: 'Planta no encontrada.',
    },
  },
  sectors: {
    title: 'Sectores',
    subtitle: 'Gestión de sectores por planta',
    empty: 'No hay sectores en esta planta. Crea el primero.',
    loading: 'Cargando sectores…',
    createButton: 'Nuevo sector',
    form: {
      createTitle: 'Crear sector',
      editTitle: 'Editar sector',
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Terraza norte',
      nameMaxLength: 100,
      nameRequired: 'El nombre es obligatorio.',
      nameTooLong: 'El nombre no puede exceder los 100 caracteres.',
      cancelButton: 'Cancelar',
      saveButton: 'Crear sector',
      updateButton: 'Guardar cambios',
      saving: 'Guardando…',
    },
    list: {
      nameHeader: 'Nombre',
      slugHeader: 'Slug',
      capacityHeader: 'Capacidad máx.',
      actionsHeader: 'Acciones',
      editButton: 'Editar',
      deleteButton: 'Eliminar',
      deleteConfirm: '¿Eliminar el sector "{name}"? Esta acción no se puede deshacer.',
    },
    errors: {
      loadFailed: 'No se pudieron cargar los sectores.',
      saveFailed: 'No se pudo guardar el sector.',
      deleteFailed: 'No se pudo eliminar el sector.',
      slugConflict: 'Ya existe un sector con ese slug en esta planta.',
      floorNotFound: 'La planta seleccionada no existe.',
      notFound: 'Sector no encontrado.',
    },
  },
} as const;

export type SpacesStrings = typeof SPACES_STRINGS;
