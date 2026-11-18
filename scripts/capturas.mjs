// pnpm capturas: abre el juego en Chromium sin ventana, recorre las escenas clave, guarda una imagen de cada una
// y un video corto en capturas/. El pull request de cada ola las muestra (ver .github/workflows/revision.yml).
//
//   pnpm capturas                         construye el juego y lo sirve en local
//   CAPTURAS_URL=https://… pnpm capturas  usa una vista previa ya publicada
import { spawn, spawnSync } from "node:child_process";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium, devices } from "playwright";

// Para sumar una escena: agregala en apps/juego/src/escenas/index.ts y acá.
// `congelar` corre ese número exacto de pasos de físicas, así la imagen sale igual en cada corrida.
const TOMAS = [
  { archivo: "prueba-inicio", ruta: "/?escena=prueba&congelar=1" },
  { archivo: "prueba-cajas-en-el-suelo", ruta: "/?escena=prueba&congelar=240" },
  // TU-03: el muñeco de pie solo, a media caminata y girando mientras camina (`andar` y `girar` fijan la entrada)
  { archivo: "muneco-de-pie", ruta: "/?escena=muneco&congelar=240" },
  { archivo: "muneco-caminando", ruta: "/?escena=muneco&andar=1&congelar=110" },
  { archivo: "muneco-girando", ruta: "/?escena=muneco&andar=0.7&girar=0.6&congelar=200" },
  // La imagen del juego (TU-10): compararla con docs/arte/11-pinar.jpg
  { archivo: "pinar", ruta: "/?escena=pinar&congelar=1" },
  // La meta de la ola 1: el muñeco caminando en el pinar
  { archivo: "pinar-caminando", ruta: "/?escena=pinar&andar=1&congelar=150" },
  { archivo: "pinar-niebla-corrida", ruta: "/?escena=pinar&congelar=600" },
  // TU-04 y TU-05: un salto en lo más alto, tirado después de saltar de un escalón de 1.5 m, una caja arrastrada
  // con el brazo derecho y colgado de una rama con los dos (`saltar`, `brazos` y `esperar` son el guion)
  { archivo: "agarre-salto", ruta: "/?escena=agarre&salida=claro&saltar=30&congelar=48" },
  { archivo: "agarre-caido", ruta: "/?escena=agarre&salida=borde&andar=1&saltar=22&congelar=240" },
  { archivo: "agarre-caja", ruta: "/?escena=agarre&brazos=d&andar=-1&esperar=40&congelar=110" },
  { archivo: "agarre-colgado", ruta: "/?escena=agarre&salida=rama&brazos=id&saltar=40&congelar=150" },
  // TU-06: frente al escalón de 1.5 m, con los dos brazos arriba, salta, se cuelga y trepa: a mitad y ya arriba
  {
    archivo: "agarre-trepando",
    ruta: "/?escena=agarre&salida=pared&brazos=id&saltar=20&andar=1&esperar=50&congelar=62",
  },
  {
    archivo: "agarre-arriba",
    ruta: "/?escena=agarre&salida=pared&brazos=id&saltar=20&andar=1&esperar=50&congelar=112",
  },
  // TU-08: dos jugadores en el mismo lugar. `j1`/`j2` fijan la entrada de cada uno; `ayuda` deja ver los controles
  { archivo: "dos-de-pie", ruta: "/?escena=dos&j1=&j2=&ayuda&congelar=60" },
  { archivo: "dos-caminando", ruta: "/?escena=dos&j1=andar:1&j2=andar:0.8&congelar=150" },
  // La meta de la ola 2: los dos saltan juntos, y los dos agarran el huacal pesado con un brazo cada uno
  { archivo: "dos-saltando", ruta: "/?escena=dos&j1=saltar@30&j2=saltar@36&congelar=48" },
  { archivo: "dos-agarrando", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&congelar=150" },
  // TU-07: los dos cargan el huacal de 8 kg en el aire, y se dan la mano y el rojo se lleva al turquesa
  { archivo: "dos-cargando", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&congelar=210" },
  { archivo: "mano-llevando", ruta: "/?escena=mano&llevar&congelar=150" },
  { archivo: "dos-separandose", ruta: "/?escena=dos&j1=andar:1,girar:-0.1&j2=andar:1,girar:0.1&congelar=240" },
  // TU-09: la cámara de los dos. Lejos, la pantalla se parte con una costura perpendicular a la recta entre los dos
  { archivo: "dos-pantalla-partida", ruta: "/?escena=dos&j1=andar:1,girar:-0.3&j2=andar:-1,girar:-0.3&congelar=300" },
  // TU-15: el menú de inicio sobre la escena viva (`menu` lo muestra aunque la entrada sea fija), los dos
  // señalando (la marca del turquesa queda en el tronco caído), y uno encogiéndose de hombros mientras el otro festeja
  { archivo: "dos-menu", ruta: "/?escena=dos&j1=&j2=&menu&congelar=60" },
  // TU-56: la historia y los niveles. Con el patio y el pinar ganados en este navegador, la portada sigue en la poza;
  // el panel con los 17 (los ganados con los dos pañuelos), el de los que se pueden correr contra el reloj, y el
  // menú sobre un nivel abierto desde el panel
  { archivo: "menu-historia", ruta: "/?escena=dos&j1=&j2=&menu&congelar=60", ganados: ["patio", "pinar"] },
  {
    archivo: "menu-niveles",
    ruta: "/?escena=dos&j1=&j2=&menu&congelar=60",
    ganados: ["patio", "pinar"],
    clic: "[data-abre=niveles]",
  },
  {
    archivo: "menu-contrarreloj",
    ruta: "/?escena=dos&j1=&j2=&menu&congelar=60",
    ganados: ["patio", "pinar", "prueba"],
    clic: "[data-abre=contrarreloj]",
  },
  { archivo: "menu-nivel", ruta: "/?escena=nivel&nivel=poza&j1=&j2=&menu&congelar=60" },
  { archivo: "dos-senalando", ruta: "/?escena=dos&j1=senalar,girar:-0.3&j2=senalar,girar:0.3&congelar=90" },
  { archivo: "dos-festejando", ruta: "/?escena=dos&j1=gesto:encoger&j2=gesto:festejar&congelar=80" },
  // Cómo jugar: la portada la primera vez (el tutorial va primero), la pantalla de controles con lo básico, y el
  // tutorial con la hoja de la misión: la primera lección, el cacao, el cántaro entre los dos y el final
  { archivo: "menu-primera-vez", ruta: "/?escena=dos&j1=&j2=&menu&congelar=60" },
  { archivo: "menu-como-se-juega", ruta: "/?escena=dos&j1=&j2=&menu&congelar=60", clic: "[data-abre=controles]" },
  { archivo: "tutorial-caminen", ruta: "/?escena=tutorial&j1=&j2=&congelar=60" },
  { archivo: "tutorial-cacao", ruta: "/?escena=tutorial&leccion=4&j1=andar:1,girar:0.25&j2=andar:1&congelar=150" },
  { archivo: "tutorial-cantaro", ruta: "/?escena=tutorial&leccion=5&j1=andar:0.6,izq&j2=andar:0.6,der&congelar=240" },
  // Con los dedos (teléfonos y tabletas): las dos mitades con palanca y botones, y la hoja dice qué tocar
  { archivo: "tutorial-tactil", ruta: "/?escena=tutorial&leccion=3&j1=&j2=&tactil&congelar=60" },
  // Un teléfono acostado (`telefono`, 839×412): la portada entra en su panel, la hoja de la misión y la del tutorial
  // no le tapan la palanca al rojo, y la pausa muestra «Seguir» arriba
  { archivo: "telefono-menu", ruta: "/?escena=dos&j1=&j2=&menu&tactil&congelar=60", telefono: true },
  { archivo: "telefono-tutorial", ruta: "/?escena=tutorial&leccion=4&j1=&j2=&tactil&congelar=60", telefono: true },
  { archivo: "telefono-mision", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&tactil&congelar=60", telefono: true },
  { archivo: "telefono-pausa", ruta: "/?escena=nivel&nivel=poza&punto=1&j1=&j2=&pausa&tactil&congelar=60", telefono: true },
  { archivo: "tutorial-listos", ruta: "/?escena=tutorial&leccion=6&j1=gesto:festejar&j2=gesto:saludar&congelar=120" },
  // La hoja de la misión en un nivel: la meta con sus puntos, el secreto y el logro
  { archivo: "nivel-mision", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&congelar=60" },
  // La guía de la misión: «Ahora» con el tramo que toca (en el pinar, después del punto 2), la ayuda abierta con la H
  // (todos los pasos y los controles) y la pausa, que muestra lo mismo para quien juega con mando
  { archivo: "mision-ahora", ruta: "/?escena=nivel&nivel=pinar&punto=2&j1=&j2=&congelar=60" },
  { archivo: "mision-ayuda", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=&j2=&ayuda-mision&congelar=60" },
  { archivo: "mision-pausa", ruta: "/?escena=nivel&nivel=poza&punto=1&j1=&j2=&pausa&congelar=60" },
  // TU-11: el nivel de prueba, armado con el formato nuevo (niveles/99-prueba): entero desde lejos y la salida. El
  // turquesa se cae del patio y reaparece junto al rojo; retomando desde el punto 1 la compuerta ya está hundida
  { archivo: "nivel-entero", ruta: "/?escena=nivel&nivel=prueba&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "nivel-salida", ruta: "/?escena=nivel&nivel=prueba&j1=&j2=&congelar=60" },
  { archivo: "nivel-cayendo", ruta: "/?escena=nivel&nivel=prueba&j1=&j2=andar:1,girar:-0.15&congelar=268" },
  { archivo: "nivel-reaparece", ruta: "/?escena=nivel&nivel=prueba&j1=&j2=andar:1,girar:-0.15&congelar=330" },
  { archivo: "nivel-compuerta", ruta: "/?escena=nivel&nivel=prueba&punto=1&j1=andar:1&j2=andar:1&congelar=150" },
  // TU-32: el contrarreloj. El reloj corriendo arriba (arranca cuando se mueven: 2,5 s), la llegada a la meta desde
  // el punto 2 (en el mismo lugar, sin tabla) y la tabla de parejas con datos de mentira (sin cuenta ni red)
  {
    archivo: "contrarreloj-corriendo",
    ruta: "/?escena=nivel&nivel=prueba&contrarreloj&j1=andar:1&j2=andar:1&congelar=150",
  },
  {
    archivo: "contrarreloj-llegada",
    ruta: "/?escena=nivel&nivel=prueba&contrarreloj&punto=2&j1=andar:1&j2=andar:1&congelar=215",
  },
  { archivo: "contrarreloj-tabla", ruta: "/?escena=tabla&nivel=patio&ejemplo" },
  // TU-29: el ropero. Los dos con lo del principio (el rojo con su sombrero, el turquesa con sus trenzas) y el panel
  // para elegir; una cuenta de ejemplo con lo ganado y los logros; las dos vitrinas con todas las prendas; los dos
  // con prendas ganadas en el nivel; y el turquesa que encuentra el secreto del nivel de prueba detrás de la meta
  { archivo: "ropero", ruta: "/?escena=ropero&congelar=60" },
  { archivo: "ropero-cuenta", ruta: "/?escena=ropero&ejemplo&congelar=60" },
  { archivo: "ropero-vitrina-1", ruta: "/?escena=ropero&vitrina=1&congelar=60" },
  { archivo: "ropero-vitrina-2", ruta: "/?escena=ropero&vitrina=2&congelar=60" },
  {
    archivo: "nivel-con-prendas",
    ruta: "/?escena=nivel&nivel=prueba&j1=&j2=&ropa1=sombrero:puntudo,mascara:diablito,panuelo:capa&ropa2=peinado:colitas,mascara:guacamaya,panuelo:lazo&congelar=60",
  },
  {
    archivo: "nivel-secreto",
    ruta: "/?escena=nivel&nivel=prueba&punto=2&j1=andar:0.5&j2=andar:1,girar:0.06&congelar=252",
  },
  // TU-12: las piezas de juego (niveles/98-piezas), entero y en la salida. El rojo pisa la plancha y baja la compuerta;
  // el turquesa empuja la palanca y el rojo pasa; el rojo se columpia en un bejuco sobre la quebrada (los brazos se
  // alzan en el paso 15: al reaparecer en un punto no se agarra con el botón ya apretado); el rojo sube al balancín
  // y después lo vuelca
  { archivo: "piezas-entero", ruta: "/?escena=nivel&nivel=piezas&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "piezas-salida", ruta: "/?escena=nivel&nivel=piezas&j1=&j2=&congelar=60" },
  { archivo: "piezas-plancha", ruta: "/?escena=nivel&nivel=piezas&j1=andar:1&j2=&congelar=230" },
  {
    archivo: "piezas-palanca",
    ruta: "/?escena=nivel&nivel=piezas&punto=1&j1=andar:1&j2=andar:1,izq@15,der@15&congelar=175",
  },
  {
    archivo: "piezas-bejuco",
    ruta: "/?escena=nivel&nivel=piezas&punto=2&j1=andar:1,izq@15,der@15&j2=&congelar=110",
  },
  { archivo: "piezas-balancin", ruta: "/?escena=nivel&nivel=piezas&punto=3&j1=andar:1&j2=&congelar=170" },
  { archivo: "piezas-balancin-volcado", ruta: "/?escena=nivel&nivel=piezas&punto=3&j1=andar:1&j2=&congelar=230" },
  // TU-13: el nivel 0, El patio (niveles/00-patio). Entero desde lejos; despiertan tirados en el montón de trapos y
  // se levantan; el rojo empuja la aldaba y el turquesa pasa el portón; los dos cargan la escalera y se apoya en el
  // muro (logro «A la de tres»); suben el techo de lámina; el rojo cae al camión que maniobra (la meta); y el
  // turquesa encuentra la piñata en el palo de mango (el secreto)
  { archivo: "patio-entero", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "patio-1-despiertan", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&congelar=100" },
  { archivo: "patio-1-levantados", ruta: "/?escena=nivel&nivel=patio&j1=&j2=&congelar=260" },
  {
    archivo: "patio-2-porton",
    ruta: "/?escena=nivel&nivel=patio&punto=1&j1=andar:0.8,izq@15,der@15&j2=andar:1&congelar=115",
  },
  {
    archivo: "patio-3-escalera",
    ruta: "/?escena=nivel&nivel=patio&punto=2&j1=andar:0.6,izq@15,der@15&j2=andar:0.6,izq@15,der@15&congelar=200",
  },
  {
    archivo: "patio-3-apoyada",
    ruta: "/?escena=nivel&nivel=patio&punto=2&j1=andar:0.6,izq@15,der@15&j2=andar:0.6,izq@15,der@15&congelar=440",
  },
  { archivo: "patio-4-lamina", ruta: "/?escena=nivel&nivel=patio&punto=3&j1=andar:1&j2=andar:1&congelar=170" },
  { archivo: "patio-5-camion", ruta: "/?escena=nivel&nivel=patio&punto=4&j1=andar:1&j2=&congelar=95" },
  { archivo: "patio-5-meta", ruta: "/?escena=nivel&nivel=patio&punto=4&j1=andar:1&j2=&congelar=170" },
  { archivo: "patio-secreto", ruta: "/?escena=nivel&nivel=patio&punto=2&j1=&j2=andar:1,girar:0.1&congelar=150" },
  // TU-14: el nivel 1, El pinar (niveles/01-pinar), entero, en la salida y una toma por misión: 1. el rojo empuja el
  // cajón contra el cerco; 2. el turquesa sube solo por el balancín y, pasado el eje, se le vuelca; 3. el rojo se
  // columpia en el bejuco sobre el barranco; 4. el rojo agarra el tronco de los caballetes (solo no lo levanta);
  // 5. el Cadejo echado en su corral, persiguiendo al rojo y recién lamido; 6. el rojo agarra la lámpara, que se
  // enciende y abre la puerta de la pulpería (y, ya en la meta, la lámpara encendida y la puerta abierta). Y el nido
  // del secreto, arriba del pino más alto (`vista=x,y,z`: la cámara quieta mirando ese punto)
  { archivo: "pinar-entero", ruta: "/?escena=nivel&nivel=pinar&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "pinar-salida", ruta: "/?escena=nivel&nivel=pinar&j1=&j2=&congelar=60" },
  { archivo: "pinar-1-cerco", ruta: "/?escena=nivel&nivel=pinar&j1=andar:1&j2=andar:1&congelar=230" },
  { archivo: "pinar-2-balancin", ruta: "/?escena=nivel&nivel=pinar&punto=1&j1=&j2=andar:1&congelar=260" },
  { archivo: "pinar-2-volcado", ruta: "/?escena=nivel&nivel=pinar&punto=1&j1=&j2=andar:1&congelar=395" },
  {
    archivo: "pinar-3-bejuco",
    ruta: "/?escena=nivel&nivel=pinar&punto=2&j1=andar:1,izq@15,der@15&j2=&congelar=250",
  },
  { archivo: "pinar-4-tronco", ruta: "/?escena=nivel&nivel=pinar&punto=3&j1=andar:1,der@15&j2=andar:1&congelar=100" },
  { archivo: "pinar-5-cadejo", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=&j2=&vista=41.2,3.8,0&congelar=60" },
  { archivo: "pinar-5-persigue", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=andar:1&j2=&congelar=118" },
  { archivo: "pinar-5-lamida", ruta: "/?escena=nivel&nivel=pinar&punto=4&j1=andar:1&j2=&congelar=140" },
  { archivo: "pinar-6-lampara", ruta: "/?escena=nivel&nivel=pinar&punto=5&j1=andar:1,der@15&j2=&congelar=250" },
  { archivo: "pinar-6-encendida", ruta: "/?escena=nivel&nivel=pinar&punto=6&j1=&j2=&vista=50.6,4.6,0&congelar=60" },
  { archivo: "pinar-secreto", ruta: "/?escena=nivel&nivel=pinar&punto=5&j1=&j2=&vista=49.7,7.9,-2.45&congelar=30" },
  // TU-33: Noche de tuerce. El nivel de piezas de noche, entero; con el cartel de la trampa al empezar: amarrados por
  // un mecate (el turquesa se queda y el rojo lo arrastra), la niebla espesa en el de prueba, los dos saltando con
  // gravedad de luna, y la línea del menú
  {
    archivo: "noche-piezas-entero",
    ruta: "/?escena=nivel&nivel=piezas&noche=2&trampa=cruzados&j1=&j2=&vista=todo&congelar=60",
  },
  {
    archivo: "noche-amarrados",
    ruta: "/?escena=nivel&nivel=piezas&noche=7&trampa=mecate&j1=andar:1,girar:-0.15&j2=&congelar=200",
  },
  {
    archivo: "noche-niebla",
    ruta: "/?escena=nivel&nivel=prueba&noche=3&trampa=niebla&j1=andar:1&j2=andar:1&congelar=120",
  },
  {
    archivo: "noche-luna",
    ruta: "/?escena=nivel&nivel=prueba&noche=1&trampa=luna&j1=saltar@30&j2=saltar@36&congelar=75",
  },
  { archivo: "noche-menu", ruta: "/?escena=nivel&nivel=prueba&noche=5&j1=&j2=&menu&congelar=60" },
  // TU-24: el nivel 2, La poza (niveles/02-poza), entero y en la salida (los troncos en sus caballetes); 1. la balsa
  // amarrada junto al muelle, con los dos a bordo; 2. remando río arriba; 3. el chorro de la represa y, abierta la
  // compuerta, cortado; 4. los dos bajando por el tendedero; 5. las piedras de la isla y la boca, y la poza seca;
  // 6. la batea en lo hondo y La Sucia tirándole agua al que se quedó en su lavadero. Y la pepita del secreto
  { archivo: "poza-entero", ruta: "/?escena=nivel&nivel=poza&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "poza-salida", ruta: "/?escena=nivel&nivel=poza&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "poza-1-balsa", ruta: "/?escena=nivel&nivel=poza&punto=1&j1=&j2=&vista=5.6,0.8,-1.5&congelar=60" },
  { archivo: "poza-2-remando", ruta: "/?escena=nivel&nivel=poza&punto=1&j1=izq,der&j2=izq,der&congelar=600" },
  { archivo: "poza-3-chorro", ruta: "/?escena=nivel&nivel=poza&punto=2&j1=&j2=&vista=24.2,1.6,0.6&congelar=60" },
  { archivo: "poza-3-compuerta", ruta: "/?escena=nivel&nivel=poza&punto=3&j1=&j2=&vista=24.2,1.6,0.6&congelar=60" },
  { archivo: "poza-4-tendedero", ruta: "/?escena=nivel&nivel=poza&punto=3&j1=izq,der&j2=izq@40,der@40&congelar=230" },
  { archivo: "poza-5-boca", ruta: "/?escena=nivel&nivel=poza&punto=4&j1=&j2=&vista=39,2.2,0.6&congelar=60" },
  { archivo: "poza-5-seca", ruta: "/?escena=nivel&nivel=poza&punto=5&j1=&j2=&vista=31,0.8,0&congelar=60" },
  { archivo: "poza-6-batea", ruta: "/?escena=nivel&nivel=poza&punto=5&j1=&j2=&congelar=60" },
  { archivo: "poza-6-sucia", ruta: "/?escena=nivel&nivel=poza&punto=6&j1=&j2=&vista=42.6,2.6,-1.4&congelar=268" },
  { archivo: "poza-secreto", ruta: "/?escena=nivel&nivel=poza&punto=5&j1=&j2=&vista=28.1,0,2.3&congelar=30" },
  // TU-26: el nivel 4, Xibalbá de juguete (niveles/04-xibalba), entero, en la salida y una toma por misión: 1. los dos
  // en la plancha doble y la entrada ya hundida; 2. la estela con sus varas y, alineada, con la reja abierta; 3. el aro
  // y la pelota en su soporte; 4. los dos suben el bloque por la escalinata y lo dejan contra el templo; 5. el túnel
  // con los murciélagos colgados, la antorcha, el brasero y la llave de jade, y los murciélagos que se le tiran al
  // rojo, que entró a oscuras; 6. la tumba con el plato del contrapeso, las piedras y la losa; la meta; y la
  // guacamaya dorada del secreto, en lo alto del templo
  { archivo: "xibalba-entero", ruta: "/?escena=nivel&nivel=xibalba&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "xibalba-salida", ruta: "/?escena=nivel&nivel=xibalba&j1=&j2=&congelar=60" },
  { archivo: "xibalba-1-planchas", ruta: "/?escena=nivel&nivel=xibalba&j1=andar:1&j2=andar:1&congelar=330" },
  {
    archivo: "xibalba-1-abierta",
    ruta: "/?escena=nivel&nivel=xibalba&j1=andar:1&j2=andar:1&vista=8,1.2,0&congelar=430",
  },
  { archivo: "xibalba-2-estela", ruta: "/?escena=nivel&nivel=xibalba&punto=1&j1=&j2=&vista=11.5,1.6,0&congelar=60" },
  {
    archivo: "xibalba-2-alineada",
    ruta: "/?escena=nivel&nivel=xibalba&punto=2&j1=&j2=&vista=13.5,1.6,0&congelar=60",
  },
  { archivo: "xibalba-3-aro", ruta: "/?escena=nivel&nivel=xibalba&punto=2&j1=&j2=&vista=23,1.4,0&congelar=60" },
  {
    archivo: "xibalba-4-bloque",
    ruta: "/?escena=nivel&nivel=xibalba&punto=3&j1=andar:0.7,izq@15,der@15&j2=andar:0.7,izq@15,der@15&congelar=420",
  },
  {
    archivo: "xibalba-4-arriba",
    ruta: "/?escena=nivel&nivel=xibalba&punto=3&j1=andar:0.7,izq@15,der@15&j2=andar:0.7,izq@15,der@15&vista=40.6,2.4,0&congelar=900",
  },
  { archivo: "xibalba-5-tunel", ruta: "/?escena=nivel&nivel=xibalba&punto=4&j1=&j2=&vista=48.5,5.6,0&congelar=60" },
  { archivo: "xibalba-5-murcielagos", ruta: "/?escena=nivel&nivel=xibalba&punto=4&j1=andar:1&j2=&congelar=200" },
  { archivo: "xibalba-6-tumba", ruta: "/?escena=nivel&nivel=xibalba&punto=5&j1=&j2=&vista=58.5,5.3,0.5&congelar=60" },
  { archivo: "xibalba-meta", ruta: "/?escena=nivel&nivel=xibalba&punto=6&j1=&j2=&congelar=60" },
  {
    archivo: "xibalba-secreto",
    ruta: "/?escena=nivel&nivel=xibalba&punto=4&j1=&j2=&vista=48.9,9.0,-2.1&congelar=30",
  },
  // TU-27: el nivel 5, El tren bananero (niveles/05-tren), entero, en la salida y una toma por misión (`vista=x,y,z`:
  // la cámara quieta mirando ese punto): 1. el tren tapa el paso a nivel, con la plataforma suelta detrás; 2. la
  // dresina en su zanja, con la bomba de balancín; 3. la palanca del cambio, su señal y el agujero del Duende, y el
  // racimo de mínimos dorados en el rellano del puente roto (el secreto); 4. la grúa, su tolva y el racimo grande;
  // 5. la romana con sus ganchos y los racimos en el colgadero; 6. el Duende en su casa, y en la meta el tren que
  // llegó y el Duende contento con su sombrero
  { archivo: "tren-entero", ruta: "/?escena=nivel&nivel=tren&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "tren-salida", ruta: "/?escena=nivel&nivel=tren&j1=&j2=&congelar=60" },
  { archivo: "tren-1-tren", ruta: "/?escena=nivel&nivel=tren&j1=&j2=&vista=-18,1.4,0&congelar=30" },
  { archivo: "tren-2-dresina", ruta: "/?escena=nivel&nivel=tren&punto=1&j1=&j2=&vista=-13.4,1.2,-4&congelar=30" },
  { archivo: "tren-3-cambio", ruta: "/?escena=nivel&nivel=tren&punto=2&j1=&j2=&vista=9,1.8,-2.6&congelar=30" },
  { archivo: "tren-3-secreto", ruta: "/?escena=nivel&nivel=tren&punto=2&j1=&j2=&vista=24.4,1.3,-3.5&congelar=30" },
  { archivo: "tren-4-grua", ruta: "/?escena=nivel&nivel=tren&punto=3&j1=&j2=&vista=32.5,2.4,-11.5&congelar=30" },
  { archivo: "tren-5-romana", ruta: "/?escena=nivel&nivel=tren&punto=4&j1=&j2=&vista=45,1.6,-9.5&congelar=30" },
  { archivo: "tren-6-duende", ruta: "/?escena=nivel&nivel=tren&punto=5&j1=&j2=&vista=53.5,1,-11&congelar=30" },
  { archivo: "tren-6-meta", ruta: "/?escena=nivel&nivel=tren&punto=6&j1=&j2=&vista=56,1.2,-7&congelar=30" },
  // TU-25: el nivel 3, La calle empedrada (niveles/03-calle), entero, en la salida y una toma por misión: 1. los dos
  // empujan la carreta por el callejón de la cuesta, y arriba queda trabada; 2. la Carreta sin bueyes en su calle
  // (con el freno a la entrada) y el rojo que entra y lo saca; 3. la torre del reloj con las pesas y, ya pasado el
  // punto 3, las agujas en las doce y la puerta arriba; 4. el corredor alto con las enredaderas sobre las alfombras,
  // y las pisadas del que pasa por la calle; 5. las dos campanas y la reja; 6. los dos suben a la carreta del mirador,
  // bajando y ya en la plaza. Y el pilón del secreto, arriba de la vitrina del carrito
  { archivo: "calle-entero", ruta: "/?escena=nivel&nivel=calle&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "calle-salida", ruta: "/?escena=nivel&nivel=calle&j1=&j2=&congelar=60" },
  { archivo: "calle-1-cuesta", ruta: "/?escena=nivel&nivel=calle&j1=andar:1&j2=andar:1&congelar=700" },
  { archivo: "calle-1-arriba", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-29,3.2,0&congelar=30" },
  { archivo: "calle-2-sin-bueyes", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-15.5,2.6,0&congelar=150" },
  { archivo: "calle-2-sacado", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=andar:1&j2=&congelar=468" },
  { archivo: "calle-3-reloj", ruta: "/?escena=nivel&nivel=calle&punto=2&j1=&j2=&vista=3.4,5.4,2.4&congelar=30" },
  { archivo: "calle-3-abierta", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=&j2=&vista=3.4,5.4,2.4&congelar=90" },
  { archivo: "calle-4-corredor", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=&j2=&vista=19,4,-0.5&congelar=30" },
  { archivo: "calle-4-pisadas", ruta: "/?escena=nivel&nivel=calle&punto=3&j1=andar:1&j2=andar:1&congelar=420" },
  { archivo: "calle-5-campanas", ruta: "/?escena=nivel&nivel=calle&punto=4&j1=&j2=&vista=32.5,9.5,-2.5&congelar=30" },
  { archivo: "calle-6-subiendo", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=150" },
  { archivo: "calle-6-bajando", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=262" },
  { archivo: "calle-6-plaza", ruta: "/?escena=nivel&nivel=calle&punto=5&j1=andar:1&j2=andar:1&congelar=420" },
  { archivo: "calle-secreto", ruta: "/?escena=nivel&nivel=calle&punto=1&j1=&j2=&vista=-20.6,4,-2.4&congelar=30" },
  // TU-28: el nivel 6, el Río Plátano (niveles/06-rio; va corrido 53 m hacia −x), entero y en la salida; 1. el
  // pipante amarrado junto al muelle y el río con sus dos piedras, y los dos ya en el embarcadero; 2. los rápidos con
  // un tronco cruzando el vado; 3. las huellas en la bifurcación; 4. el puente con sus dos huecos y reparado;
  // 5. el Sisimite dormido en el cañón y los dos en su cumbre; 6. la palmera, el barranco y la liana recogida junto a
  // la ceiba. Y la figura de jade del secreto, arriba del templo
  { archivo: "rio-entero", ruta: "/?escena=nivel&nivel=rio&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "rio-salida", ruta: "/?escena=nivel&nivel=rio&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "rio-1-pipante", ruta: "/?escena=nivel&nivel=rio&j1=&j2=&vista=-48,0.6,-0.8&congelar=60" },
  { archivo: "rio-1-embarcadero", ruta: "/?escena=nivel&nivel=rio&punto=1&j1=&j2=&congelar=60" },
  { archivo: "rio-2-rapidos", ruta: "/?escena=nivel&nivel=rio&punto=1&j1=&j2=&vista=-21,0.6,0&congelar=85" },
  { archivo: "rio-3-huellas", ruta: "/?escena=nivel&nivel=rio&punto=2&j1=&j2=&vista=-10.5,0.4,0&congelar=60" },
  { archivo: "rio-4-puente", ruta: "/?escena=nivel&nivel=rio&punto=3&j1=&j2=&vista=13,0.6,0&congelar=60" },
  { archivo: "rio-4-reparado", ruta: "/?escena=nivel&nivel=rio&punto=4&j1=&j2=&vista=13,0.6,0&congelar=60" },
  { archivo: "rio-5-sisimite", ruta: "/?escena=nivel&nivel=rio&punto=4&j1=&j2=&vista=26.5,2.2,3&congelar=60" },
  { archivo: "rio-5-cumbre", ruta: "/?escena=nivel&nivel=rio&punto=5&j1=&j2=&vista=29,3.6,0&congelar=60" },
  { archivo: "rio-6-palmera", ruta: "/?escena=nivel&nivel=rio&punto=5&j1=&j2=&vista=44,1.6,0&congelar=60" },
  { archivo: "rio-secreto", ruta: "/?escena=nivel&nivel=rio&punto=6&j1=&j2=&vista=59.5,3.1,-2.4&congelar=30" },
  // Los canales (TU-42): el nivel 9, Xochimilco (niveles/09-canales; va corrido 45 m hacia −x), entero y en la salida;
  // 1. la trajinera amarrada en el canal y los dos ya en la chinampa de La Llorona, que llora; 2. el arco de la
  // trajinera contra el puente, con el canal crecido, y La Llorona ya tranquila con el agua abajo; 3. las chinampas
  // flotantes de la ciénaga; 4. la piñata colgada alta entre sus postes y la reja abierta; 5. la trajinera de las
  // flores entre las chinampas y la meta. Y el alebrije dormido del secreto
  { archivo: "canales-entero", ruta: "/?escena=nivel&nivel=canales&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "canales-salida", ruta: "/?escena=nivel&nivel=canales&j1=andar:0.6&j2=andar:0.6&congelar=150" },
  { archivo: "canales-1-trajinera", ruta: "/?escena=nivel&nivel=canales&j1=&j2=&vista=-41.5,0.9,-1.2&congelar=60" },
  {
    archivo: "canales-1-llorona",
    ruta: "/?escena=nivel&nivel=canales&punto=1&j1=&j2=&vista=-22.2,1.5,1.2&congelar=90",
  },
  {
    archivo: "canales-2-puente",
    ruta: "/?escena=nivel&nivel=canales&punto=1&j1=&j2=&vista=-19.5,1.4,-1&congelar=60",
  },
  {
    archivo: "canales-2-tranquila",
    ruta: "/?escena=nivel&nivel=canales&punto=2&j1=&j2=&vista=-21,1.2,0.6&congelar=60",
  },
  {
    archivo: "canales-3-chinampas",
    ruta: "/?escena=nivel&nivel=canales&punto=2&j1=&j2=&vista=-4.6,0.4,0&congelar=60",
  },
  { archivo: "canales-4-pinata", ruta: "/?escena=nivel&nivel=canales&punto=3&j1=&j2=&vista=9,2,0&congelar=60" },
  { archivo: "canales-4-reja", ruta: "/?escena=nivel&nivel=canales&punto=4&j1=&j2=&congelar=60" },
  { archivo: "canales-5-flores", ruta: "/?escena=nivel&nivel=canales&punto=4&j1=&j2=&vista=26,0.8,-0.4&congelar=60" },
  { archivo: "canales-5-meta", ruta: "/?escena=nivel&nivel=canales&punto=5&j1=&j2=&congelar=60" },
  {
    archivo: "canales-secreto",
    ruta: "/?escena=nivel&nivel=canales&punto=2&j1=&j2=&vista=-6.7,0.7,-2.5&congelar=30",
  },
  // El llano (TU-44): el nivel 11 (niveles/11-llano; va corrido 49 m hacia −x), entero y en la salida; 1. el pajonal
  // con las ondas del silbido sobre los dos (se cierran: suena al revés); 2. el molino girando y frenado en rampa, y
  // el portón abierto; 3. las reses en el potrero y ya en el corral; 4. la hamaca junto al caño, y el puente bajado;
  // 5. la troja con el saco y el Silbón esperando bajo su rancho. Y el arpa llanera del secreto, bajo el samán
  { archivo: "llano-entero", ruta: "/?escena=nivel&nivel=llano&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "llano-salida", ruta: "/?escena=nivel&nivel=llano&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "llano-1-pajonal", ruta: "/?escena=nivel&nivel=llano&j1=&j2=&vista=-41,1,-2.5&congelar=60" },
  { archivo: "llano-2-molino", ruta: "/?escena=nivel&nivel=llano&punto=1&j1=&j2=&vista=-15.5,1.4,-1.5&congelar=69" },
  { archivo: "llano-2-porton", ruta: "/?escena=nivel&nivel=llano&punto=2&j1=&j2=&vista=-9,1.2,0&congelar=60" },
  { archivo: "llano-3-ganado", ruta: "/?escena=nivel&nivel=llano&punto=2&j1=&j2=&vista=1.5,0.8,0&congelar=60" },
  { archivo: "llano-3-corral", ruta: "/?escena=nivel&nivel=llano&punto=3&j1=&j2=&vista=10,0.8,-1&congelar=60" },
  { archivo: "llano-4-hamaca", ruta: "/?escena=nivel&nivel=llano&punto=3&j1=&j2=&vista=21,0.8,0&congelar=60" },
  { archivo: "llano-4-puente", ruta: "/?escena=nivel&nivel=llano&punto=4&j1=&j2=&vista=24,0.6,1&congelar=60" },
  { archivo: "llano-5-troja", ruta: "/?escena=nivel&nivel=llano&punto=4&j1=&j2=&vista=33,1.6,-2&congelar=60" },
  { archivo: "llano-5-silbon", ruta: "/?escena=nivel&nivel=llano&punto=4&j1=&j2=&vista=42.4,1.8,-0.7&congelar=60" },
  { archivo: "llano-5-meta", ruta: "/?escena=nivel&nivel=llano&punto=5&j1=&j2=&congelar=60" },
  { archivo: "llano-secreto", ruta: "/?escena=nivel&nivel=llano&punto=4&j1=&j2=&vista=39.6,1.2,-5.6&congelar=30" },
  // La garrucha (TU-43): el nivel 10, el Eje cafetero (niveles/10-garrucha; va corrido 52 m hacia −x), entero y en
  // la salida; 1. la canasta en la finca, el cable sobre el cañón y las manijas, y los dos ya en la loma; 2. la
  // carrera: el rojo pasa la salida y La Patasola arranca brincando; 3. la chiva junto a la bodega, con la carga en la
  // tarima, y ya llegada a la otra loma; 4. la palma de cera con su manea, y los dos en su plataforma; 5. el cañón de las lianas
  // con sus farallones, y la meta. Y la orquídea del secreto, en lo alto de la palma más alta
  { archivo: "garrucha-entero", ruta: "/?escena=nivel&nivel=garrucha&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "garrucha-salida", ruta: "/?escena=nivel&nivel=garrucha&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "garrucha-1-canasta", ruta: "/?escena=nivel&nivel=garrucha&j1=&j2=&vista=-37,1.4,-0.4&congelar=60" },
  { archivo: "garrucha-1-loma", ruta: "/?escena=nivel&nivel=garrucha&punto=1&j1=&j2=&congelar=60" },
  { archivo: "garrucha-2-carrera", ruta: "/?escena=nivel&nivel=garrucha&punto=1&j1=andar:1&j2=&congelar=170" },
  { archivo: "garrucha-3-chiva", ruta: "/?escena=nivel&nivel=garrucha&punto=2&j1=&j2=&vista=9,2.8,0&congelar=60" },
  { archivo: "garrucha-3-llegada", ruta: "/?escena=nivel&nivel=garrucha&punto=3&j1=&j2=&congelar=60" },
  { archivo: "garrucha-4-palma", ruta: "/?escena=nivel&nivel=garrucha&punto=3&j1=&j2=&vista=34.5,5.6,0&congelar=60" },
  { archivo: "garrucha-4-plataforma", ruta: "/?escena=nivel&nivel=garrucha&punto=4&j1=&j2=&congelar=60" },
  { archivo: "garrucha-5-lianas", ruta: "/?escena=nivel&nivel=garrucha&punto=4&j1=&j2=&vista=42,9.4,0&congelar=60" },
  { archivo: "garrucha-5-meta", ruta: "/?escena=nivel&nivel=garrucha&punto=5&j1=&j2=&congelar=60" },
  { archivo: "garrucha-secreto", ruta: "/?escena=nivel&nivel=garrucha&punto=5&j1=&j2=&vista=54.9,13.6,0&congelar=30" },
  // Las trenzas (TU-40): el nivel 7, Antigua (niveles/07-trenzas; va corrido 38 m hacia −x), entero y en la salida;
  // 1. el nudo y el portón del arco; 2. la mula y sus bultos; 3. las ruinas de la iglesia; 4. la fuente, el pretil y
  // las piedras calientes; 5. el sombrero al pie de la cuesta, el Sombrerón en su plaza y la meta con el sombrero
  // puesto. Y el barrilete del secreto, en el campanario
  { archivo: "trenzas-entero", ruta: "/?escena=nivel&nivel=trenzas&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "trenzas-salida", ruta: "/?escena=nivel&nivel=trenzas&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "trenzas-1-nudo", ruta: "/?escena=nivel&nivel=trenzas&j1=&j2=&vista=-32,1,0&congelar=60" },
  { archivo: "trenzas-1-abierto", ruta: "/?escena=nivel&nivel=trenzas&punto=1&j1=&j2=&vista=-31,1,0&congelar=60" },
  { archivo: "trenzas-2-mula", ruta: "/?escena=nivel&nivel=trenzas&punto=1&j1=&j2=&vista=-24.5,0.8,0&congelar=60" },
  { archivo: "trenzas-2-meson", ruta: "/?escena=nivel&nivel=trenzas&punto=2&j1=&j2=&vista=-12.5,0.8,0&congelar=60" },
  { archivo: "trenzas-3-ruinas", ruta: "/?escena=nivel&nivel=trenzas&punto=2&j1=&j2=&vista=0.4,0,0&congelar=60" },
  { archivo: "trenzas-4-balde", ruta: "/?escena=nivel&nivel=trenzas&punto=3&j1=&j2=&vista=12.5,0.8,-0.8&congelar=60" },
  { archivo: "trenzas-4-brasas", ruta: "/?escena=nivel&nivel=trenzas&punto=3&j1=&j2=&vista=19.9,0.4,0&congelar=60" },
  { archivo: "trenzas-5-sombrero", ruta: "/?escena=nivel&nivel=trenzas&punto=4&j1=&j2=&vista=28.5,1,-0.5&congelar=60" },
  { archivo: "trenzas-5-sombreron", ruta: "/?escena=nivel&nivel=trenzas&punto=4&j1=&j2=&vista=38.7,2.3,0&congelar=60" },
  { archivo: "trenzas-5-meta", ruta: "/?escena=nivel&nivel=trenzas&punto=5&j1=&j2=&vista=38.2,2.5,0.8&congelar=60" },
  { archivo: "trenzas-secreto", ruta: "/?escena=nivel&nivel=trenzas&punto=5&j1=&j2=&vista=44.8,4.9,-2.1&congelar=30" },
  // El cafetal (TU-41): el nivel 8, entero y en la salida; 1. el tapesco con los canastos y el patio de secado con el
  // recibidero; 2. El Cipitío en la rama del palo de jocote, tirándole a la pareja recién llegada al patio, y la
  // piedra que queda al pie del muro; 3. la zaranda colgada de la ramada y la puerta del beneficio; 4. la polea, los
  // costales y la troja; 5. El Cipitío sentado en el portillo de la tapia, y contento arriba de la tapia. Y el sombrero
  // puntudo del secreto, arriba de la piedra grande
  { archivo: "cafetal-entero", ruta: "/?escena=nivel&nivel=cafetal&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "cafetal-salida", ruta: "/?escena=nivel&nivel=cafetal&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "cafetal-1-canastos", ruta: "/?escena=nivel&nivel=cafetal&j1=&j2=&vista=-28.5,1.6,-0.6&congelar=60" },
  { archivo: "cafetal-1-patio", ruta: "/?escena=nivel&nivel=cafetal&j1=&j2=&vista=-22,1.6,-1&congelar=60" },
  {
    archivo: "cafetal-2-cipitio",
    ruta: "/?escena=nivel&nivel=cafetal&punto=1&j1=&j2=&vista=-12.9,4.3,-1.5&congelar=50",
  },
  { archivo: "cafetal-2-piedra", ruta: "/?escena=nivel&nivel=cafetal&punto=1&j1=&j2=&vista=-14,2.2,0&congelar=240" },
  { archivo: "cafetal-3-zaranda", ruta: "/?escena=nivel&nivel=cafetal&punto=2&j1=&j2=&vista=-4.5,4.6,0&congelar=60" },
  { archivo: "cafetal-4-polea", ruta: "/?escena=nivel&nivel=cafetal&punto=3&j1=&j2=&vista=7,5.2,-0.6&congelar=60" },
  { archivo: "cafetal-5-portillo", ruta: "/?escena=nivel&nivel=cafetal&punto=4&j1=&j2=&vista=26,4.2,0&congelar=60" },
  { archivo: "cafetal-5-contento", ruta: "/?escena=nivel&nivel=cafetal&punto=5&j1=&j2=&vista=27,5.4,-1&congelar=60" },
  { archivo: "cafetal-secreto", ruta: "/?escena=nivel&nivel=cafetal&punto=5&j1=&j2=&vista=35,6.4,-2.4&congelar=30" },
  // El puente (TU-45): el nivel 12, Q'eswachaka (niveles/12-puente; va corrido 42 m hacia −x), entero y en la
  // salida; 1. la qeswa entre sus dos torcedores; 2. la cabecera con la soga y el amarre, y el puente flojo colgando
  // en el cañón; 3. el rojo cruzando el puente amarrado, que se mece; 4. las terrazas con la de arriba regada y las
  // bocatomas, y las tres regadas; 5. la llama carguera delante de su corral, y contenta en el patio del tambo con
  // la meta. Y el quipu del secreto, entre las piedras del pedregal
  { archivo: "puente-entero", ruta: "/?escena=nivel&nivel=puente&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "puente-salida", ruta: "/?escena=nivel&nivel=puente&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "puente-1-qeswa", ruta: "/?escena=nivel&nivel=puente&j1=&j2=&vista=-35,1,-1.8&congelar=60" },
  { archivo: "puente-2-tender", ruta: "/?escena=nivel&nivel=puente&punto=1&j1=&j2=&vista=-19.5,0.6,0&congelar=60" },
  { archivo: "puente-3-cruzar", ruta: "/?escena=nivel&nivel=puente&punto=2&j1=andar:1&j2=&congelar=230" },
  { archivo: "puente-4-terrazas", ruta: "/?escena=nivel&nivel=puente&punto=3&j1=&j2=&vista=10,1.8,-4.5&congelar=90" },
  { archivo: "puente-4-regadas", ruta: "/?escena=nivel&nivel=puente&punto=4&j1=&j2=&vista=4,0.8,-4.5&congelar=90" },
  { archivo: "puente-5-llama", ruta: "/?escena=nivel&nivel=puente&punto=4&j1=&j2=&vista=22.5,3.4,-1&congelar=60" },
  { archivo: "puente-5-meta", ruta: "/?escena=nivel&nivel=puente&punto=5&j1=&j2=&vista=40,3.4,-1&congelar=60" },
  { archivo: "puente-secreto", ruta: "/?escena=nivel&nivel=puente&j1=&j2=&vista=-31.7,1.6,-6.3&congelar=30" },
  // La mina (TU-46): el nivel 13, entero y en la salida; 1. la vagoneta con el cambio, y el derrumbe y la reja; 2. el
  // pozo con la jaula y sus poleas; 3. las velas con El Tío esperando, y contento con su ofrenda; 4. los espejos y el
  // haz; 5. la vagoneta en la boca de la mina, y el salar; y la galería vieja con la pepita del secreto
  { archivo: "mina-entero", ruta: "/?escena=nivel&nivel=mina&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "mina-salida", ruta: "/?escena=nivel&nivel=mina&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "mina-1-vagoneta", ruta: "/?escena=nivel&nivel=mina&j1=&j2=&vista=-41,1.2,0&congelar=60" },
  { archivo: "mina-1-reja", ruta: "/?escena=nivel&nivel=mina&j1=&j2=&vista=-31,1.2,-0.4&congelar=60" },
  { archivo: "mina-2-pozo", ruta: "/?escena=nivel&nivel=mina&punto=1&j1=&j2=&vista=-20,2.2,0&congelar=60" },
  { archivo: "mina-3-velas", ruta: "/?escena=nivel&nivel=mina&punto=2&j1=&j2=&vista=-7,3.2,-0.5&congelar=60" },
  { archivo: "mina-3-tio", ruta: "/?escena=nivel&nivel=mina&punto=3&j1=&j2=&vista=-2.6,3.2,-1.2&congelar=90" },
  { archivo: "mina-4-espejos", ruta: "/?escena=nivel&nivel=mina&punto=3&j1=&j2=&vista=8,3.8,-0.6&congelar=60" },
  { archivo: "mina-5-boca", ruta: "/?escena=nivel&nivel=mina&punto=4&j1=&j2=&vista=20.5,2.8,0.4&congelar=60" },
  { archivo: "mina-5-salar", ruta: "/?escena=nivel&nivel=mina&punto=5&j1=&j2=&vista=45,-2.4,0.8&congelar=60" },
  { archivo: "mina-secreto", ruta: "/?escena=nivel&nivel=mina&punto=1&j1=&j2=&vista=-24.6,1.8,-2.4&congelar=30" },
  // La minga (TU-47): el nivel 14, Chiloé (niveles/14-minga; va corrido 52 m hacia −x), entero y en la salida;
  // 1. los palafitos con la marea baja y con la marea alta; 2. la casa sobre los troncos con sus dos cabos, y ya en su
  // sitio con la tranquera abierta; 3. la chalupa fondeada lejos del muelle, con los cabos colgando del poste, y
  // amarrada; 4. los dos subiendo en el ancla del Caleuche; 5. la fiesta en la cubierta, y la plancha baja hasta la
  // meta. Y el curanto enterrado del secreto, en la playa
  { archivo: "minga-entero", ruta: "/?escena=nivel&nivel=minga&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "minga-salida", ruta: "/?escena=nivel&nivel=minga&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "minga-1-bajamar", ruta: "/?escena=nivel&nivel=minga&j1=&j2=&vista=-34,0.8,-0.6&congelar=60" },
  { archivo: "minga-1-pleamar", ruta: "/?escena=nivel&nivel=minga&j1=&j2=&vista=-34,0.8,-0.6&congelar=960" },
  { archivo: "minga-2-casa", ruta: "/?escena=nivel&nivel=minga&punto=1&j1=&j2=&vista=-1.6,2,0&congelar=60" },
  { archivo: "minga-2-sitio", ruta: "/?escena=nivel&nivel=minga&punto=2&j1=&j2=&vista=6.5,2,0&congelar=120" },
  { archivo: "minga-3-chalupa", ruta: "/?escena=nivel&nivel=minga&punto=2&j1=&j2=&vista=26,1,-1.8&congelar=60" },
  { archivo: "minga-3-amarrada", ruta: "/?escena=nivel&nivel=minga&punto=3&j1=&j2=&vista=28,1,-2&congelar=30" },
  { archivo: "minga-4-ancla", ruta: "/?escena=nivel&nivel=minga&punto=3&j1=&j2=&vista=29.4,2.4,-3.4&congelar=200" },
  { archivo: "minga-5-fiesta", ruta: "/?escena=nivel&nivel=minga&punto=4&j1=&j2=&vista=36,4,-5.6&congelar=640" },
  { archivo: "minga-5-meta", ruta: "/?escena=nivel&nivel=minga&punto=5&j1=&j2=&vista=49.5,3.2,-5.6&congelar=150" },
  { archivo: "minga-secreto", ruta: "/?escena=nivel&nivel=minga&j1=&j2=&vista=-19,0.6,-2.4&congelar=30" },
  // La medianoche (TU-49): el nivel 16, la Amazonía (niveles/16-medianoche; va corrido 53 m hacia −x), de noche,
  // entero y en la salida; 1. las huellas al revés en la primera bifurcación, y el Curupira en su tocón; 2. los
  // nenúfares del igarapé; 3. la montaria en el muelle, con sus remos; 4. el arbolito en su tocón, el hoyo y el
  // Curupira que lo pide, y ya plantado con el monte abierto; 5. la playa con los tres castillos y sus chisperos, y los
  // fuegos estallando sobre el río con la pareja mirándolos desde la meta. Y el delfín rosado del secreto, en el recodo
  { archivo: "medianoche-entero", ruta: "/?escena=nivel&nivel=medianoche&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "medianoche-salida", ruta: "/?escena=nivel&nivel=medianoche&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "medianoche-1-huellas", ruta: "/?escena=nivel&nivel=medianoche&j1=&j2=&vista=-48,0.6,0&congelar=60" },
  { archivo: "medianoche-1-curupira", ruta: "/?escena=nivel&nivel=medianoche&j1=&j2=&vista=-40.5,1.4,0&congelar=60" },
  {
    archivo: "medianoche-2-nenufares",
    ruta: "/?escena=nivel&nivel=medianoche&punto=1&j1=&j2=&vista=-18.6,0.4,0&congelar=60",
  },
  {
    archivo: "medianoche-3-montaria",
    ruta: "/?escena=nivel&nivel=medianoche&punto=2&j1=&j2=&vista=-5,0.6,0&congelar=60",
  },
  {
    archivo: "medianoche-4-arbol",
    ruta: "/?escena=nivel&nivel=medianoche&punto=3&j1=&j2=&vista=27,1,-0.5&congelar=60",
  },
  {
    archivo: "medianoche-4-plantado",
    ruta: "/?escena=nivel&nivel=medianoche&punto=4&j1=&j2=&vista=30,1.2,-0.5&congelar=60",
  },
  {
    archivo: "medianoche-5-playa",
    ruta: "/?escena=nivel&nivel=medianoche&punto=4&j1=&j2=&vista=48,1.2,-1&congelar=60",
  },
  { archivo: "medianoche-5-fuegos", ruta: "/?escena=nivel&nivel=medianoche&punto=5&j1=&j2=&congelar=330" },
  {
    archivo: "medianoche-secreto",
    ruta: "/?escena=nivel&nivel=medianoche&punto=1&j1=&j2=&vista=-18.4,0.6,-6.6&congelar=300",
  },
  // La pampa (TU-48): el nivel 15 (niveles/15-pampa; va corrido 52 m hacia −x), entero y en la salida; 1. el bañado
  // con la Luz esperando en la primera parada, y ya guiando por la calzada escondida; 2. la tranquera cerrada con el
  // pampero soplando, y trabada abierta; 3. el chambergo volando sobre el potrero, y ya caído con el portón abierto;
  // 4. el ombú con el pie de amigo al pie del tronco, y la rama gacha bajada; 5. la Luz posada en un poste y el
  // candil en su gancho, la Luz encerrada en el candil y la meta. Y el mate del secreto, en la copa del ombú
  { archivo: "pampa-entero", ruta: "/?escena=nivel&nivel=pampa&j1=&j2=&vista=todo&congelar=60" },
  { archivo: "pampa-salida", ruta: "/?escena=nivel&nivel=pampa&j1=andar:0.6&j2=andar:0.6&congelar=120" },
  { archivo: "pampa-1-banado", ruta: "/?escena=nivel&nivel=pampa&j1=&j2=&vista=-45,1,-0.5&congelar=60" },
  { archivo: "pampa-1-luz", ruta: "/?escena=nivel&nivel=pampa&j1=andar:0.7&j2=&vista=-43,1,-1&congelar=420" },
  { archivo: "pampa-2-tranquera", ruta: "/?escena=nivel&nivel=pampa&punto=1&j1=&j2=&vista=-12.5,1,0&congelar=200" },
  { archivo: "pampa-2-trabada", ruta: "/?escena=nivel&nivel=pampa&punto=2&j1=&j2=&vista=-12.5,1,0&congelar=60" },
  { archivo: "pampa-3-chambergo", ruta: "/?escena=nivel&nivel=pampa&punto=2&j1=&j2=&vista=3,1.8,0&congelar=200" },
  { archivo: "pampa-3-porton", ruta: "/?escena=nivel&nivel=pampa&punto=3&j1=&j2=&vista=10,1,0&congelar=120" },
  { archivo: "pampa-4-ombu", ruta: "/?escena=nivel&nivel=pampa&punto=3&j1=&j2=&vista=20,1.5,-0.5&congelar=60" },
  { archivo: "pampa-4-rama", ruta: "/?escena=nivel&nivel=pampa&punto=4&j1=&j2=&vista=23,1.8,0&congelar=60" },
  { archivo: "pampa-5-luz", ruta: "/?escena=nivel&nivel=pampa&punto=4&j1=&j2=&vista=40,1.2,-2&congelar=60" },
  { archivo: "pampa-5-candil", ruta: "/?escena=nivel&nivel=pampa&punto=5&j1=&j2=&vista=37.5,1.2,-2.3&congelar=60" },
  { archivo: "pampa-5-meta", ruta: "/?escena=nivel&nivel=pampa&punto=5&j1=&j2=&congelar=60" },
  { archivo: "pampa-secreto", ruta: "/?escena=nivel&nivel=pampa&punto=4&j1=&j2=&vista=25,4,-1.9&congelar=30" },
];
const VIDEO = { archivo: "dos", ruta: "/?escena=dos&j1=andar:0.6,izq&j2=andar:0.6,der&depurar", segundos: 5 };
const TAMANO = { width: 1280, height: 720 };
const TELEFONO = { ...devices["Pixel 7"], viewport: { width: 839, height: 412 } };
const SALIDA = "capturas";
const PUERTO = 4173;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Chromium sin ventana no tiene GPU: SwiftShader dibuja WebGL por software.
const ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function servirJuego() {
  const build = spawnSync("pnpm", ["--filter", "tuerce-juego", "build"], { stdio: "inherit" });
  if (build.status !== 0) throw new Error("no se pudo construir el juego");
  const vite = spawn(
    "node_modules/.bin/vite",
    ["preview", "--host", "127.0.0.1", "--port", String(PUERTO), "--strictPort"],
    {
      cwd: "apps/juego",
      stdio: "ignore",
    },
  );
  const base = `http://127.0.0.1:${PUERTO}`;
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (i > 100) throw new Error("vite preview no arrancó");
    await dormir(200);
  }
  return {
    base,
    cerrar: () => {
      try {
        vite.kill("SIGTERM");
      } catch {}
    },
  };
}

async function esperarListo(pagina) {
  await pagina.waitForFunction(() => window.__tuerce?.listo === true, null, { timeout: 30_000 });
  const error = await pagina
    .locator(".error")
    .textContent({ timeout: 100 })
    .catch(() => null);
  if (error) throw new Error(`el juego mostró un error: ${error}`);
  // Las letras del menú (Fraunces y Karla) llegan de Google Fonts: se esperan para que la imagen salga con ellas.
  // Primero la hoja de estilos (si la escena la pidió), así `fonts.ready` ya sabe qué letras tiene que bajar
  await pagina
    .waitForFunction(() => [...document.querySelectorAll("link[data-fuentes]")].every((l) => l.sheet), null, {
      timeout: 10_000,
    })
    .catch(() => {});
  await pagina.evaluate(() => new Promise((listo) => requestAnimationFrame(() => listo())));
  await pagina.evaluate(() => document.fonts.ready);
}

/** Lo que guarda el navegador de una toma con `ganados`: lo mismo que deja el juego al ganar (niveles/contrarreloj.ts). */
const recuerdo = (toma) => ({
  cookies: [],
  origins: [
    {
      origin: new URL(servidor.base).origin,
      localStorage: [
        {
          name: "tuerce.contrarreloj",
          value: JSON.stringify(Object.fromEntries(toma.ganados.map((nivel) => [nivel, { ganado: true }]))),
        },
      ],
    },
  ],
});

const servidor = process.env.CAPTURAS_URL
  ? { base: process.env.CAPTURAS_URL.replace(/\/$/, ""), cerrar: () => {} }
  : await servirJuego();
const resumen = { base: servidor.base, tomas: [], video: null };
let navegador;
try {
  navegador = await chromium.launch({ args: ARGS });
  await rm(SALIDA, { recursive: true, force: true });
  await mkdir(SALIDA, { recursive: true });

  const errores = [];
  const contexto = await navegador.newContext({ viewport: TAMANO });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => errores.push(e.message));
  for (const toma of TOMAS) {
    // `ganados`: en un navegador aparte que recuerda esos niveles ganados (el menú los marca); `telefono`: en un
    // Pixel 7 acostado, con los dedos; `clic`: qué apretar
    const aparte =
      toma.ganados || toma.telefono
        ? await navegador.newContext({
            ...(toma.telefono ? TELEFONO : { viewport: TAMANO }),
            ...(toma.ganados ? { storageState: recuerdo(toma) } : {}),
          })
        : null;
    const enEsta = aparte ? await aparte.newPage() : pagina;
    if (aparte) enEsta.on("pageerror", (e) => errores.push(e.message));
    await enEsta.goto(servidor.base + toma.ruta);
    await esperarListo(enEsta);
    if (toma.clic) await enEsta.click(toma.clic);
    await enEsta.screenshot({ path: join(SALIDA, `${toma.archivo}.png`) });
    await aparte?.close();
    resumen.tomas.push({ ...toma, imagen: `${toma.archivo}.png` });
    console.log(`  imagen  ${toma.archivo}.png`);
  }
  await contexto.close();

  const carpetaVideo = join(SALIDA, ".video");
  const grabando = await navegador.newContext({ viewport: TAMANO, recordVideo: { dir: carpetaVideo, size: TAMANO } });
  const enVivo = await grabando.newPage();
  enVivo.on("pageerror", (e) => errores.push(e.message));
  await enVivo.goto(servidor.base + VIDEO.ruta);
  await esperarListo(enVivo);
  await dormir(VIDEO.segundos * 1000);
  const estado = await enVivo.evaluate(() => window.__tuerce);
  await grabando.close();
  const [webm] = await readdir(carpetaVideo);
  await rename(join(carpetaVideo, webm), join(SALIDA, `${VIDEO.archivo}.webm`));
  await rm(carpetaVideo, { recursive: true });
  resumen.video = { ...VIDEO, archivo: `${VIDEO.archivo}.webm`, pasosPorSegundo: estado.pasosPorSegundo };
  console.log(`  video   ${VIDEO.archivo}.webm (${estado.pasosPorSegundo} pasos de físicas por segundo)`);

  if (errores.length) throw new Error(`errores en la página:\n${errores.join("\n")}`);
  await writeFile(join(SALIDA, "resumen.json"), `${JSON.stringify(resumen, null, 2)}\n`);
  console.log(`PASA capturas: ${resumen.tomas.length} imágenes y 1 video en ${SALIDA}/`);
} catch (e) {
  console.error("FALLA capturas:", e.message);
  process.exitCode = 1;
} finally {
  await navegador?.close();
  servidor.cerrar();
}
