---

name: ola
description: Hace una ola de Tuerce de punta a punta. Reparte sus tickets en paralelo, junta todo en la rama `ola-N` y entrega una vista previa, capturas y el pull request. Usala cuando Luis diga «haz la ola N», «trabaja en la ola N» o «/ola N».
---

# Ola

Una ola es un hito de GitHub («Ola N · …»). Cada issue del hito es un ticket de `docs/TICKETS.md`. Terminás cuando hay
un pull request de `ola-N` a `main` con la revisión automática en verde, la vista previa y las capturas. **Nunca unas
a `main` sin «full send».**

## 1. Leer la ola

```bash
gh api repos/:owner/:repo/milestones --jq '.[] | select(.title | startswith("Ola N ")) | {number, title, description}'
gh issue list --milestone "<título exacto>" --state open --json number,title,body,labels
```

La descripción del hito dice **qué va a ver Luis** al final: esa es la meta de la ola. Si un ticket tiene la etiqueta
«necesita tus cuentas», lo que pida cuentas se hace al final y con Luis (paso 5).

## 2. Repartir

1. `git fetch origin && git switch -c ola-N origin/main` (o retomá `ola-N` si ya existe) y subila.
2. Ordená los tickets por «Depende de». Los que no dependen de otro de la misma ola van en paralelo.
3. Un agente por ticket, cada uno en su propia copia (worktree) basada en `ola-N`, con este encargo:
   - el texto del issue («Listo cuando» es la condición de terminado),
   - leer `AGENTS.md` antes de empezar,
   - terminar con `pnpm check && pnpm test && pnpm build` en verde y, si cambia algo visible, `pnpm capturas`,
   - un commit por ticket con `TU-XX` en el título y `Closes #<issue>` en el cuerpo,
   - no tocar archivos de otros tickets; si hace falta, avisar en vez de hacerlo.
4. Tickets que tocan los mismos archivos (por ejemplo `package.json`): en serie, no en paralelo.

## 3. Juntar

1. Traé cada rama terminada a `ola-N` (rebase o merge, sin aplastar los commits de cada ticket).
2. En `ola-N`: `pnpm install && pnpm check && pnpm test && pnpm build && pnpm capturas`. Arreglá lo que se rompa
   al juntar antes de seguir.
3. Mirá las imágenes de `capturas/`. Si algo no se ve como «Vas a ver», corregilo dentro de la ola.

## 4. Entregar

1. `git push origin ola-N`.
2. Pull request `ola-N` → `main` con la plantilla (`.github/pull_request_template.md`). Título: `Ola N · <nombre>`.
   En «Qué cambió»: lo que Luis va a ver, en palabras simples, y `Closes #…` de cada ticket.
3. La revisión automática (`.github/workflows/revision.yml`) corre `pnpm check`, `pnpm test` y `pnpm build`,
   publica la vista previa en Cloudflare (`pr-N-tuerce.luiscf1226.workers.dev`) y comenta el PR con las capturas
   y el video. Esperá a que esté en verde y arreglá lo que falle.
4. Que un agente que no escribió el código revise el PR antes de dárselo a Luis.

## 5. Cuentas

Lo que necesita cuentas (Clerk, Convex, Cloudflare, secretos de GitHub) se hace con Luis presente. Si el navegador
de vista previa ya tiene la sesión abierta, hacelo ahí; si no, pedile que entre. Las llaves nunca van al código:
ver `docs/ENTORNOS.md`.

## 6. Cerrar

Solo con «full send»: unir el PR a `main`. Los issues se cierran solos por los `Closes #…`; cerrá el hito.
Si Luis pide cambios, se hacen en la misma rama `ola-N` y el mismo PR.
