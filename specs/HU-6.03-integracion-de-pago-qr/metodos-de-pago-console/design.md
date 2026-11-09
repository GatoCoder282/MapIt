# MapIt Console · Diseño de métodos de pago

> Ver [componentes](design-components.md) y [pautas](design-guidelines.md). El alcance de estos documentos es el módulo de pagos.

La referencia muestra una consola de alta densidad con navegación oscura, paneles claros y azul para acciones. Los valores de implementación provienen de `libs/ui-kit/DESIGN.md` y `libs/ui-kit/styles/_tokens.scss`. El azul de la imagen es más saturado que el de marca. Se conserva el azul de MapIt para esta pantalla.

Muestras del montaje original de 1536 × 1024 px, con coordenadas desde la esquina superior izquierda.

| Zona muestreada              | X, Y      | Hex en la imagen |
| ---------------------------- | --------- | ---------------- |
| Barra lateral                | 48, 340   | #010A19          |
| Botón Agregar método         | 664, 322  | #004DFE          |
| Superficie de lista          | 201, 223  | #FEFEFE          |
| Tarjeta de tipo seleccionada | 1150, 395 | #EFF3FD          |
| Punto de estado activo       | 602, 370  | #159253          |

| Rol                          | Valor de implementación                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Barra lateral                | #0B132B                                                                                                    |
| Acción y selección           | #2563EB, con texto #FFFFFF en acción rellena                                                               |
| Selección suave              | #DBEAFE                                                                                                    |
| Lienzo y panel               | #F8FAFC y #FFFFFF                                                                                          |
| Texto principal y secundario | #0F172A y #334155                                                                                          |
| Bordes y contornos de campo  | #E2E8F0 y #CBD5E1                                                                                          |
| Positivo                     | #DCFCE7 con #166534, verde de estado ya presente en Console                                                |
| Inactivo                     | #F1F5F9 con #334155                                                                                        |
| Título y subtítulo           | Manrope 20/28 y 18/24 px, peso 600                                                                         |
| Texto y etiqueta             | Inter 14/20 px, pesos 400 y 600                                                                            |
| Metadato                     | Inter 12/16 px                                                                                             |
| Rejilla y radios             | 4 px, radios 4/8/12 px según componente                                                                    |
| Elevación                    | 0 en filas y formularios, sombra de marca 0 4px 12px rgba(0, 0, 0, .05) donde se requiera separar un panel |
| Iconos                       | Lucide de 20–24 px, trazo de 2 px                                                                          |

La imagen es un montaje de tamaños distintos. Para implementar se infieren 24 px de margen interior, 12 px entre filas, 16–24 px entre secciones y controles de 44 px como mínimo. En pantallas estrechas los paneles pasan a una columna.
