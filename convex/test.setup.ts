// Los módulos de funciones que carga convex-test: todo convex/ menos pruebas, tipos y configuración
// (los nombres con dos puntos, que Convex tampoco sube).
export const modulos = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.*.ts"]);
