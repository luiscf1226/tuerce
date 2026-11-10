# juego

El juego. Ya están `src/motor/` (bucle de paso fijo y Rapier), `src/escenas/` (cada una se abre con
`?escena=<nombre>`) y `src/cuenta/` (entrar con Clerk). Módulos previstos (ver `docs/plan.html`, sección «Arquitectura»):

- `src/muneco/` ragdoll activo: huesos con articulaciones de Rapier que persiguen una pose; agarrar, trepar, cargar
- `src/niveles/` carga de escenas glTF, piezas (palanca, plancha, polea, balsa…) y guion de cada nivel
- `src/red/` conexión directa entre los dos (WebRTC), repetidor de respaldo y fotos de físicas
- `src/camara/` cámara que encuadra a los dos y parte la pantalla si se separan
- `src/ui/` menús, invitar con código, gestos y frases
