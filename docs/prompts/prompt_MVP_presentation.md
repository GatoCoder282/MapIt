    # Prompt: MVP de Presentación — MapIt

**Uso:** pegar este prompt completo a Claude Code, ejecutándolo desde la carpeta `TS1` (que contiene tanto `mapit/` como `MapItMVP/`).

---

## Prompt

Vas a trabajar exclusivamente en la carpeta `MapItMVP/` (hermana de `mapit/`). No toques ni modifiques nada dentro de `mapit/` — esa carpeta es el desarrollo principal del proyecto y no debe verse afectada. Si `MapItMVP/` no existe o está vacía, inicialízala ahí mismo.

### Contexto del proyecto

MapIt es un sistema que convierte el espacio físico de un negocio (restaurante, discoteca) en un mapa digital interactivo, donde cada mesa o zona tiene un estado en tiempo real (disponible, ocupada, reservada) y está conectada a clientes y reservas. El desarrollo real usa Angular + Spring Boot + WebSockets, pero **eso NO es lo que se construye ahora**.

### Objetivo de esta tarea

Necesito una **presentación visual tipo MVP** para mostrar el martes en clase. NO es el desarrollo real del sistema, es una demo de producto: rápida, simple, sin backend, sin base de datos, sin autenticación real. El objetivo es que cualquiera que la vea entienda de inmediato "así se vería y así funcionaría MapIt", con interacción real en el navegador (no son solo imágenes estáticas).

Prioriza velocidad de desarrollo y qué tan bien se ve/siente por encima de arquitectura o buenas prácticas de ingeniería. Todo el estado puede vivir en memoria del lado del cliente (no hace falta persistencia real).

### Qué construir

Una single-page app estática, deployable directamente en Netlify (sin backend, sin build steps complejos — HTML/CSS/JS plano, o si usas un framework que sea con un build simple tipo Vite).

Pantallas/flujo mínimo:

1. **Landing / intro breve**: nombre "MapIt", una frase de propuesta de valor, y un botón para entrar a la demo.
2. **Selector de establecimiento demo**: dos tarjetas — "Restaurante" y "Discoteca" — al hacer clic se carga el mapa de ese tipo de negocio.
3. **Vista de mapa interactivo** (la pieza central de la demo):
   - Un piso con varias mesas/zonas distribuidas visualmente (usar posiciones fijas está bien, no hace falta editor de arrastrar-y-soltar funcional, aunque si es fácil de lograr con poco esfuerzo, mejor).
   - Cada mesa/zona debe verse con color según estado: verde (disponible), rojo (ocupada), amarillo (reservada).
   - Al hacer clic en una mesa, mostrar un panel/modal con sus datos (capacidad, cliente si está ocupada, hora, etc. — datos de ejemplo hardcodeados).
   - Debe poder **cambiarse el estado de una mesa** desde ese panel (ej. botón "Ocupar mesa" / "Liberar mesa") y que el color cambie en vivo en el mapa. Esto es lo que demuestra la idea de "operación en tiempo real" (no hace falta WebSocket real, solo que el cambio se sienta instantáneo en el frontend).
   - Para el caso Discoteca, incluir al menos una "Zona VIP" además de mesas normales, para mostrar que el motor es genérico.
4. **Pequeño panel de resumen/dashboard** (puede ser una barra superior o un costado): número de mesas ocupadas/disponibles, actualizándose en vivo según las interacciones.

### Estilo visual

- Diseño moderno, oscuro o con buen contraste, que se vea a nivel "producto real" y no a nivel "prototipo de clase" — esto es lo que más va a pesar en la impresión del jurado.
- Usa la skill de frontend-design disponible para las decisiones de tipografía, paleta y layout, evitando defaults genéricos de Bootstrap/Tailwind sin personalizar.
- Transiciones/animaciones simples al cambiar estado de una mesa (ej. transición de color) para que se sienta vivo.
- Debe verse bien en desktop; no es prioritario el responsive para mobile, pero que no se rompa.

### Restricciones técnicas

- Sin backend, sin base de datos, sin llamadas a APIs externas.
- Todo el estado en memoria (variables JS / state del framework que uses).
- Debe quedar listo para deploy directo en Netlify: incluye instrucciones breves de build/deploy en un `README.md` dentro de `MapItMVP/` (comando de build si aplica, carpeta de salida, y que basta con arrastrar la carpeta a Netlify o conectar el repo).
- No uses librerías de canvas complejas (Konva.js, Fabric.js) — no vale la pena la inversión para esta demo; con `div`s posicionados absolutamente o SVG simple alcanza y sobra.

### Entregable

Al terminar, resume brevemente qué construiste y confirma que quedó en `MapItMVP/`, sin haber tocado nada de `mapit/`.