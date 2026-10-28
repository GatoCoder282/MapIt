/**
 * Catalogo central de textos visibles de Console.
 *
 * Espanol es la fuente canonica y el fallback; los catalogos de ingles y
 * japones viven en archivos adyacentes y conservan la misma estructura.
 */
import {
  createLocalizedCatalog,
  createLocalizedTextResolver,
  type LocalizedShape,
} from '@mapit/i18n';
import { STRINGS_EN } from './strings.en';
import { STRINGS_JA } from './strings.ja';

const VERTICAL_LABELS = {
  RESTAURANT: 'Restaurante',
  NIGHTCLUB: 'Discoteca',
  EVENT_HALL: 'Salón de eventos',
  HOTEL: 'Hotel',
} as const;

const STRINGS_ES = {
  brand: {
    name: 'MapIt',
  },
  shell: {
    brandArea: 'Plataforma',
    nav: {
      dashboard: 'Dashboard',
      tenants: 'Tenants',
      settings: 'Configuración',
      profile: 'Perfil',
    },
    logout: 'Cerrar sesión',
    openMenu: 'Abrir navegación',
    closeMenu: 'Cerrar navegación',
    /**
     * Nombre accesible del landmark `<nav>` del rail.
     *
     * El `aria-label` estaba en el `<aside>` y el `<nav>` se quedaba sin nombre
     * accesible: un landmark sin nombre no se puede alcanzar por rol (WCAG
     * 1.3.1 / 2.4.1). Ahora el nombre lo lleva el `<nav>`, que es el
     * landmark que el usuario quiere ("la navegación de la plataforma").
     */
    navLandmarkLabel: 'Plataforma',
    /** Nombre accesible del `<nav>` del drawer móvil (otralandmark, otro nombre). */
    drawerNavLabel: 'Navegación móvil',
    /** Botón de la campana de notificaciones (decorativa: no hay endpoint). */
    notifications: 'Notificaciones',
    userMenu: 'Menú de usuario',
    roleLabels: {
      SUPER_ADMIN: 'Super Admin',
      ADMIN: 'Administrador',
      MANAGER: 'Gerente',
      STAFF: 'Staff',
    },
    sectionPending: 'Esta sección estará disponible en una próxima iteración.',
  },
  /** Shell de la consola operativa de staff (por tenant). */
  staffShell: {
    brandArea: 'Consola',
    /** Nombre accesible del landmark `<nav>` del rail de staff. */
    navLandmarkLabel: 'Consola',
    nav: {
      home: 'Inicio',
      map: 'Mapa',
      businesses: 'Negocios',
      users: 'Usuarios',
      reports: 'Reportes',
      settings: 'Configuración',
      templates: 'Plantillas de elementos',
      reservations: 'Reservas',
      audit: 'Auditoría',
    },
  },
  audit: {
    eyebrow: 'Administración',
    title: 'Bitácora de auditoría',
    intro: 'Consulta las acciones relevantes realizadas sobre reservas y elementos del espacio.',
    filtersTitle: 'Filtros del historial',
    resourceTypeLabel: 'Tipo de recurso',
    eventTypeLabel: 'Tipo de evento',
    resourceIdLabel: 'Identificador del recurso',
    resourceIdPlaceholder: 'UUID del recurso',
    fromLabel: 'Desde',
    toLabel: 'Hasta',
    allResources: 'Todos los recursos',
    allEvents: 'Todos los eventos',
    applyFilters: 'Aplicar filtros',
    clearFilters: 'Limpiar filtros',
    loading: 'Cargando historial…',
    emptyTitle: 'Sin eventos',
    empty: 'No hay eventos que coincidan con los filtros seleccionados.',
    error: 'No se pudo cargar la bitácora. Inténtalo de nuevo.',
    forbidden: 'Tu cuenta no tiene permisos para consultar la bitácora.',
    retry: 'Reintentar',
    paginationLabel: 'Paginación de la bitácora',
    previous: 'Anterior',
    next: 'Siguiente',
    pageOf: 'de',
    ofTotal: 'de',
    columns: {
      occurredAt: 'Fecha y hora',
      event: 'Evento',
      resource: 'Recurso',
      actor: 'Actor',
      details: 'Detalles',
    },
    resourceLabels: {
      RESERVATION: 'Reserva',
      SPACE_ELEMENT: 'Elemento del espacio',
    },
    eventLabels: {
      RESERVATION_CREATED: 'Reserva creada',
      RESERVATION_STATUS_CHANGED: 'Estado de reserva actualizado',
      SPACE_ELEMENT_STATE_CHANGED: 'Estado de elemento actualizado',
    },
    detailLabels: {
      initialStatus: 'Estado inicial',
      establishmentId: 'Establecimiento',
      previousState: 'Estado anterior',
      newState: 'Estado nuevo',
      sectorId: 'Sector',
      previousStatus: 'Estado anterior',
      newStatus: 'Estado nuevo',
    },
  },
  /**
   * Panel de control de la plataforma (SUPER_ADMIN).
   *
   * Sustituye al resumen plano que había antes: cuatro tarjetas de KPI, dos
   * gráficos y la tabla de tenants. Textos de la spec
   * `apps/console/design/platform-panel/`.
   */
  platformPanel: {
    eyebrow: 'MapIt · Plataforma',
    title: 'Panel de control de la plataforma',
    subtitle: 'Supervisá el crecimiento, estado y actividad de tus tenants.',

    loading: 'Cargando el panel de plataforma…',
    loadError: 'No se pudo cargar el panel de plataforma. Inténtalo de nuevo.',
    retry: 'Reintentar',

    /** Marcador único de "sin valor" del panel (mismo que el dashboard de home). */
    noValue: '—',
    /** "Sin datos": el dato no aplica (no es un 0 medido). */
    noData: 'Sin datos',

    /* ── Tarjeta 1: tenants totales ─────────────────────────── */
    kpiTotalTitle: 'Tenants totales',
    /** Nombre accesible del chevron de la tarjeta 1. */
    kpiTotalLink: 'Ver los tenants de la plataforma',
    /** Pie de la tarjeta 1: "{n} activos". */
    kpiTotalActive: '{n} activos',
    /** Pie de la tarjeta 1: "{n} suspendidos". */
    kpiTotalSuspended: '{n} suspendidos',

    /* ── Tarjeta 2: nuevos esta semana ─────────────────────── */
    kpiNewTitle: 'Nuevos esta semana',
    /** Nombre accesible del chevron de la tarjeta 2. */
    kpiNewLink: 'Ver los tenants dados de alta esta semana',
    /** Pie con variación real: "{n} % vs. semana anterior". */
    kpiNewVsLastWeek: '{n} % vs. semana anterior',
    /** Pie sin base real (la semana previa fue 0): nunca un porcentaje inventado. */
    kpiNewNoBase: '{n} nuevos esta semana',

    /* ── Tarjeta 3: distribución por vertical ───────────────── */
    kpiVerticalTitle: 'Distribución por vertical',
    /** Nombre accesible del chevron de la tarjeta 3. */
    kpiVerticalLink: 'Ver el reparto de tenants por vertical',

    /* ── Tarjeta 4: requieren atención ──────────────────────── */
    kpiAttentionTitle: 'Requieren atención',
    /** Nombre accesible del chevron de la tarjeta 4. */
    kpiAttentionLink: 'Ver los tenants que requieren atención',
    /** Pie de la tarjeta 4: "{n} suspendidos". */
    kpiAttentionSuspended: '{n} suspendidos',
    /**
     * Pie de la tarjeta 4: "{n} sin cambios en 30+ días".
     *
     * El contrato no trae "actividad del negocio": el criterio es `updatedAt`
     * del tenant. Nunca "sin actividad".
     */
    kpiAttentionNoChanges: '{n} sin cambios en 30+ días',

    /* ── Gráfico de altas por semana ────────────────────────── */
    growthTitle: 'Altas de tenants por semana',
    growthSubtitle: 'Nuevas empresas registradas por semana.',
    growthPeriod: 'Altas por semana',
    growthTotalUnit: 'altas',
    /** Nombre accesible del gráfico de altas. */
    growthAria: 'Gráfico de altas de tenants por semana, últimas {weeks} semanas',
    /** Nombre accesible del selector de rango. */
    growthRangeLabel: 'Rango del periodo del gráfico de altas de tenants',
    /** Opciones del selector de rango (semanas). */
    rangeOptions: [
      { weeks: 8, label: 'Últimas 8 semanas' },
      { weeks: 12, label: 'Últimas 12 semanas' },
      { weeks: 16, label: 'Últimas 16 semanas' },
    ],
    /** Caption de la tabla `sr-only` con los valores de cada semana. */
    growthDataCaption: 'Detalle numérico del gráfico de altas de tenants',
    growthDataWeek: 'Semana',
    growthDataValue: 'Altas',

    /* ── Donut de tenants por vertical ──────────────────────── */
    donutTitle: 'Tenants por vertical',
    donutSubtitle: 'Reparto de la plataforma por tipo de negocio.',
    /** Texto bajo el total del centro del donut. */
    donutTotalLabel: 'Total tenants',
    /** Nombre accesible del donut. */
    donutAria: 'Gráfico de tenants por vertical',
    /** Nombre accesible de la lista-leyenda. */
    donutLegendLabel: 'Detalle de tenants por vertical',
    donutEmpty: 'Todavía no hay tenants registrados.',
    /** Unidad del porcentaje en la leyenda y la tabla del donut (precedente: growthTotalUnit). */
    donutPercentUnit: '%',
    /** Caption de la tabla `sr-only` del donut. */
    donutDataCaption: 'Detalle numérico del gráfico de tenants por vertical',
    donutDataVertical: 'Vertical',
    donutDataCount: 'Tenants',
    donutDataPercent: 'Porcentaje',

    /* ── Panel de tenants (tabla) ───────────────────────────── */
    tableTitle: 'Tenants',
    tableSubtitle: 'Gestión de las empresas registradas en la plataforma.',
    /** Caption de la tabla (solo lectores de pantalla). */
    tableCaption: 'Tenants registrados en la plataforma',
    searchPlaceholder: 'Buscar tenant por nombre…',
    searchLabel: 'Buscar tenant por nombre',
    filterStatus: 'Filtrar estado',
    filterAll: 'Todos',
    filterActive: 'Activo',
    filterSuspended: 'Suspendido',
    export: 'Exportar',
    newTenant: 'Nuevo tenant',
    columns: {
      tenant: 'Tenant',
      vertical: 'Vertical',
      status: 'Estado',
      createdAt: 'Fecha de alta',
      updatedAt: 'Últ. cambio',
      actions: 'Acciones',
    },
    statusActive: 'Activo',
    statusSuspended: 'Suspendido',
    /**
     * Badge secundario del tenant activo que lleva 30+ días sin modificarse.
     * "Sin actividad" no existe en el contrato: el criterio es `updatedAt`.
     */
    badgeNoChanges: 'Sin cambios',
    emptyTitle: 'No hay tenants que coincidan',
    empty: 'Ajusta la búsqueda o el filtro de estado para ver resultados.',
    clearFilters: 'Limpiar filtros',
    tableError: 'No se pudo cargar el listado de tenants. Inténtalo de nuevo.',
    /** Pie de la tabla: "Mostrando 1–5 de 35 tenants". */
    showing: 'Mostrando {from}–{to} de {total} tenants',
    paginationLabel: 'Paginación de tenants',
    pageOf: 'de',
    previous: 'Anterior',
    next: 'Siguiente',
    /** Nombre accesible del botón de acciones de una fila. */
    detailFor: 'Ver detalle de {name}',
    /** "Últ. cambio": tiempo relativo. */
    relativeNow: 'Hace instantes',
    relativeMinutes: 'Hace {n} min',
    relativeHours: 'Hace {n} h',
    relativeYesterday: 'Ayer',
    relativeDays: 'Hace {n} días',
  },
  /** Dashboard de administrador en la pantalla de inicio/home. */
  adminDashboardHome: {
    title: 'Dashboard',
    heroEyebrow: '¡Hola,',
    heroTitle: 'Gestiona, analiza y haz crecer tu red de negocios',
    heroSubtitle:
      'Aquí tienes un resumen de la actividad en tu plataforma. Revisa tus negocios, su distribución y crecimiento.',
    summaryTitle: 'Resumen de la plataforma',
    noData: 'Sin datos',
    noValue: '—',
    loading: 'Cargando resumen…',
    loadError: 'No se pudieron cargar los negocios. Inténtalo de nuevo.',
    retry: 'Reintentar',

    kpiBusinesses: 'Total de negocios',
    kpiNewThisWeek: 'nuevas esta semana',
    kpiNewThisWeekOne: 'nueva esta semana',
    kpiVsLastWeek: 'altas vs. semana anterior',
    kpiInPlatform: 'en la plataforma',
    tenantsTotal: 'Tenants registrados',
    kpiReservations: 'Reservas',
    kpiReservationsVsLastWeek: 'reservas vs. semana anterior',

    /**
     * KPI y panel "Ocupación en vivo" (v7). El vocabulario es "elementos",
     * nunca "mesas": `space_element.type` incluye TABLE | BAR | SECTOR_ZONE |
     * STAGE | SEAT | ROOM | DECOR y las reglas de reservabilidad por vertical
     * (CU-19…22) no están implementadas.
     */
    kpiOccupancy: '% de ocupación',
    /** Unidad del denominador del KPI de ocupación. */
    kpiOccupancyOperable: 'elementos en servicio',
    occupancyPanelTitle: 'Ocupación en vivo',
    occupancyPanelSubtitle: 'Estado actual de los elementos del espacio.',
    /**
     * Los cinco estados, en el orden del panel. La concordancia es con
     * "elemento" (masculino): el panel nunca dice "mesas", así que tampoco
     * dice "Ocupada".
     */
    occupancyStates: {
      AVAILABLE: 'Disponible',
      OCCUPIED: 'Ocupado',
      RESERVED: 'Reservado',
      CLEANING: 'En limpieza',
      OUT_OF_SERVICE: 'Fuera de servicio',
    },
    /** Unidad del total de elementos del panel. */
    occupancyTotalUnit: 'elementos',
    /** Estado vacío: el tenant todavía no tiene elementos. */
    occupancyEmpty: 'Sin elementos',
    occupancyEmptyNote: 'Todavía no hay elementos que contar.',
    /** Error del resumen de estados: aísla su fuente, el resto sigue igual. */
    occupancyError: 'No se pudo cargar el estado de los elementos. Inténtalo de nuevo.',
    /** Limitación honesta del conteo (una línea, sin jerga). */
    occupancyNote: 'Cuenta todos los elementos del espacio, no solo los que se pueden reservar.',
    /** Chip de conexión: nunca dice "en vivo" si no lo está. */
    occupancyLive: 'En vivo',
    occupancyConnecting: 'Conectando…',
    occupancyDisconnected: 'Sin conexión',
    occupancyConnectionError: 'Error de conexión',
    occupancySnapshot: 'Instantánea',
    /** Nota de pie que explica el panel cuando no hay directo. */
    occupancyConnectingNote: 'Conectando con el servicio en vivo…',
    occupancyDisconnectedNote: 'Sin conexión: se muestran los últimos valores conocidos.',
    occupancyConnectionErrorNote: 'Error de conexión: se muestran los últimos valores conocidos.',
    occupancyDisabledNote:
      'Instantánea: la actualización en vivo está desactivada, los datos son de la última carga.',
    occupancyIdleNote:
      'Instantánea: todavía no hay conexión en vivo, los datos son de la última carga.',

    growthTitle: 'Crecimiento de negocios',
    growthSubtitle: 'Evolución de altas semanales.',
    growthPeriod: 'Altas por semana',
    periodCurrent: 'Actual',
    /**
     * Opciones del selector de rango del periodo (semanas). El valor de cada
     * opción es el número de semanas; la etiqueta es lo que se ve.
     */
    rangeOptions: [
      { weeks: 4, label: 'Últimas 4 semanas' },
      { weeks: 8, label: 'Últimas 8 semanas' },
      { weeks: 12, label: 'Últimas 12 semanas' },
    ],
    /** Nombre accesible del selector de rango del gráfico de negocios. */
    rangeLabelGrowth: 'Rango del periodo del gráfico de negocios',
    /** Nombre accesible del selector de rango del gráfico de reservas. */
    rangeLabelReservations: 'Rango del periodo del gráfico de reservas',
    /** Unidad del total del periodo en el header del panel de negocios. */
    periodTotalAltas: 'altas',
    /** Unidad del total del periodo en el header del panel de reservas. */
    periodTotalReservas: 'reservas',
    /** Detalle de la comparación contra la primera semana del periodo. */
    periodDeltaVsFirst: 'vs. la primera semana del periodo',
    /** Enlace del pie de los paneles de gráfico. */
    chartViewAll: 'Ver todos',
    /** Nombre accesible del enlace del pie (su destino es el listado de negocios). */
    chartViewAllAria: 'Ver todos los negocios',
    chartEmpty: 'Sin datos en las últimas {weeks} semanas.',
    chartDataCaption: 'Detalle numérico del gráfico',
    chartDataPeriod: 'Semana',
    chartDataValue: 'Valor',
    /** Resumen que ECharts lee como nombre accesible del gráfico (aria). */
    chartAriaSummary: 'Máximo {max}, mínimo {min}, total {total}.',
    growthAria: 'Gráfico de crecimiento de negocios, últimas {weeks} semanas',

    reservationsGrowthTitle: 'Crecimiento de reservas',
    reservationsGrowthSubtitle: 'Evolución de reservas semanales.',
    reservationsGrowthPeriod: 'Reservas por semana',
    reservationsGrowthAria: 'Gráfico de crecimiento de reservas, últimas {weeks} semanas',

    paymentsPanelTitle: 'Reservas y pagos',
    paymentsPanelSubtitle: 'Personas del tenant y estado de los pagos.',
    paymentsPeopleLabel: 'Personas registradas',
    paymentsQrLabel: 'Pagos QR',
    paymentsRevenueLabel: 'Ingresos',
    paymentsConversionLabel: 'Tasa de conversión',
    paymentsPendingNote:
      'Pagos QR, ingresos y tasa de conversión se rellenan solos cuando llegue la capacidad de pagos (CU-17). La rama con datos reales depende de la flag «payments.qr», hoy apagada.',
    paymentsEnabledNote:
      'Pagos QR, ingresos y tasa de conversión se rellenan solos cuando exista el endpoint de pagos (CU-17). La capacidad «payments.qr» ya está activa en este tenant.',

    activityTitle: 'Actividad reciente',
    activityRegistered: 'registrado',
    activityEmpty: 'Sin actividad con fecha de alta válida.',
    activityViewAll: 'Ver negocios',

    quickTitle: 'Accesos rápidos',
    quickRegister: 'Registrar negocio',
    quickRegisterDesc: 'Da de alta un nuevo establecimiento',
    quickStructure: 'Estructura del espacio',
    quickStructureDesc: 'Plantas, sectores y elementos',
    quickTemplates: 'Plantillas de elementos',
    quickTemplatesDesc: 'Reutiliza configuraciones de elementos',
    quickReservation: 'Nueva reserva',
    quickReservationDesc: 'Crea una reserva interna',
    quickPlatform: 'Panel de plataforma',
    quickPlatformDesc: 'Gestiona tenants de toda la plataforma',

    ctaTitle: 'Más negocios, mayor impacto',
    ctaBody: 'MapIt te ayuda a conectar, crecer y potenciar tu red comercial.',
    ctaButton: 'Gestionar negocios',
  },
  /** Traducciones de las verticales de negocio: una sola fuente para toda la app. */
  verticals: VERTICAL_LABELS,
  tenants: {
    title: 'Tenants',
    intro: 'Empresas registradas en la plataforma. El negocio suspende; no hay borrado físico.',
    newTenant: 'Nuevo tenant',
    searchPlaceholder: 'Buscar por nombre o slug…',
    searchLabel: 'Buscar tenants',
    filterStatus: 'Filtrar por estado',
    allStatuses: 'Todos',
    paginationLabel: 'Paginación',
    statusLabels: {
      ACTIVE: '😊 Activo',
      SUSPENDED: '😴 Suspendido',
    },
    verticalLabels: VERTICAL_LABELS,
    columns: {
      name: 'Nombre',
      slug: 'Slug',
      vertical: 'Vertical',
      status: 'Estado',
      createdAt: 'Creado',
      actions: 'Acciones',
    },
    loading: 'Cargando tenants…',
    empty: 'No hay tenants que coincidan con los filtros.',
    emptyTitle: 'Sin resultados',
    error: 'No se pudo cargar el listado. Inténtalo de nuevo.',
    retry: 'Reintentar',
    viewDetail: 'Ver detalle',
    previous: 'Anterior',
    next: 'Siguiente',
    pageOf: 'de',
    ofTotal: 'de',
  },
  tenantForm: {
    createEyebrow: 'MapIt · Administración de plataforma',
    createTitle: 'Nuevo tenant',
    createIntro: 'Registra una empresa en la plataforma y define su vertical inicial.',
    editTitle: 'Editar tenant',
    nameLabel: 'Nombre de la organización',
    namePlaceholder: 'Ej. Restaurante Central',
    nameError: 'Ingresa un nombre de hasta 120 caracteres.',
    slugLabel: 'Slug',
    slugPlaceholder: 'restaurante-central',
    slugHint: 'Minúsculas, números y guiones. Identifica la empresa en las URLs.',
    slugError: 'El slug debe tener entre 2 y 63 caracteres válidos.',
    slugImmutable: 'El slug no se puede modificar después del alta.',
    verticalLabel: 'Vertical de negocio',
    verticalImmutable: 'La vertical se asigna al crear el tenant y no se puede modificar.',
    adminEmailLabel: 'Correo del administrador',
    adminEmailPlaceholder: 'admin@empresa.com',
    adminEmailError: 'Ingresa un correo válido.',
    adminEmailHint: 'Recibirá la confirmación del alta. Se usará para la invitación (CU-25).',
    submitCreate: 'Registrar tenant',
    submitSaving: 'Registrando…',
    submitEdit: 'Guardar cambios',
    submitEditing: 'Guardando…',
    registerAnother: 'Registrar otro',
    cancel: 'Cancelar',
    backToList: 'Volver al listado',
    successCreate: 'Tenant registrado correctamente.',
    successUpdate: 'Cambios guardados.',
    successIdPrefix: 'ID:',
    errors: {
      badRequest: 'Revisa los datos ingresados.',
      unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión.',
      forbidden: 'No tienes permisos para esta operación.',
      slugConflict: 'El slug ya está registrado por otra empresa.',
      emailUnavailable: 'No se pudo enviar el correo de confirmación. Inténtalo de nuevo.',
      generic: 'No se pudo completar la operación. Inténtalo de nuevo.',
    },
  },
  tenantDetail: {
    title: 'Detalle del tenant',
    notFound: 'El tenant no existe o fue dado de baja.',
    loading: 'Cargando detalle…',
    loadError: 'No se pudo cargar el detalle. Inténtalo de nuevo.',
    retry: 'Reintentar',
    fieldName: 'Nombre',
    fieldSlug: 'Slug',
    fieldVertical: 'Vertical',
    fieldStatus: 'Estado',
    fieldCreatedAt: 'Alta',
    fieldUpdatedAt: 'Última modificación',
    editAction: 'Editar',
    suspendAction: 'Suspender',
    reactivateAction: 'Reactivar',
    confirmSuspendTitle: 'Suspender tenant',
    confirmSuspendMessage:
      'Los usuarios de esta empresa no podrán iniciar sesión mientras esté suspendida. ¿Continuar?',
    confirmReactivateTitle: 'Reactivar tenant',
    confirmReactivateMessage: 'La empresa recuperará el acceso de inmediato. ¿Continuar?',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    statusUpdated: 'Estado actualizado.',
  },
  login: {
    title: 'Iniciar sesión',
    subtitle: 'Ingresa tus credenciales para acceder a la plataforma.',
    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'tu.correo@ejemplo.com',
    passwordLabel: 'Contraseña',
    passwordToggleShow: 'Mostrar contraseña',
    passwordToggleHide: 'Ocultar contraseña',
    rememberMe: 'Recordarme',
    forgotPassword: '¿Olvidaste tu contraseña?',
    submit: 'Iniciar sesión',
    submitting: 'Iniciando sesión…',
    pageAriaLabel: 'Plataforma MapIt',
    panelTitle: '¿Nuevo aquí?',
    panelIntro:
      'Únete hoy y descubre todo lo que MapIt puede hacer por tu negocio. Crea tu cuenta en segundos.',
    panelCta: 'Crear cuenta',
    transitionAriaLabel: 'Transición de página',
    newBusiness: '¿Nuevo negocio?',
    requestAccess: 'Solicita acceso',
    termsPrefix: 'Al continuar, aceptas nuestros',
    termsLink: 'Términos de Servicio',
    privacyLink: 'Política de Privacidad',
    showcaseAriaLabel: 'Plataforma MapIt',
    showcaseHeadlineA: 'Mapea tu negocio, opéralo en',
    showcaseHighlight: 'Tiempo Real',
    showcaseIntro:
      'La plataforma inteligente para gestionar mesas, barras y zonas con máxima agilidad y control operativo.',
    showcaseQuote:
      '“Esta plataforma nos ha permitido coordinar los espacios y atender a los clientes con una velocidad y precisión nunca antes vista.”',
    decorativePaths: 'Curvas dinámicas decorativas',
    logoAlt: 'MapIt',
    errors: {
      emailRequired: 'Ingresa tu correo electrónico.',
      emailInvalid: 'Ingresa un correo electrónico válido.',
      passwordRequired: 'Ingresa tu contraseña.',
      missingTenantLink: 'Abre el enlace de acceso de tu empresa para continuar.',
      startFailed: 'No se pudo iniciar la sesión. Inténtalo de nuevo.',
      invalidCredentials: 'Credenciales inválidas.',
      connection: 'No pudimos conectar con el servicio. Inténtalo de nuevo.',
    },
    help: {
      password:
        'La recuperación de contraseña aún no está disponible. Contacta al administrador de tu empresa.',
      access: 'Las solicitudes de acceso aún no están disponibles desde esta pantalla.',
    },
    passwordStrength: {
      length: '8 caracteres o más',
      casing: 'Mayúsculas y minúsculas',
      digit: 'Un número',
      symbol: 'Un símbolo',
      ariaLabel: 'Fortaleza de la contraseña',
      labels: ['Vacía', 'Débil', 'Aceptable', 'Buena', 'Fuerte'],
      announcePrefix: 'Fortaleza de la contraseña:',
      commonPattern: 'Es un patrón muy común.',
      warningLabel: 'Patrón muy común',
      allRulesMet: 'Cumples todos los requisitos.',
      missingPrefix: 'Falta:',
      ruleMetSr: '(cumplido)',
      rulePendingSr: '(pendiente)',
    },
  },
  reservations: {
    customer: {
      title: 'Cliente de la reserva',
      intro: 'Busca un cliente existente o registra uno sin salir de la reserva.',
      searchLabel: 'Buscar cliente',
      searchPlaceholder: 'Nombre, correo o teléfono',
      searchButton: 'Buscar',
      searching: 'Buscando…',
      resultsLabel: 'Resultados de clientes',
      empty: 'No encontramos clientes con esos datos.',
      selectedLabel: 'Cliente seleccionado',
      selectButton: 'Seleccionar',
      changeButton: 'Cambiar cliente',
      newButton: 'Registrar cliente',
      newTitle: 'Nuevo cliente',
      fullNameLabel: 'Nombre completo',
      fullNamePlaceholder: 'Ej. Ana Pérez',
      emailLabel: 'Correo electrónico',
      emailPlaceholder: 'ana@ejemplo.com',
      phoneLabel: 'Teléfono',
      phonePlaceholder: '+591 70000000',
      saveButton: 'Guardar cliente',
      saving: 'Guardando…',
      cancelButton: 'Cancelar',
      optional: 'Opcional',
      errors: {
        search: 'No se pudo buscar clientes. Inténtalo de nuevo.',
        fullNameRequired: 'Ingresa el nombre completo del cliente.',
        emailInvalid: 'Ingresa un correo electrónico válido.',
        emailConflict: 'Ya existe un cliente con ese correo.',
        create: 'No se pudo registrar el cliente. Inténtalo de nuevo.',
      },
    },
    form: {
      eyebrow: 'Reservas internas',
      title: 'Crear reserva',
      intro: 'Selecciona el cliente, el horario y los elementos que deseas reservar.',
      detailsTitle: 'Detalles de la reserva',
      establishmentLabel: 'Establecimiento',
      establishmentPlaceholder: 'Selecciona un establecimiento',
      timezonePrefix: 'Horario mostrado en',
      startsAtLabel: 'Inicio',
      endsAtLabel: 'Fin',
      elementsTitle: 'Elementos',
      elementsIntro: 'Puedes seleccionar uno o varios elementos disponibles para reservar.',
      loading: 'Cargando opciones…',
      emptyElements: 'Este establecimiento no tiene elementos reservables.',
      selectedCount: 'seleccionados',
      submit: 'Crear reserva',
      submitting: 'Creando reserva…',
      successTitle: 'Reserva creada',
      successBody: 'La reserva se registró correctamente en estado CREATED.',
      reservationCode: 'Código de reserva',
      createAnother: 'Crear otra reserva',
      elementTypes: {
        TABLE: 'Mesa',
        BAR: 'Barra',
        SECTOR_ZONE: 'Zona',
        STAGE: 'Escenario',
        SEAT: 'Asiento',
        ROOM: 'Habitación',
      },
      errors: {
        loadEstablishments: 'No se pudieron cargar los establecimientos.',
        loadElements: 'No se pudieron cargar los elementos del establecimiento.',
        customerRequired: 'Selecciona o registra un cliente.',
        establishmentRequired: 'Selecciona un establecimiento.',
        invalidInterval: 'La fecha de fin debe ser posterior a la fecha de inicio.',
        elementsRequired: 'Selecciona al menos un elemento.',
        invalidRequest: 'Revisa el intervalo y los elementos seleccionados.',
        notFound: 'El cliente, establecimiento o algún elemento ya no está disponible.',
        conflict: 'Uno de los elementos ya está reservado durante ese horario.',
        create: 'No se pudo crear la reserva. Inténtalo de nuevo.',
      },
    },
  },
  notFound: {
    code: '404',
    title: 'Esta página no existe.',
    backHome: 'Volver al inicio',
  },
  demoItems: {
    eyebrow: 'MapIt · prueba de integración',
    title: 'Elementos de demostración',
    intro: 'CRUD completo conectado a Angular, Spring Boot y PostgreSQL.',
    newItem: 'Nuevo elemento',
    form: {
      eyebrowEdit: 'Edición',
      eyebrowNew: 'Alta',
      titleEdit: 'Editar elemento',
      titleNew: 'Crear elemento',
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Mesa terraza',
      descriptionLabel: 'Descripción',
      descriptionPlaceholder: 'Describe el elemento',
      activeLabel: 'Elemento activo',
      submit: 'Crear elemento',
      submitEdit: 'Guardar cambios',
      submitting: 'Guardando…',
      cancel: 'Cancelar',
    },
    list: {
      eyebrow: 'Consulta',
      title: 'Elementos guardados',
      loading: 'Cargando elementos…',
      empty: 'Todavía no hay elementos. Crea el primero.',
      activeBadge: 'Activo',
      inactiveBadge: 'Inactivo',
      noDescription: 'Sin descripción',
      updatedPrefix: 'Actualizado',
      edit: 'Editar',
      remove: 'Eliminar',
    },
    errors: {
      load: 'No se pudieron cargar los elementos.',
      nameRequired: 'El nombre es obligatorio.',
      save: 'No se pudo guardar el elemento.',
      remove: 'No se pudo eliminar el elemento.',
    },
  },
  establishments: {
    eyebrow: 'MapIt · administración',
    title: 'Establecimientos',
    intro: 'Los lugares físicos que tu empresa opera en MapIt.',
    new: 'Nuevo establecimiento',
    form: {
      eyebrowEdit: 'Edición',
      eyebrowNew: 'Alta',
      titleEdit: 'Editar establecimiento',
      titleNew: 'Crear establecimiento',
      nameLabel: 'Nombre',
      namePlaceholder: 'Ej. Bar Central',
      typeLabel: 'Tipo',
      typeImmutable:
        'El tipo no se puede cambiar: define qué plantillas de elemento aplican al mapa.',
      slugLabel: 'Slug',
      slugPlaceholder: 'bar-central',
      slugHint: 'Se usa en la URL pública de reserva. Minúsculas, dígitos y guiones.',
      timezoneLabel: 'Zona horaria',
      timezonePlaceholder: 'America/La_Paz',
      submit: 'Crear establecimiento',
      submitEdit: 'Guardar cambios',
      submitting: 'Guardando…',
      cancel: 'Cancelar',
      close: 'Cerrar ventana de edición',
    },
    list: {
      eyebrow: 'Consulta',
      title: 'Establecimientos registrados',
      loading: 'Cargando establecimientos…',
      empty: 'Todavía no hay establecimientos. Crea el primero.',
      updatedPrefix: 'Actualizado',
      edit: 'Editar',
      remove: 'Dar de baja',
    },
    removeConfirm: '¿Dar de baja "{name}"? Dejará de aparecer, pero no se borra el histórico.',
    errors: {
      load: 'No se pudieron cargar los establecimientos.',
      nameRequired: 'El nombre es obligatorio.',
      slugInvalid: 'El slug debe tener entre 2 y 63 caracteres: minúsculas, dígitos y guiones.',
      slugConflict: 'Ya existe un establecimiento con ese slug.',
      save: 'No se pudo guardar el establecimiento.',
      remove: 'No se pudo dar de baja el establecimiento.',
    },
  },
  /**
   * Textos de la gestión de Pisos, Sectores y Elementos espaciales (CU-05 / HU-2.03).
   * Antes vivían en `features/spaces/model/spaces.strings.ts`; ahora salen de aquí,
   * la fuente única de strings de la consola.
   */
  spaces: {
    wizard: {
      stepperAriaLabel: 'Progreso del asistente',
      stepBusiness: 'Datos del negocio',
      stepBusinessAriaLabel: 'Paso 1: Datos del negocio, completado',
      stepBusinessCurrentAriaLabel: 'Paso 1: Datos del negocio, actual',
      stepStructure: 'Estructura del espacio',
      stepStructureAriaLabel: 'Paso 2: Estructura del espacio, actual',
      stepStructurePendingAriaLabel: 'Paso 2: Estructura del espacio, pendiente',
      pageTitle: 'Estructura del espacio',
      pageDescription:
        'Define la jerarquía física de tu ubicación. Empieza creando plantas y luego añade sectores o zonas a cada una.',
      dragReorder: 'Arrastra para reordenar',
      addFloor: 'Agregar piso',
      previous: 'Anterior',
      next: 'Siguiente',
      finish: 'Finalizar',
      stepSummary: 'Resumen',
      stepSummaryAriaLabel: 'Paso 3: Resumen y confirmación, actual',
      stepSummaryPendingAriaLabel: 'Paso 3: Resumen, pendiente',
      summaryTitle: 'Resumen y confirmación',
      summaryIntro:
        'Revisa los datos ingresados antes de generar la estructura base de tu establecimiento. Podrás ajustar detalles menores dentro del editor.',
      cardBusiness: 'Detalles del negocio',
      labelCommercialName: 'Nombre comercial',
      labelSpaceType: 'Tipo de espacio',
      labelId: 'Identificador (slug)',
      cardStructure: 'Estructura espacial',
      labelFloors: 'Niveles / plantas',
      labelZones: 'Zonas definidas',
      noFloors: 'Sin plantas todavía',
      noZones: 'Sin sectores todavía',
      summaryError: 'No se pudo cargar el resumen. Inténtalo de nuevo.',
      retry: 'Reintentar',
      step1Title: 'Configuración del establecimiento',
      chooserTitle: 'Mi negocio',
      chooserIntro: 'Elige sobre qué establecimiento quieres trabajar, o crea uno nuevo.',
      yourEstablishments: 'Tus establecimientos',
      createNew: 'Crear nuevo establecimiento',
      select: 'Seleccionar',
      edit: 'Editar',
      backToList: 'Volver a la lista',
      loadFailed: 'No se pudieron cargar los establecimientos.',
      withoutAddress: 'Sin dirección',
      loadingEstablishments: 'Cargando establecimientos…',
      nameLabel: 'Nombre del establecimiento',
      namePlaceholder: 'Ej. Gran Hotel Plaza',
      typeLabel: 'Tipo de establecimiento',
      addressLabel: 'Dirección',
      addressPlaceholder: 'Calle principal 123',
      timezoneLabel: 'Zona horaria',
      timezonePlaceholder: 'Selecciona una zona',
      creating: 'Creando…',
      createFailed: 'No se pudo crear el establecimiento. Inténtalo de nuevo.',
      nameRequired: 'Ingresa el nombre del establecimiento.',
      typeRequired: 'Selecciona el tipo de establecimiento.',
      editEyebrow: 'Edición',
      editTitle: 'Editar establecimiento',
      closeDialog: 'Cerrar ventana de edición',
      editAction: 'Editar {name}',
      delete: 'Eliminar',
      deleting: 'Eliminando…',
      deleteTitle: 'Eliminar establecimiento',
      deleteWarningPre: 'Se dará de baja ',
      deleteWarningPost:
        '. Dejará de aparecer en tu lista, pero no se borra el histórico. Esta acción no se puede deshacer.',
      deleteNameLabel: 'Escribe el nombre del establecimiento para confirmar:',
      deleteFailed: 'No se pudo eliminar el establecimiento. Inténtalo de nuevo.',
      slugLabel: 'Slug',
      slugHint: 'Se usa en la URL pública de reserva. Minúsculas, dígitos y guiones.',
      slugInvalid: 'El slug debe tener entre 2 y 63 caracteres: minúsculas, dígitos y guiones.',
      editTypeImmutable: 'Tipo de establecimiento (no editable):',
      cancel: 'Cancelar',
      saveChanges: 'Guardar cambios',
      savingChanges: 'Guardando…',
      updateFailed: 'No se pudo guardar el establecimiento. Inténtalo de nuevo.',
      slugConflict: 'Ya existe un establecimiento con ese slug.',
    },
    floors: {
      title: 'Plantas',
      subtitle: 'Gestión de pisos del establecimiento',
      empty: 'No hay plantas registradas. Crea la primera.',
      loading: 'Cargando plantas…',
      createButton: 'Nueva planta',
      form: {
        createTitle: 'Crear planta',
        editTitle: 'Editar planta',
        eyebrowNew: 'Alta',
        eyebrowEdit: 'Edición',
        nameLabel: 'Nombre',
        namePlaceholder: 'Ej. Planta baja',
        nameMaxLength: 100,
        nameRequired: 'El nombre es obligatorio.',
        nameTooLong: 'El nombre no puede exceder los 100 caracteres.',
        levelLabel: 'Nivel',
        autoLevelHint:
          'El nivel se asigna solo: la primera planta es el 0 y cada una nueva sube un escalón.',
        slugHint: 'El slug se genera automáticamente a partir del nombre y no se puede editar.',
        cancelButton: 'Cancelar',
        saveButton: 'Crear planta',
        updateButton: 'Guardar cambios',
        saving: 'Guardando…',
      },
      list: {
        sectionAriaLabel: 'Pisos y sectores',
        reorderAriaLabel: 'Arrastrar para reordenar piso',
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
      addButton: 'Agregar Sector',
      form: {
        createTitle: 'Crear sector',
        editTitle: 'Editar sector',
        eyebrowNew: 'Nuevo sector',
        eyebrowEdit: 'Edición',
        nameLabel: 'Nombre',
        namePlaceholder: 'Ej. Terraza norte',
        nameMaxLength: 100,
        nameRequired: 'El nombre es obligatorio.',
        nameTooLong: 'El nombre no puede exceder los 100 caracteres.',
        slugHint: 'El slug se genera automáticamente a partir del nombre.',
        cancelButton: 'Cancelar',
        saveButton: 'Crear sector',
        updateButton: 'Guardar cambios',
        saving: 'Guardando…',
      },
      list: {
        reorderAriaLabel: 'Arrastrar para reordenar sector',
        editorButton: 'Abrir el editor de mapa de',
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
    elements: {
      loading: 'Cargando elementos…',
      types: {
        TABLE: 'Mesa',
        BAR: 'Barra',
        SECTOR_ZONE: 'Zona',
        STAGE: 'Escenario',
        SEAT: 'Butaca numerada',
        ROOM: 'Habitación',
        DECOR: 'Decoración',
      },
      states: {
        AVAILABLE: 'Disponible',
        OCCUPIED: 'Ocupado',
        RESERVED: 'Reservado',
        CLEANING: 'Limpieza',
        OUT_OF_SERVICE: 'Fuera de servicio',
      },
      loadFailed: 'No se pudieron cargar los elementos.',
    },
    /** Strings de gestión de plantillas de elemento (CU-07 / HU-4.02). */
    templates: {
      title: 'Plantillas de elementos',
      subtitle: 'Reutiliza configuraciones de tipo de elemento',
      empty: 'No hay plantillas. Crea la primera desde un elemento del mapa.',
      loading: 'Cargando plantillas…',
      createButton: 'Nueva plantilla',
      saveAsTemplateButton: 'Guardar como plantilla',
      applyTemplateButton: 'Usar plantilla',
      applyLabel: 'Aplicar plantilla al nuevo elemento',
      selectPlaceholder: 'Seleccionar plantilla…',
      noTemplatesAvailable: 'Sin plantillas disponibles para este tipo',
      form: {
        createTitle: 'Nueva plantilla',
        editTitle: 'Editar plantilla',
        eyebrowNew: 'Nueva plantilla',
        eyebrowEdit: 'Edición',
        nameLabel: 'Nombre de la plantilla',
        namePlaceholder: 'Ej. Mesa redonda 6 pax',
        nameMaxLength: 100,
        nameRequired: 'El nombre es obligatorio.',
        nameTooLong: 'El nombre no puede exceder los 100 caracteres.',
        typeLabel: 'Tipo de elemento',
        cancelButton: 'Cancelar',
        saveButton: 'Crear plantilla',
        updateButton: 'Guardar cambios',
        saving: 'Guardando…',
        deleteButton: 'Dar de baja',
        deleteConfirm: '¿Dar de baja la plantilla "{name}"? No se puede deshacer.',
      },
      list: {
        nameHeader: 'Nombre',
        typeHeader: 'Tipo',
        actionsHeader: 'Acciones',
        editButton: 'Editar',
        deleteButton: 'Eliminar',
      },
      errors: {
        loadFailed: 'No se pudieron cargar las plantillas.',
        saveFailed: 'No se pudo guardar la plantilla.',
        nameConflict: 'Ya existe una plantilla con ese nombre.',
        notFound: 'Plantilla no encontrada.',
        deleteFailed: 'No se pudo eliminar la plantilla.',
      },
      palette: {
        title: 'Estructuras y plantillas',
        loading: 'Cargando plantillas…',
        categories: {
          tablesBars: 'Mesas y barras',
          seatsRooms: 'Asientos y salas',
          zonesStages: 'Zonas y escenarios',
          decor: 'Ambientación',
        },
      },
    },
    editor: {
      back: 'Volver al resumen',
      saving: 'Guardando posición…',
      elements: 'Elementos',
      properties: 'Propiedades',
      noElements: 'Sin elementos en este sector',
      noSelection: 'Selecciona un elemento para ver sus propiedades',
      selectElement: 'Selecciona un elemento del panel lateral o del canvas',
      selectSector: 'Seleccionar sector',
      selectFloor: 'Seleccionar piso',
      type: 'Tipo',
      position: 'Posición',
      rotation: 'Rotación',
      size: 'Tamaño',
      state: 'Estado',
      capacity: 'Capacidad',
      notReservable: 'No reservable',
      openEditor: 'Finalizar y abrir editor de mapas',
      saveAsTemplate: 'Guardar como plantilla',
      templateNameLabel: 'Nombre de la plantilla',
      sectorSizeTitle: 'Tamaño del sector',
      sectorWidth: 'Ancho',
      sectorHeight: 'Alto',
      applySize: 'Aplicar tamaño',
      library: {
        hint: 'Arrastra una estructura o plantilla al lienzo, o púlsala para insertarla en el centro.',
      },
      deleteConfirm: '¿Eliminar "{label}" del sector? No se puede deshacer.',
      errors: {
        loadFailed: 'No se pudo cargar el sector.',
        saveFailed: 'No se pudo guardar la posición. Inténtalo de nuevo.',
        saveInvalid: 'Datos inválidos. Revisa el tipo y las coordenadas.',
        notFound: 'Elemento no encontrado.',
        conflict: 'El elemento fue modificado por otro usuario. Recarga la página.',
        selectElementToSave: 'Selecciona un elemento del canvas para guardarlo como plantilla.',
        templateNameRequired: 'Ingresa un nombre para la plantilla.',
        templateNameConflict: 'Ya existe una plantilla con ese nombre.',
        templateNotFound: 'La plantilla seleccionada ya no existe.',
        createFailed: 'No se pudo crear el elemento desde la plantilla.',
        createInvalid: 'Datos de la plantilla rechazados por el servidor.',
        noSectorLoaded: 'No hay sector cargado. Abre un sector primero.',
      },
    },
    /** Strings de la vista de planta del editor (HU-4.01). */
    floorEditor: {
      back: 'Volver a pisos',
      libraryTitle: 'Biblioteca de sectores',
      libraryHint: 'Arrastra un sector a la planta para duplicarlo aquí.',
      libraryEmpty: 'No hay sectores para reutilizar.',
      editSector: 'Editar sector',
      deleteElement: 'Eliminar elemento',
      saveLayout: 'Guardar planta',
      saving: 'Guardando…',
      saved: 'Planta guardada.',
      conflictReload: 'Alguien editó esta planta. Recarga para continuar.',
      reload: 'Recargar',
      errors: {
        loadFailed: 'No se pudo cargar la planta.',
        saveFailed: 'No se pudo guardar la planta. Inténtalo de nuevo.',
        conflict: 'Conflicto de concurrencia: revisa y recarga.',
      },
    },
  },
} as const;

const CATALOGS = {
  es: STRINGS_ES,
  en: STRINGS_EN,
  'ja-JP': STRINGS_JA,
} satisfies Record<'es' | 'en' | 'ja-JP', LocalizedShape<typeof STRINGS_ES>>;

export const STRINGS = createLocalizedCatalog<typeof STRINGS_ES>(CATALOGS, 'es');
export const localizeString = createLocalizedTextResolver(CATALOGS, 'es');

export type AppStrings = typeof STRINGS_ES;
