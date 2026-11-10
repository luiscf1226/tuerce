# convex

`schema.ts` es el modelo de datos completo. `_generated/` se regenera con `pnpm convex:dev` y se sube al repo.

| Archivo           | Qué hace                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `usuarios.ts`     | `yo`, `guardarme`: el usuario nace con el primer token de Clerk.                                |
| `invitaciones.ts` | `crearInvitacion`, `aceptarInvitacion`, `estadoInvitacion`: código de 5 letras que junta a dos. |
| `parejas.ts`      | `misParejas`: con quién jugué, la más reciente primero.                                         |
| `salas.ts`        | `pedirPase`: pase firmado de 2 minutos para la sala (usa `workers/sala/src/pase.ts`).           |
| `cuenta.ts`       | Ayudas compartidas: quién llama, ordenar `a < b`, crear o reusar la pareja.                     |

Pruebas: `*.test.ts` con convex-test (un Convex en memoria); corren con `pnpm test:convex` y dentro de `pnpm test`.
Convex no sube los archivos con dos puntos en el nombre (`*.test.ts`, `test.setup.ts`, `vitest.config.ts`).

Falta escribir el resto de las funciones que lista `docs/plan.html` (sección «Datos»): `buscarPareja`,
`anotarPuntoDeControl`, etc.
