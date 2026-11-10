# prototipo

`tuerce.html` es la propuesta con la demo 2D para dos jugadores (fragmento de artifact: se publica en https://claude.ai/artifact/P9kmTojq7XBSg4m3vTfWmZ).

Tiene la imagen del juego (`docs/arte/11-pinar` a `14-personajes`): niebla clara por capas, siluetas de trapo oscuro,
grano fino y los pañuelos rojo y turquesa como único color. Es un solo archivo: las imágenes van adentro como JPEG en
data URI (recomprimidas para que pese menos de 2 MB) y el resto (bosque, muñecos, niebla, grano) se dibuja con
canvas. J1 juega con A/D/W/E y J2 con las flechas y Enter; en el cel cada quien tiene su control táctil.
