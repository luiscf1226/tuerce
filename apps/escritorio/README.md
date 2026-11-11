# Tuerce para escritorio

El mismo juego de `apps/juego`, empacado con [Tauri v2](https://v2.tauri.app) para Steam. No es una copia: Tauri toma
`apps/juego/dist` tal cual y lo abre en el webview del sistema (WebView2 en Windows, WKWebView en macOS, WebKitGTK en
Linux), en pantalla completa y sin barras del navegador.

| Archivo                                      | Qué es                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `src-tauri/tauri.conf.json`                  | Nombre, ventana, ícono, de dónde sale el juego y qué paquetes se arman. |
| `src-tauri/src/lib.rs`                       | Los comandos `salir` y `alternar_pantalla_completa`, y WebRTC en Linux. |
| `src-tauri/icons/icono.svg`                  | El ícono. Los PNG, `.ico` e `.icns` salen de acá con `pnpm iconos`.     |
| `src-tauri/Info.plist`, `Entitlements.plist` | macOS: el permiso del micrófono (la voz en línea).                      |
| `steam/plantillas/`                          | `app_build` y un `depot_build` por sistema, con la AppID por llenar.    |
| `scripts/armar-steam.mjs`                    | Arma `steam/contenido/<sistema>/` y los VDF con la AppID puesta.        |
| `../../.github/workflows/escritorio.yml`     | Empaca en Linux, Windows y macOS a mano (Actions → escritorio → Run).   |

En el juego, lo único propio del escritorio está en `apps/juego/src/ui/escritorio.ts`: F11 alterna la pantalla
completa, el menú de inicio suma **Salir** y el clic derecho no abre el menú del webview. Se activa solo dentro de
Tauri (`isTauri()`); en el navegador no cambia nada.

## Comandos

```bash
pnpm escritorio:dev       # abre la ventana con el juego en vivo (Vite en :5179, se recarga al guardar)
pnpm escritorio:empacar   # construye el juego y lo empaca para este sistema (src-tauri/target/release/bundle/)
pnpm escritorio:steam     # copia lo empacado a steam/contenido/<sistema>/ (más abajo: --appid)
```

`pnpm build`, `pnpm check` y `pnpm test` no tocan Rust: este paquete no tiene `build` y la revisión automática sigue
igual. El juego empacado lleva las llaves públicas de `apps/juego/.env.local` (o de las variables `VITE_*` del
entorno), igual que `pnpm build`.

### Lo que hace falta para empacar

- **Rust** (estable): `mise use -g rust@stable`.
- **Linux**: `webkit2gtk-4.1`, `librsvg`, GStreamer (el AppImage lo mete adentro) y `patchelf` (sin sudo:
  `mise use -g github:NixOS/patchelf`). En Arch, el `strip` que trae linuxdeploy no entiende las bibliotecas nuevas
  y el AppImage falla con «failed to run linuxdeploy»: empacá con `NO_STRIP=true pnpm escritorio:empacar`.
- **Windows**: las herramientas de C++ de Visual Studio (Build Tools) y WebView2 (viene con Windows 10 y 11).
- **macOS**: Xcode Command Line Tools (`xcode-select --install`).

Tauri no empaca de un sistema a otro: cada uno se arma en su propia máquina. Para los tres a la vez está el workflow
`escritorio` de GitHub Actions.

## Qué anda en cada sistema

Probado de verdad solo en Linux (Arch, WebKitGTK 2.54, 11 de noviembre de 2026): el AppImage abierto como lo lanza
Steam (`steam/contenido/linux/AppRun`) y una página de sonda dentro de la misma ventana. Windows y macOS quedan sin
probar: lo de abajo es lo que dicen sus webviews, hay que confirmarlo en una máquina de cada uno.

|                           | Linux (WebKitGTK)                                                                                  | Windows (WebView2, Chromium)             | macOS (WKWebView)                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------- |
| El juego                  | ✅ Probado: carga, 60 pasos por segundo, menú, Salir                                               | Debería: Chromium, como la web           | Debería (WebGL 2 desde macOS 12)                         |
| Pantalla completa (F11)   | ✅ Probado (el comando, desde el juego)                                                            | Debería                                  | Debería                                                  |
| Mandos (Gamepad API)      | ✅ Está (`getGamepads`, con libmanette); sin mando a mano para apretar                             | ✅ Chromium la trae                      | Debería: WebKit la trae con GameController               |
| En línea directo (WebRTC) | ❌ No hay `RTCPeerConnection`: el WebKitGTK de Arch y de Ubuntu viene compilado sin WebRTC         | ✅                                       | Debería (macOS 11+)                                      |
| En línea por la sala      | ✅ Mismo WebSocket que la web                                                                      | ✅                                       | ✅                                                       |
| Micrófono (voz)           | ✅ Probado `getUserMedia`, pero sin WebRTC no hay voz                                              | ✅ (WebView2 pide permiso)               | Debería: `Info.plist` y `Entitlements.plist` ya lo piden |
| Clerk (cuenta)            | ⚠️ Clerk de desarrollo responde desde `tauri://localhost` (200); falta probar el formulario entero | ⚠️ Igual, desde `http://tauri.localhost` | ⚠️ Igual, desde `tauri://localhost`                      |

**WebRTC en Linux.** Sin `RTCPeerConnection`, la partida en línea igual anda: `src/red/` espera 5 segundos lo directo,
cae al repetidor de la sala y sigue por ahí (con un poco más de demora). La voz no anda. Arreglos posibles, de menor a
mayor: que `src/red/` salte derecho al repetidor cuando `typeof RTCPeerConnection === "undefined"` (es de otro
ticket); o un respaldo nativo en Rust (`webrtc-rs`) que hable con el juego por comandos de Tauri; o meter en el
AppImage un WebKitGTK compilado con `ENABLE_WEB_RTC`. `src-tauri/src/lib.rs` ya prende el ajuste por si el WebKitGTK
lo trae.

**Mandos.** Si en algún sistema la Gamepad API no ve los mandos (por ejemplo dentro del contenedor de Steam), el
respaldo es un plugin de Rust con [`gilrs`](https://crates.io/crates/gilrs): lee los mandos en Rust y los manda al
juego con la misma forma que `navigator.getGamepads()` (mapeo estándar: `buttons[i].pressed`, `axes[0..3]`), así
`src/entrada/mandos.ts` no cambia; solo se le pasa esa fuente en lugar de `navigator.getGamepads`. En la Steam Deck,
Steam Input le presenta el mando al juego como un mando de Xbox: en Steamworks poné la configuración de Steam Input
por defecto en «Gamepad» para que no lo convierta en teclado y mouse.

**Clerk.** Con la instancia de desarrollo, la entrada por correo debería andar (son llamadas a la API de Clerk, que
responde desde el origen de Tauri). Con Google hay dos problemas: Google bloquea su inicio de sesión dentro de webviews
incrustados, y la vuelta del OAuth tendría que llegar a `tauri://localhost`. La instancia de producción de Clerk pide un
dominio propio y no acepta ese origen. El camino es abrir la entrada en el navegador del sistema y volver al juego con
un enlace propio (`tauri-plugin-deep-link`, por ejemplo `tuerce://entrar`); queda pendiente.

## Subir a Steam

Steam pide una cuenta de Steamworks (100 USD por juego) y la app creada. Lo que hacés vos con tu cuenta:

1. **Crear la app** en [partner.steamgames.com](https://partner.steamgames.com) → «Crear nueva app». Steam te da la
   **AppID** (por ejemplo `1234560`).
2. **Crear un depósito por sistema** en Steamworks → _SteamPipe_ → _Depósitos_. Steam crea el primero con AppID+1;
   agregá dos más. Marcá en cada uno su sistema operativo (Windows, macOS, Linux + SteamOS). Si los números no son
   AppID+1, +2 y +3 (Windows, macOS, Linux), pasalos con `--depots`.
3. **Opciones de lanzamiento** (_Instalación_ → _General_), una por sistema:

   | Sistema | Ejecutable   | Sistema operativo |
   | ------- | ------------ | ----------------- |
   | Windows | `tuerce.exe` | Windows           |
   | macOS   | `Tuerce.app` | macOS             |
   | Linux   | `AppRun`     | Linux + SteamOS   |

   En Linux dejá el «Steam Linux Runtime» sin elegir: el AppImage abierto ya trae WebKitGTK y GStreamer.
4. **Armar las carpetas**. Con el workflow: Actions → escritorio → Run workflow (entorno `produccion`), bajá los
   artefactos `steam-linux`, `steam-windows` y `steam-macos` y abrilos en `steam/contenido/`:

   ```bash
   cd apps/escritorio/steam/contenido
   for s in linux windows macos; do unzip -o ~/Descargas/steam-$s.zip && tar -xf steam-$s.tar && rm steam-$s.tar; done
   ```

   O en cada máquina: `pnpm escritorio:empacar && pnpm escritorio:steam`.
5. **Escribir los VDF con la AppID** y subir con [steamcmd](https://developer.valvesoftware.com/wiki/SteamCMD):

   ```bash
   cd apps/escritorio
   node scripts/armar-steam.mjs --solo-vdf --appid 1234560        # o --depots windows=…,macos=…,linux=…
   steamcmd +login <tu-usuario> +run_app_build "$PWD/steam/listo/app_build.vdf" +quit
   ```

   La primera vez steamcmd pide el código de Steam Guard. Las plantillas están en `steam/plantillas/`; las copias con
   los números, en `steam/listo/` (ignorada por git, igual que `contenido/` y `salida/`).
6. **Publicar la build**: Steamworks → _SteamPipe_ → _Builds_ → elegí la build → «Set build live» en la rama `default`
   (o en una rama beta con contraseña para probar antes con amigos).

## Pendiente

- **Steamworks**: logros, overlay de Steam, invitar amigos desde Steam, nube. Necesita la AppID y un plugin de Rust
  (por ejemplo `steamworks-rs`) que hable con el juego por comandos de Tauri. El overlay de Steam no se dibuja sobre
  webviews sin ayuda (WebView2 y WKWebView no usan el mismo dibujo que hookea Steam): hay que probarlo con la AppID.
- **Firmar**: Windows (certificado de código, si no SmartScreen avisa al abrir fuera de Steam) y macOS (cuenta de
  Apple Developer, firma y notarización; sin eso Gatekeeper bloquea `Tuerce.app`).
- **macOS universal** (Intel y Apple Silicon): `tauri build --target universal-apple-darwin`; hoy el workflow arma
  solo para la Mac del runner (Apple Silicon).
- **Probar en Windows y macOS** lo que la tabla dice «debería», con un mando de verdad.
- **WebView2 fijo en Windows**: si algún jugador no tiene WebView2 (Windows 10 viejo), se puede meter el runtime en la
  carpeta del juego (`webviewInstallMode: fixedRuntime`, unos 180 MB) o instalarlo como redistribuible de Steam.
