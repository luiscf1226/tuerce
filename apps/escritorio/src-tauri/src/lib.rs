// Tuerce para escritorio: una ventana con el juego web (apps/juego/dist) tal cual, sin barras del navegador.
//
// Lo único propio del escritorio son dos comandos que el juego llama desde el menú (apps/juego/src/ui/escritorio.ts):
// alternar la pantalla completa (F11) y salir. En Linux, además, se prenden WebRTC y el micrófono del webview.
use tauri::{AppHandle, Manager, WebviewWindow};

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
/// deja que el juego use el micrófono sin preguntar: el juego solo lo abre cuando hay una partida en línea.
/// Ojo: WebRTC solo aparece si el WebKitGTK vino compilado con él; el de Arch y el de Ubuntu no (ver README.md).
#[cfg(target_os = "linux")]
fn preparar_webkitgtk(ventana: &WebviewWindow) {
    let _ = ventana.with_webview(|webview| {
        use webkit2gtk::{glib::prelude::*, PermissionRequestExt, SettingsExt, UserMediaPermissionRequest, WebViewExt};
        let vista = webview.inner();
        if let Some(ajustes) = vista.settings() {
            ajustes.set_enable_webrtc(true);
            ajustes.set_enable_media_stream(true);
        }
        vista.connect_permission_request(|_, pedido| {
            if pedido.is::<UserMediaPermissionRequest>() {
                pedido.allow();
                return true;
            }
            false
        });
    });
}

pub fn arrancar() {
    tauri::Builder::default()
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
