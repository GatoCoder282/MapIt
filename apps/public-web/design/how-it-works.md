# Cómo funciona — implementación

Referencia: imagen y texto adjuntos por el usuario. Se conserva la composición y el orden de seis etapas.

Alcance: nueva feature `how-it-works`, ruta `/como-funciona`, enlaces del navbar/footer compartidos y catálogos ES/EN/JA. Producto y Negocios conservan su contenido.

Recursos disponibles: `landing/business-editor.jpg` para el editor; `landing/business-venues.jpg` para el dashboard aportado por el usuario. No hay capturas independientes de pagos y recepción disponibles en el repositorio, y la consola requiere sesión. Se representan esas secuencias mediante HTML estático, con condiciones de pago explícitas, sin importes, clientes ni pagos exitosos inventados. Los textos internos de las capturas conservan el español.

Plan: implementar estructura y estilos de la referencia, añadir navegación activa y CTA real, traducir contenido, verificar enlaces/seis etapas e idiomas, revisar capturas desktop/tablet/móvil e iterar, ejecutar pruebas, lint y compilación.

## Entrega y verificación

- Página: `/como-funciona`, HTML/Angular real con seis etapas; no se utiliza la captura de toda la landing como fondo.
- Archivos: `features/how-it-works/` (página, editor, secuencias de reserva/recepción y prueba), `app.routes.ts`, `app.ts` y sus pruebas; catálogos `core/strings*.ts`; navbar/footer y catálogos `site-strings*.ts` de `ui-kit`.
- Se reutilizan las fuentes Inter/Manrope, el navbar y el footer existentes. Los enlaces de la navegación llevan a la nueva ruta. Por indicación posterior del usuario, Cómo funciona utiliza el mismo navbar compacto que Reservas, sin accesos de sesión ni solicitud; conserva el enlace activo de su página y el selector de idioma.
- Revisión visual a 1440, 1024, 768 y 390 px, en español, inglés y japonés. Sin desbordamiento horizontal. Menú móvil y cierre al navegar comprobados.
- Iteraciones: corregidos los tamaños responsive de las imágenes, activación del navbar, iconos de cada etapa y encuadre completo del dashboard/selector.
- Cinco pruebas pasaron: página/traducciones, navbar compartido, rutas y catálogos. Typecheck, ESLint y compilación de producción correctos. Persisten avisos de tamaño y dependencias CommonJS; no se ejecutó la suite completa del monorepo.
- Captura desktop final: `C:/Users/matia/.codex/visualizations/2026/11/05/01a1ad19-dd42-71c1-9f16-be0b13aab5ae/how-final-desktop.png`. Tablet/móvil: `how-reviewed-1024.png`, `how-reviewed-768.png`, `how-reviewed-390.png` en el mismo directorio.
- Diferencias: las vistas de configuración, reglas, reserva y recepción son composiciones HTML estáticas que explican el flujo, sin registrar datos ni simular pagos. El dashboard conserva el selector de establecimientos de la imagen aportada; no es idéntico al gráfico del diseño. Los textos internos del editor y dashboard están integrados en sus imágenes y conservan el español.
- Se reinició únicamente el proceso Angular que ocupaba 4300 para cargar la ruta nueva. La consola de 4200 no se modificó.
