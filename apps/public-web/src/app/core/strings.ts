/**
 * Catálogo central de textos visibles de la web pública (español).
 *
 * Misma convención que en la consola (`apps/console/src/app/core/strings.ts`):
 * objeto tipado `as const`; una errata en la clave no compila. Sin framework
 * i18n: una sola lengua por ahora.
 *
 * NOTA: los datos del listado de `reservas` (`establishments.data.ts`) son
 * contenido mock de negocio, no chrome de UI: se conservan ahí a propósito.
 */

/** CTAs compartidos entre secciones. */
const SHARED = {
  requestAccess: 'Solicitar acceso',
  seeHowItWorks: 'Ver cómo funciona',
} as const;

export const STRINGS = {
  shared: SHARED,

  landing: {
    hero: {
      badge: 'Gestión espacial en tiempo real',
      titleA: 'Mapea tu negocio.',
      titleB: 'Opéralo en tiempo real.',
      description:
        'Convierte tu espacio físico en un mapa digital interactivo para gestionar disponibilidad, reservas y operación desde un solo lugar.',
      primaryCta: SHARED.requestAccess,
      secondaryCta: SHARED.seeHowItWorks,
      features: ['En tiempo real', 'Multi-negocio', 'Fácil de usar'],
      categoryAria: 'Categoría',
      visualAria: 'Vista previa de la aplicación MapIt',
      visualAlt: 'Vista previa de la aplicación MapIt',
    },
    problem: {
      badge: 'El problema',
      titleA: 'Tu negocio cambia.',
      titleB: 'Tu información también debería hacerlo.',
      description:
        'Hoy en día, la gestión de espacios depende de mensajes, hojas de cálculo, pizarras y llamadas. Esto genera errores, retrasos y una visión limitada de lo que realmente pasa en tu negocio.',
      visualAlt: 'Comparativa: WhatsApp, Hojas de cálculo, Pizarras vs MapIt',
      cards: [
        {
          title: 'WhatsApp',
          description: 'Información repartida entre mensajes.',
        },
        {
          title: 'Hojas de cálculo',
          description: 'Reservas y disponibilidad sin contexto espacial.',
        },
        {
          title: 'Pizarras',
          description: 'Estados que dependen de actualización manual.',
        },
        {
          title: 'Mapit',
          description: 'Un único mapa operativo conectado con reservas, personas y estados.',
        },
      ],
    },
    product: {
      badge: 'El corazón de MapIt',
      titleA: 'El espacio se convierte',
      titleB: 'en información.',
      tagline: 'No es un plano. Es una herramienta de operación.',
      description:
        'Visualiza, gestiona y actúa sobre cada mesa, habitación, butaca o sector en tiempo real. El estado de cada espacio se actualiza instantáneamente para todo tu equipo en menos de 2 segundos.',
      cta: SHARED.seeHowItWorks,
      visualAlt: 'Mapa de mesas interactivo de MapIt en tiempo real',
    },
    editor: {
      aria: 'Editor visual de MapIt',
      titleA: 'Diseña el espacio como',
      titleB: 'realmente existe.',
      subtitle: 'Arrastra, mueve, rota y redimensiona elementos de forma simple y visual.',
      visualAlt: 'Editor visual de MapIt: Diseña el espacio como realmente existe',
    },
    businessTypes: {
      badge: 'Un solo sistema, distintos negocios',
      title: 'Un motor, distintos negocios.',
      subtitle:
        'MapIt se adapta a las necesidades de cada tipo de negocio, con la misma potencia y facilidad de uso.',
      visualAlt:
        'MapIt adaptado a diferentes tipos de negocios: Restaurantes, Discotecas, Salones de eventos y Hoteles',
    },
    booking: {
      aria: 'Reservas públicas: Tu cliente reserva sin llamar',
      visualAlt: 'Reservas públicas de MapIt: Tu cliente reserva sin llamar',
    },
    dashboard: {
      badge: 'Dashboard',
      title: 'Ve tu negocio de un vistazo.',
      subtitle: 'Toma decisiones más rápidas con información clara y actualizada.',
      visualAlt: 'Dashboard de MapIt con métricas de ocupación y reservas en tiempo real',
    },
    realtime: {
      badge: 'Todos conectados',
      title: 'Todos ven el mismo estado.',
      subtitle: 'Recepción, administrador y operador, en todos los dispositivos y al mismo tiempo.',
      devices: ['Recepción', 'Administrador', 'Operador'] as const,
      footer: 'Se actualiza en todos los dispositivos en tiempo real.',
    },
    ctaFinal: {
      title: 'Convierte tu espacio en una operación inteligente.',
      description: 'MapIt conecta tu espacio físico, reservas y operación en tiempo real.',
      cta: SHARED.requestAccess,
    },
  },

  activation: {
    title: 'Activa tu cuenta',
    intro: 'Define tu contraseña para comenzar a usar MapIt con tu organización.',
    emailLabel: 'Correo',
    passwordLabel: 'Contraseña',
    passwordConfirmLabel: 'Confirma tu contraseña',
    submit: 'Activar cuenta',
    submitting: 'Activando…',
    toggleShow: 'Mostrar contraseña',
    toggleHide: 'Ocultar contraseña',
    missingLink: 'El enlace está incompleto: pide un nuevo correo de invitación.',
    passwordRequired: 'Ingresa una contraseña.',
    passwordMismatch: 'Las contraseñas no coinciden.',
    passwordWeak: 'Usa al menos 8 caracteres, con mayúsculas, minúsculas, un número y un símbolo.',
    success: 'Tu cuenta quedó activada. Ya puedes iniciar sesión.',
    goToLogin: 'Ir al inicio de sesión',
    backLanding: 'Volver al inicio',
    errors: {
      invalid: 'El enlace de activación no es válido o ya fue usado.',
      expired: 'El enlace caducó (válido por 24 horas). Pide uno nuevo.',
      duplicate: 'Ya existe una cuenta con este correo.',
      generic: 'No se pudo activar la cuenta. Inténtalo de nuevo.',
    },
  },
  reservas: {
    hero: {
      badge: 'Reservas',
      titleA: 'Encuentra el lugar perfecto y',
      titleB: 'reserva tu espacio.',
      subtitle:
        'Explora una variedad de establecimientos, descubre sus espacios disponibles y asegura tu lugar en pocos clics.',
      searchPlaceholder: 'Buscar establecimiento, ciudad o tipo de negocio…',
      searchAria: 'Buscar establecimiento, ciudad o tipo de negocio',
      searchSubmitAria: 'Buscar',
      filterAria: 'Filtrar por categoría',
      categories: ['Todos', 'Restaurantes', 'Discotecas', 'Eventos', 'Hoteles'] as const,
    },
    categories: {
      title: 'Explora nuestros establecimientos',
      subtitle:
        'Los mejores lugares, en un solo lugar. Descubre, reserva y vive experiencias únicas.',
      items: [
        { title: 'Restaurantes', subtitle: 'Gastronomía y buen ambiente' },
        { title: 'Discotecas', subtitle: 'Música, tragos y diversión' },
        { title: 'Eventos', subtitle: 'Celebraciones y momentos especiales' },
        { title: 'Hoteles', subtitle: 'Descanso y comodidad' },
      ] as const,
    },
    popular: {
      title: 'Los más populares',
      seeAll: 'Ver todos los establecimientos',
      reviewsSuffix: 'reseñas',
      amenitiesAriaPrefix: 'Amenidades de',
      viewVenue: 'Consultar disponibilidad',
    },
    steps: {
      title: 'Reservar es muy fácil',
      subtitle: 'En solo unos pasos estarás disfrutando de tu experiencia.',
      items: [
        { title: 'Busca tu lugar', description: 'Explora los establecimientos disponibles.' },
        {
          title: 'Selecciona espacio',
          description: 'Elige la fecha, hora y el espacio que prefieres.',
        },
        { title: 'Completa tu reserva', description: 'Ingresa tus datos y confirma la reserva.' },
        { title: 'Paga el anticipo', description: 'Realiza el pago de forma segura por QR.' },
        { title: '¡Listo!', description: 'Recibe la confirmación en tu correo y disfruta.' },
      ] as const,
      confirm: {
        title: 'Reserva confirmada',
        meta: 'Restaurante La Bahía · 24 abr 2026 · 20:00',
        noteA: 'Tu entrada está confirmada.',
        noteB: '¡Disfruta la experiencia!',
        detail: 'Ver detalles',
        qrLabel: 'Pago de anticipo por QR',
      },
    },
    cta: {
      title: 'Explora, descubre y reserva.',
      subtitle: 'Tu próxima experiencia está a un clic de distancia.',
      action: 'Explorar establecimientos',
    },
  },
  availability: {
    title: 'Consulta disponibilidad',
    subtitle: 'Elige una fecha para ver qué espacios puedes reservar.',
    selectedVenue: 'Establecimiento',
    dateLabel: 'Fecha de reserva',
    search: 'Buscar espacios',
    searching: 'Buscando espacios…',
    resultsTitle: 'Espacios disponibles',
    resultDatePrefix: 'Disponibles para',
    elementCode: 'Código',
    empty: 'No hay espacios disponibles para esta fecha. Prueba con otro día.',
    error: 'No pudimos consultar la disponibilidad. Revisa tu conexión e inténtalo de nuevo.',
    retry: 'Volver a intentar',
    back: 'Volver a establecimientos',
    book: 'Reservar',
    types: {
      TABLE: 'Mesa',
      BAR: 'Barra',
      SECTOR_ZONE: 'Zona',
      STAGE: 'Escenario',
      SEAT: 'Butaca',
      ROOM: 'Habitación',
    },
  },
  booking: {
    title: 'Completa tu reserva',
    subtitle: 'Revisa la fecha y tus datos para confirmar el espacio.',
    selectedSpace: 'Espacio seleccionado',
    elementCode: 'Código',
    dateLabel: 'Fecha de reserva',
    startTimeLabel: 'Hora de inicio',
    endTimeLabel: 'Hora de fin',
    customerTitle: 'Tus datos',
    fullNameLabel: 'Nombre completo',
    emailLabel: 'Correo electrónico',
    phoneLabel: 'Teléfono (opcional)',
    submit: 'Confirmar reserva',
    submitting: 'Confirmando reserva…',
    back: 'Volver a disponibilidad',
    successTitle: 'Reserva confirmada',
    successMessage: 'Guarda estos datos para presentarlos al llegar al establecimiento.',
    reservationCode: 'Código de reserva',
    when: 'Fecha y hora',
    timezone: 'Zona horaria',
    newReservation: 'Hacer otra reserva',
    viewHistory: 'Ver mis reservas',
    fieldRequired: 'Completa este campo.',
    dateInvalid: 'Elige una fecha válida.',
    timeInvalid: 'La hora de fin debe ser posterior a la de inicio.',
    fullNameInvalid: 'Ingresa tu nombre completo.',
    emailInvalid: 'Ingresa un correo válido.',
    phoneInvalid: 'El teléfono no puede superar los 32 caracteres.',
    errors: {
      unavailable:
        'El espacio ya no está disponible para ese horario. Vuelve a consultar la disponibilidad.',
      notFound: 'El establecimiento o el espacio ya no están disponibles.',
      invalid: 'Revisa los datos de la reserva e inténtalo de nuevo.',
      generic: 'No pudimos confirmar la reserva. Revisa tu conexión e inténtalo de nuevo.',
    },
  },
  myReservations: {
    title: 'Mis reservas',
    intro: 'Recibe un enlace en tu correo para consultar tus reservas. No necesitas una cuenta.',
    back: 'Volver a establecimientos',
    emailLabel: 'Correo electrónico',
    invalidEmail: 'Ingresa un correo válido.',
    request: 'Enviar enlace',
    requesting: 'Enviando solicitud…',
    sent: 'Si el correo está registrado, recibirás un enlace para acceder a tus reservas.',
    exchanging: 'Verificando el enlace…',
    logout: 'Salir de mis reservas',
    upcoming: 'Próximas',
    past: 'Pasadas',
    upcomingEmpty: 'Todavía no hay reservas próximas.',
    pastEmpty: 'Todavía no hay reservas pasadas.',
    loading: 'Cargando tus reservas…',
    loadMore: 'Cargar más',
    retry: 'Volver a intentar',
    dates: 'Horario',
    spaces: 'Espacios reservados',
    spaceCode: 'Código de espacio',
    timezone: 'Zona horaria',
    status: 'Estado',
    statusLabels: {
      CREATED: 'Creada',
      CONFIRMED: 'Confirmada',
      ACTIVE: 'En curso',
      RELEASED: 'Finalizada',
      CANCELLED: 'Cancelada',
    },
    errors: {
      request: 'No pudimos solicitar el enlace. Revisa tu conexión e inténtalo de nuevo.',
      rateLimit: 'Hay demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
      linkInvalid: 'El enlace no es válido, ya fue usado o caducó. Solicita uno nuevo.',
      expired: 'Tu acceso caducó. Solicita un nuevo enlace para consultar tus reservas.',
      revoke:
        'Se borraron tus datos de este dispositivo, pero no pudimos confirmar el cierre remoto. El acceso caducará automáticamente.',
      history: 'No pudimos cargar esta sección. Revisa tu conexión e inténtalo de nuevo.',
    },
  },
} as const;

export type PublicStrings = typeof STRINGS;
