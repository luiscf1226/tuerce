// En Windows, sin esto se abre una consola negra al lado del juego.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tuerce_lib::arrancar()
}
