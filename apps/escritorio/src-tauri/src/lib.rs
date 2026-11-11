// Tuerce para escritorio: una ventana con el juego web (apps/juego/dist) tal cual, sin barras del navegador.
//
// Lo único propio del escritorio son dos comandos que el juego llama desde el menú (apps/juego/src/ui/escritorio.ts):
// alternar la pantalla completa (F11) y salir. En Linux, además, se prenden WebRTC y el micrófono del webview.
//
// La ventana solo navega dentro del juego: cualquier otra dirección (un enlace, una redirección) se bloquea. La CSP
// de tauri.conf.json limita de dónde se cargan scripts y a dónde se conecta (Clerk, Convex y la sala).
use tauri::{plugin::TauriPlugin, AppHandle, Manager, Runtime, Url, WebviewWindow};

/// Si la dirección es el juego mismo: el empacado (`tauri://localhost` o `http://tauri.localhost` en Windows) o,
/// en desarrollo, el Vite local.
fn es_del_juego(url: &Url) -> bool {
    match (url.scheme(), url.host_str()) {
        ("tauri", Some("localhost")) => true,
        ("http" | "https", Some("tauri.localhost")) => true,
        ("http", Some("localhost")) => cfg!(dev),
        _ => false,
    }
}

/// No deja que la ventana del juego se vaya a otra página.
fn solo_el_juego<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("solo-el-juego")
        .on_navigation(|_, url| {
            let permitida = es_del_juego(url);
            if !permitida {
                eprintln!("Tuerce: navegación bloqueada a {url}");
            }
            permitida
        })
        .build()
}

#[tauri::command]
fn alternar_pantalla_completa(ventana: WebviewWindow) -> Result<(), String> {
    let ahora = ventana.is_fullscreen().map_err(|e| e.to_string())?;
    ventana.set_fullscreen(!ahora).map_err(|e| e.to_string())
}

#[tauri::command]
fn salir(app: AppHandle) {
    app.exit(0);
}

/// WebKitGTK trae WebRTC (la partida en línea directa) y getUserMedia (la voz) apagados por defecto. Los prende y
/// deja que el juego use el micrófono sin preguntar (solo el micrófono, nunca la cámara, y solo desde el juego): el
/// juego solo lo abre cuando hay una partida en línea.
/// Ojo: WebRTC solo aparece si el WebKitGTK vino compilado con él; el de Arch y el de Ubuntu no (ver README.md).
#[cfg(target_os = "linux")]
fn preparar_webkitgtk(ventana: &WebviewWindow) {
    let _ = ventana.with_webview(|webview| {
        use webkit2gtk::{
            glib::prelude::*, PermissionRequestExt, SettingsExt, UserMediaPermissionRequest,
            UserMediaPermissionRequestExt, WebViewExt,
        };
        let vista = webview.inner();
        if let Some(ajustes) = vista.settings() {
            ajustes.set_enable_webrtc(true);
            ajustes.set_enable_media_stream(true);
        }
        vista.connect_permission_request(|vista, pedido| {
            let Some(medios) = pedido.downcast_ref::<UserMediaPermissionRequest>() else {
                return false;
            };
            let desde_el_juego = vista
                .uri()
                .and_then(|uri| Url::parse(uri.as_str()).ok())
                .is_some_and(|url| es_del_juego(&url));
            if desde_el_juego && medios.is_for_audio_device() && !medios.is_for_video_device() {
                pedido.allow();
            } else {
                pedido.deny();
            }
            true
        });
    });
}

pub fn arrancar() {
    tauri::Builder::default()
        .plugin(solo_el_juego())
        .setup(|app| {
            #[cfg(target_os = "linux")]
            if let Some(ventana) = app.get_webview_window("principal") {
                preparar_webkitgtk(&ventana);
            }
            #[cfg(not(target_os = "linux"))]
            let _ = app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![alternar_pantalla_completa, salir])
        .run(tauri::generate_context!())
        .expect("no se pudo abrir Tuerce");
}
