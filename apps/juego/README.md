# juego

El juego. Ya están `src/motor/` (bucle de paso fijo y Rapier), `src/escenas/` (cada una se abre con
`?escena=<nombre>`), `src/cuenta/` (entrar con Clerk) y `src/red/` (conexión directa entre los dos con la sala de repetidor de
respaldo; se mira con `?escena=red`, ver `src/escenas/red.ts`). Módulos previstos (ver `docs/plan.html`, sección «Arquitectura»):

- `src/muneco/` ragdoll activo: huesos con articulaciones de Rapier que persiguen una pose; agarrar, trepar, cargar
- `src/niveles/` carga de escenas glTF, piezas (palanca, plancha, polea, balsa…) y guion de cada nivel
- `src/camara/` cámara que encuadra a los dos y parte la pantalla si se separan
- `src/ui/` menús, invitar con código, gestos y frases
