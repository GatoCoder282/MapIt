# Diseño · Tres pantallas de Console

> [Componentes](design-components.md) · [Pautas](design-guidelines.md)

Iteración visual aprobada el **2026-11-04**. Especificación localizada para Auditoría, Pagos y Check-in: mantiene la identidad MapIt y el shell actual. Las medidas siguientes son aproximadas, tomadas de las referencias descritas; no son una inspección de los archivos originales ni una comparación de diferencias. El shell conserva sus dimensiones y variantes existentes (tokens actuales: sidebar 280 px y topbar 64 px); las referencias tienen medidas distintas y no justifican cambiarlo.

## Base visual

| Rol             | Token / valor vigente             | Aplicación                                                                     |
| --------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Primario        | `#2563EB`                         | Acciones principales, acentos y selección                                      |
| Selección suave | `#DBEAFE`                         | Fila activa de Auditoría                                                       |
| Lienzo / panel  | `#F8FAFC` / `#FFFFFF`             | Fondo y superficies                                                            |
| Navegación      | `#0B132B`                         | Sidebar existente                                                              |
| Texto           | `#0F172A` / `#334155` / `#64748B` | Principal / secundario / metadatos                                             |
| Tipografía      | Manrope Variable + Inter Variable | Titulares / controles y datos; familia exacta de las referencias no verificada |

Usar tokens de `libs/ui-kit/styles/_tokens.scss`, escala base 4 px, radios existentes y foco `--mapit-color-focus-ring`. Títulos de página con mayor jerarquía que el token compacto de 20/28, ajustados localmente para aproximar las referencias; sin introducir fuentes ni cambiar el sistema global. Sobrescrituras locales solo para lograr la composición aprobada.

## Auditoría empresa

En la referencia de 1672 × 941: shell aproximado de sidebar 254 px y cabecera 72 px; contenido desde x≈284. Breadcrumb cerca de (302,108), título en y≈140, introducción en y≈205 y banda de contexto local entre y≈244–292. Filtros: x≈284, y≈314, 961×105 px. Tabla: x≈284, y≈443, 963 px de ancho, filas de unos 54 px y pie anclado abajo. Detalle a la derecha: x≈1263, y≈314, 395×560 px.

La composición es filtros y tabla en columna principal, panel de detalle alineado a filtros. Columnas: fecha, acción, recurso, responsable y cambio. La selección es azul suave. Detalle: título, icono/recurso, pares de metadatos, antes/después y divulgación colapsable de IDs técnicos. El encabezado dice **Historial de empresa**; contexto activo, si se muestra, es una referencia discreta y no implica filtro. Datos tenant-scoped; no se expone parámetro de establecimiento ni búsqueda libre. Mostrar tipo e ID abreviado para recursos; el actor de sesión puede identificarse como tal. Evitar consultas N+1.

## Pagos

Referencia de 1586 × 992: shell aproximado de sidebar 289 px y cabecera 76 px; contenido x≈331–1554. Breadcrumb y≈119, título y≈158 con barra azul izquierda, introducción y≈219. Banda de contexto local x≈331, y≈273, altura 65 px. Tabs alrededor de y≈371; acción principal alineada a la derecha de la lista. Lista x≈331, y≈451, 877×478 px, cabecera cercana a 60 px y filas de ~101 px. Resumen lateral x≈1243, y≈370, 310×354 px.

Conservar contexto operativo y datos reales existentes. Lista por fila: icono, nombre destacado, descripción, estado en chip y menú; resumen a la derecha en escritorio y debajo en estrecho. No inventar ni fijar contrato/API futura.

## Check-in

Referencia de 1672 × 941: shell aproximado de sidebar 254 px y cabecera 60 px. Título en x≈315, y≈112; introducción y≈182; banda local x≈315, y≈228, 1329×84 px. Dos paneles: consulta x≈300, y≈338, 747×565 px; resultado x≈1072, y≈338, 573×565 px. Consulta: tabs x≈324, y≈362, 54 px; vídeo x≈324, y≈440, 701×288 px; controles y≈750; ayuda y≈821. Resultado con título “Reserva encontrada”, comprobante, separadores, filas de cliente/espacio/fecha/estado y acciones Registrar/Limpiar al pie.

La guía visual de escaneo usa esquinas blancas y una línea azul horizontal **estática**, superpuesta sin ocultar la lectura del vídeo. En móvil la consulta precede al resultado.
