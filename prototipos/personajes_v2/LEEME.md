# Prototipo de personajes v2 (Fase 59)

Abrir `prototipo_personajes.html` en el navegador (funciona sin conexión). Arrastrar para girar, rueda para el zoom.

## Diagnóstico del sistema actual
- Motor WebGL propio: las personas se rehacen **cada fotograma** pegando primitivas (tubos y elipsoides) con color por vértice
  y luz calculada en la CPU. Sin texturas, sin sombras reales, sin antialiasing garantizado, sin esqueleto.
- Resultado inevitable: juntas visibles, ropa «pegada», miembros cilíndricos, caras de bloques. No llega a EG2.

## Tecnología elegida
- **Three.js r160 (MIT)** incrustado en el archivo: materiales físicos (rugosidad, brillo, sheen de tela, clearcoat en ojos),
  sombras suaves (PCF), antialiasing MSAA, tono ACES, iluminación de entorno.
- **Personajes esculpidos por campos de distancia (SDF)**: cada material es una suma suave de formas (cráneo, mandíbula,
  pómulos, nariz, labios, orejas; tronco, bata, chaleco…), poligonizada una sola vez (surface nets) con normales del campo,
  oclusión ambiental horneada por vértice y **esqueleto con piel** animado en la GPU.
- Ojos con blanco, iris texturizado, pupila y córnea brillante; párpados con parpadeo; cejas independientes.

## Pendiente antes de integrarlo en el juego
- Coste: ~180k triángulos y ~3,5 s de construcción por personaje (prototipo a máxima resolución). Plan: resolución
  menor + simplificación de malla, 2-3 niveles de detalle, construcción en segundo plano y caché por aspecto
  (cuerpos compartidos por departamento, caras por variante).
- Pesos de piel con 2 huesos: los hombros se estiran al levantar los brazos; pasar a 3-4 huesos con suavizado.
- Sustituir el motor 3D propio del juego por Three.js para todo el mapa (el código ya tiene un modo Three.js por CDN).
