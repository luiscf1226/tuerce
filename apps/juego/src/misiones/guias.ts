// La guía de cada nivel de la historia: de qué se trata, qué hacer en cada tramo (del punto de control en que están
// al que sigue) y dónde buscar el secreto. La hoja de la misión (src/ui/mision.ts) muestra el tramo que va, y la
// ayuda (tecla H, o la pausa) todos. guias.test.ts revisa que cada nivel tenga un tramo por punto de control.
//
// Los textos salen de lo que pide el guion de cada nivel (niveles/<carpeta>/guion.ts): si un guion cambia lo que hay
// que hacer, se cambia acá también.
import type { Paso } from "./tablero";

export interface GuiaDeNivel {
  /** De qué se trata el nivel y dónde termina, en una línea. */
  readonly meta: string;
  /** Por dónde buscar el secreto, sin decirlo del todo. */
  readonly secreto: string;
  /** Un tramo por punto de control: `tramos[i]` lleva del punto i (0, la salida) al i + 1; el último, a la meta. */
  readonly tramos: readonly Paso[];
}

export const GUIAS: Readonly<Record<string, GuiaDeNivel>> = {
  patio: {
    meta: "Despierten en el patio, ábranse paso hasta el techo y suban al camión de la mudanza.",
    secreto: "Algo quedó colgado en el palo de mango, cerca de la escalera.",
    tramos: [
      {
        que: "Levántense",
        pista: "Esperen a despertar en el montón de trapos, levántense y caminen hasta el portón del patio.",
      },
      {
        que: "Abran el portón",
        pista:
          "Uno empuja la aldaba con los brazos alzados y no la suelta; mientras tanto, el otro empuja el portón y pasa.",
        deADos: true,
      },
      {
        que: "Carguen la escalera",
        pista:
          "Agarren la escalera, uno de cada lado, y llévenla hasta el muro sin botarla: se apoya sola. Después suban por ella.",
        deADos: true,
      },
      {
        que: "Suban el techo de lámina",
        pista: "Caminen por el techo hasta la losa sin pararse: el que se queda quieto se resbala para abajo.",
      },
      {
        que: "Salten al camión",
        pista:
          "El camión va y viene por la calle. Desde el borde de la losa, salten cuando la palangana pase abajo: el primero que cae lo frena.",
      },
    ],
  },
  pinar: {
    meta: "Crucen el pinar entre cercos, quebradas y el corral del Cadejo hasta la pulpería.",
    secreto: "El pino más alto tiene escalones: trepen hasta arriba.",
    tramos: [
      {
        que: "Pasen el cerco",
        pista:
          "Empujen el cajón contra el cerco y pongan encima el huacal del tocón. Salten al cajón, luego al huacal, y cuélguense del cerco.",
      },
      {
        que: "Crucen en el balancín",
        pista:
          "Uno se queda parado en la punta de tierra del balancín, de contrapeso; el otro camina por la tabla hasta la otra orilla.",
        deADos: true,
      },
      {
        que: "Columpíense en el bejuco",
        pista:
          "Agarren su bejuco con los brazos alzados, columpíense adelante y atrás y suéltense cuando ya estén sobre la otra orilla.",
      },
      {
        que: "Tiendan el tronco",
        pista:
          "Levanten el tronco de los caballetes entre los dos, llévenlo en fila hasta la zanja y déjenlo de orilla a orilla. Crucen por encima.",
        deADos: true,
      },
      {
        que: "Distraigan al Cadejo",
        pista:
          "Uno le tira el hueso al Cadejo y, mientras lo roe, el otro jala la tranca para atrás y la sostiene: el portón se abre y pasan.",
        deADos: true,
      },
      {
        que: "Enciendan la lámpara",
        pista:
          "Agarren la lámpara que cuelga junto a la puerta de la pulpería: se enciende, la puerta se abre y adentro está la meta.",
      },
    ],
  },
  poza: {
    meta: "Armen la balsa, remen río arriba y saquen la batea de pepitas hasta la orilla.",
    secreto: "Cuando la poza esté seca, busquen en el hoyo más hondo.",
    tramos: [
      {
        que: "Armen la balsa",
        pista:
          "Carguen entre los dos cada tronco de sus caballetes a los caballetes junto al agua. Con los tres, la balsa se arma: súbanse desde el muelle.",
        deADos: true,
      },
      {
        que: "Remen derecho",
        pista:
          "Cada uno junto a su remo, con los brazos alzados: remen los dos a la vez. Un remo solo hace girar la balsa.",
        deADos: true,
      },
      {
        que: "Corten el chorro",
        pista:
          "Uno empuja la palanca de la compuerta y la sostiene: el chorro se corta y el otro trepa el escalón y la represa.",
        deADos: true,
      },
      {
        que: "Bajen en el tendedero",
        pista:
          "Agarren con las dos manos la manija de su tendedero y bajen como en tirolesa hasta la isla. ¡No suelten a medio camino!",
      },
      {
        que: "Sequen la poza",
        pista:
          "Empujen las dos piedras redondas hasta la boca entre la isla y el peñón: el agua se va. Después bajen caminando al fondo.",
      },
      {
        que: "Lleven la batea",
        pista:
          "Cada uno agarra una punta de la batea y la suben derechita a la mesa de la orilla. Ojo: La Sucia moja al que se le acerca.",
        deADos: true,
      },
    ],
  },
  calle: {
    meta: "Suban la calle empedrada hasta el mirador y bajen en carreta hasta la plaza.",
    secreto: "El carrito del parque esconde algo: trepen su vitrina.",
    tramos: [
      {
        que: "Empujen la carreta",
        pista:
          "Pónganse los dos detrás de la carreta y empújenla cuesta arriba hasta que se trabe. Luego pasen por el lado ancho.",
        deADos: true,
      },
      {
        que: "Frenen la Carreta sin bueyes",
        pista:
          "Uno empuja el freno cuando la Carreta sin bueyes vuelve a la plazuela y lo sostiene; el otro quita los huacales del zaguán y pasa.",
        deADos: true,
      },
      {
        que: "Abran la torre del reloj",
        pista:
          "Cuélguense de las dos pesas junto a la torre hasta que lleguen abajo: las agujas marcan las doce y la puerta sube.",
      },
      {
        que: "Pasen por los balcones",
        pista:
          "Suban la escalinata al corredor alto, cuélguense de la enredadera, columpíense sobre el callejón y suéltense del otro lado.",
      },
      {
        que: "Toquen las dos campanas",
        pista:
          "Cada uno debajo de una campana: salten con los brazos alzados y cuélguense a la vez. Si suenan juntas, sube la reja.",
        deADos: true,
      },
      {
        que: "Bajen en la carreta",
        pista:
          "Súbanse los dos a la carreta del mirador, en la parte de adelante, y quédense ahí: baja sola. Si se van para atrás, se vuelca.",
        deADos: true,
      },
    ],
  },
  xibalba: {
    meta: "Abran el camino entre templos y túneles de Copán hasta la tumba del fondo.",
    secreto: "Junto al túnel hay escalones: trepen a lo alto del templo.",
    tramos: [
      {
        que: "Abran la entrada",
        pista:
          "Párense cada uno en una placa de la plancha doble, los dos a la vez: la entrada de la muralla se hunde.",
        deADos: true,
      },
      {
        que: "Giren la estela",
        pista:
          "Agarren cada uno su vara con las dos manos y caminen en círculo, empujando, hasta que el sol mire a la reja.",
        deADos: true,
      },
      {
        que: "Encesten la pelota",
        pista: "Agarren la pelota de hule, retrocedan un paso, salten y suéltenla en el aire para que pase por el aro.",
      },
      {
        que: "Suban el bloque",
        pista:
          "Carguen el bloque entre los dos grada por grada y déjenlo contra la pared del templo. Súbanse a él y trepen colgándose.",
        deADos: true,
      },
      {
        que: "Crucen el túnel",
        pista:
          "Uno lleva la antorcha con las dos manos, sin pasar bajo los murciélagos; el otro lo sigue de cerca con la llave hasta la puerta.",
        deADos: true,
      },
      {
        que: "Abran la tumba",
        pista:
          "Lleven las dos piedras de la repisa al plato del contrapeso: con las dos, la losa sube del todo y pueden entrar.",
      },
    ],
  },
  tren: {
    meta: "Sigan la vía del tren bananero, entre vagones, dresina y racimos, hasta el portón final.",
    secreto: "¿Y si la dresina sigue derecho en el cambio de vía?",
    tramos: [
      {
        que: "Enganchen los vagones",
        pista:
          "Empujen la plataforma por la vía hasta el furgón: al engancharse, el tren se va y deja libre el paso a nivel.",
      },
      {
        que: "Bombeen la dresina",
        pista:
          "Súbanse a la dresina, cada uno frente a su manija. Cuando la suya está arriba, agárrenla y bájenla; suelten y le toca al otro.",
        deADos: true,
      },
      {
        que: "Cuiden el cambio de vía",
        pista:
          "Uno mueve la palanca del cambio y se queda mirándola, o el Duende la regresa; el otro baja en la dresina hasta el bananal.",
        deADos: true,
      },
      {
        que: "Enganchen el racimo",
        pista:
          "Uno sostiene la palanca de la grúa para que baje el gancho; el otro alza el racimo grande hasta el gancho. Suelten y va a la tolva.",
        deADos: true,
      },
      {
        que: "Pesen los racimos",
        pista:
          "Lleven los tres racimos a la romana y suéltenlos alzados junto a sus ganchos: con el peso, el puente baja y cruzan el canal.",
      },
      {
        que: "Devuélvanle el sombrero",
        pista:
          "Lleven el sombrero de la garita al Duende y suéltenlo frente a él: así deja las palancas. Muevan las dos y pasen el portón.",
      },
    ],
  },
  rio: {
    meta: "Crucen la selva del Río Plátano hasta la entrada de la ciudad perdida.",
    secreto: "En el templo de la ciudad perdida, detrás de la meta, miren arriba.",
    tramos: [
      {
        que: "Crucen en el pipante",
        pista:
          "Uno va atrás con los brazos alzados y empuja con la pértiga. El otro va adelante con los brazos alzados y mira hacia donde quieren ir.",
        deADos: true,
      },
      {
        que: "Pasen los rápidos",
        pista:
          "Bajan troncos por tres carriles y el que los toca cae al agua. Esperen entre carril y carril, y crucen justo después de que pase cada tronco.",
      },
      {
        que: "Sigan las huellas al revés",
        pista:
          "El Sisimite tiene los pies al revés: vayan por donde los dedos de las huellas apuntan hacia ustedes. Las otras huellas acaban en el lodazal.",
      },
      {
        que: "Arreglen el puente colgante",
        pista:
          "Cada tabla pesa mucho para uno. Agárrenla los dos con la mano derecha, llévenla en fila y suéltenla atravesada sobre cada hueco del puente.",
        deADos: true,
      },
      {
        que: "Trepen al Sisimite dormido",
        pista:
          "Cuélguense de sus pies y canillas, y caminen por las piernas y la panza hasta el pecho. No le caigan encima ni le pisen la cara: se despierta.",
      },
      {
        que: "Vuelen con la palmera",
        pista:
          "Uno jala la soga hacia atrás y el otro se mete en el cogollo; al soltar, vuela. Allá agarra la liana y la suelta, y el otro cruza colgado de ella.",
        deADos: true,
      },
    ],
  },
  trenzas: {
    meta: "Recorran Antigua y devuélvanle su sombrero al Sombrerón para que aparezca la meta.",
    secreto: "Algo vuela en lo alto del campanario de la plaza del Sombrerón.",
    tramos: [
      {
        que: "Desaten el nudo",
        pista:
          "Cada uno agarra un cabo de la cuerda y los dos caminan hacia atrás al mismo tiempo. Si jala uno solo, el nudo se aprieta.",
        deADos: true,
      },
      {
        que: "Carguen y lleven la mula",
        pista:
          "Sin carga la mula no camina. Suelten los dos bultos junto a su lomo; después agarren la rienda y llévenla caminando hasta el mesón.",
      },
      {
        que: "Crucen las ruinas",
        pista: "El piso de la iglesia se hundió. Salten de arco caído en arco caído sin caer abajo.",
      },
      {
        que: "Apaguen las piedras",
        pista:
          "Uno trepa el muro caído. El otro llena el balde en la fuente y se lo pasa por encima del pretil, sin soltarlo. El de allá apaga las dos piedras.",
        deADos: true,
      },
      {
        que: "Devuelvan el sombrero",
        pista:
          "Empujen el sombrero cuesta arriba, caminando contra él, hasta la plaza. Si lo dejan, rueda para abajo. Sin sombrero, el Sombrerón los enreda.",
      },
    ],
  },
  cafetal: {
    meta: "Suban por el cafetal hasta el beneficio y pasen el portillo donde está el Cipitío.",
    secreto: "Detrás de la meta hay una piedra grande que vale la pena trepar.",
    tramos: [
      {
        que: "Lancen y atrapen canastos",
        pista:
          "Uno agarra un canasto en el tapesco, salta y lo suelta en el aire. El otro lo atrapa en el patio y lo vacía en el recibidero. Tres bajan el portón.",
        deADos: true,
      },
      {
        que: "Usen las piedras del Cipitío",
        pista:
          "El muro es muy alto. Párense al pie y esperen: el Cipitío les tira una piedra a los pies. Súbanse a ella y trepen colgándose.",
      },
      {
        que: "Zarandeen hasta la llave",
        pista:
          "Cada uno agarra una manija de la zaranda: uno jala mientras el otro empuja, y al revés. La llave cae atrás; llévenla al candado de la puerta.",
        deADos: true,
      },
      {
        que: "Suban los costales",
        pista:
          "Cuelguen un costal del gancho de la polea. Después salten y cuélguense de la manija: el costal sube a la troja. Con los dos arriba, se abre la puerta.",
      },
      {
        que: "Denle un guineo al Cipitío",
        pista:
          "Sin guineo, el Cipitío los tumba a piedrazos. Agarren el guineo de la mata, llévenselo y suéltenlo delante de él: se lo come y los deja pasar.",
      },
    ],
  },
  canales: {
    meta: "Naveguen los canales de Xochimilco y lleven las flores hasta el embarcadero de la feria.",
    secreto: "En la ciénaga, algo duerme en la chinampa del fondo.",
    tramos: [
      {
        que: "Empujen la trajinera",
        pista:
          "Párense los dos atrás, uno de cada lado, y alcen los brazos para empujar con su pértiga. Para girar, empuja solo uno. Con una sola pértiga no avanza.",
        deADos: true,
      },
      {
        que: "Hagan reír a La Llorona",
        pista:
          "Trepen la tarima y tírense delante de ella: se ríe. Con tres risas, sin esperar mucho, baja el agua y la trajinera ya pasa bajo el puente.",
        deADos: true,
      },
      {
        que: "Crucen las chinampas",
        pista:
          "Las chinampas se hunden con alguien encima, y con los dos más rápido. Salten de una a otra sin quedarse quietos.",
      },
      {
        que: "Rompan la piñata",
        pista:
          "Uno agarra la manija de la soga y camina hacia atrás para bajar la piñata. Mientras la sostiene, el otro salta con los brazos alzados y le pega.",
        deADos: true,
      },
      {
        que: "Lleven las flores",
        pista:
          "Empujen la trajinera de las flores con las dos pértigas, despacito. Si chocan contra una chinampa o el muelle, se cae una flor al agua.",
        deADos: true,
      },
    ],
  },
  garrucha: {
    meta: "Crucen las montañas del Eje cafetero hasta la otra orilla del cañón.",
    secreto: "Detrás de la meta hay una palma más alta que todas. ¿Qué habrá arriba?",
    tramos: [
      {
        que: "Crucen en la garrucha",
        pista:
          "Uno se sube a la canasta. El otro agarra la manija, camina hacia atrás, la suelta y vuelve a jalar. Arriba, el que llegó jala para subir al otro.",
        deADos: true,
      },
      {
        que: "Gánenle a la Patasola",
        pista:
          "Al cruzar la salida, la Patasola arranca. Corran sin pararse y salten las zanjas. Si ella gana, igual pueden seguir.",
      },
      {
        que: "Lleven la carga en la chiva",
        pista:
          "Agarren la carga entre los dos, uno de cada lado, y súbanla al techo de la chiva. Con los dos arriba arranca; no la suelten en los baches.",
        deADos: true,
      },
      {
        que: "Trepen la palma de cera",
        pista:
          "Agarren la manea del tronco con las dos manos y caminen hacia adelante para subir; hacia atrás, bajan. Arriba, la manea baja sola para el otro.",
      },
      {
        que: "Crucen de liana en liana",
        pista:
          "Salten a la liana, cuélguense con las dos manos y colúmpiense. Suéltenla cuando estén sobre el piso de enfrente. Son tres lianas.",
      },
    ],
  },
  llano: {
    meta: "Encuentren al Silbón en la sabana y devuélvanle su saco: ahí aparece la meta.",
    secreto: "Detrás de la tapia del conuco, a la sombra del samán, hay música.",
    tramos: [
      {
        que: "Encuentren al Silbón",
        pista:
          "Silba al revés: fuerte cuando está lejos y bajito cuando está cerca, y suena del lado contrario. Caminen hacia la mata donde suena más bajito.",
      },
      {
        que: "Frenen el molino",
        pista:
          "Uno empuja la palanca del freno y no la suelta: las aspas paran como rampa. El otro sube por ellas, baja por las pacas y saca la tranca del portón.",
        deADos: true,
      },
      {
        que: "Arreen el ganado",
        pista:
          "Las reses se apartan del que se acerca. Caminen despacio detrás de ellas hasta meter las tres en el corral.",
      },
      {
        que: "Vuelen con la hamaca",
        pista:
          "Uno jala la cabuya hacia atrás y el otro se mete en la hamaca; al soltar, sale volando. Allá empuja la palanca y baja el puente para el otro.",
        deADos: true,
      },
      {
        que: "Devuelvan el saco",
        pista:
          "Trepen la troja colgándose, agarren el saco con las dos manos y bájenlo. Suéltenlo junto al Silbón, que espera al lado de su rancho.",
      },
    ],
  },
  puente: {
    meta: "Tejan un puente inca, rieguen las terrazas y lleven la llama hasta el tambo.",
    secreto: "Trepen las piedras del pedregal, cerca de la cuerda del principio.",
    tramos: [
      {
        que: "Trencen la cuerda",
        pista:
          "Cada uno agarre un torcedor con las dos manos y giren para lados contrarios. No suelten hasta que se trence: así baja la puerta.",
        deADos: true,
      },
      {
        que: "Tiendan el puente",
        pista:
          "Uno agarre la soga del puente y jale caminando para atrás; el otro sostenga el amarre del estribo. Sin amarrar, el puente no tiene piso.",
        deADos: true,
      },
      {
        que: "Crucen el puente de a uno",
        pista:
          "Caminen despacio y párense cuando el puente se mece mucho. Si corren o suben los dos juntos, se voltea y caen al cañón.",
      },
      {
        que: "Rieguen las tres terrazas",
        pista:
          "El agua sale por la primera bocatoma abierta. Cierren la de arriba y abran la del medio; luego, la de abajo. Jalen para abrir, empujen para cerrar.",
      },
      {
        que: "Lleven la llama al tambo",
        pista:
          "Agarren la rienda frente a su cabeza y caminen despacio: si la rienda se estira, esperen. Si la apuran o la empujan por detrás, escupe.",
      },
    ],
  },
  mina: {
    meta: "Crucen la mina con ayuda del Tío y bajen en vagoneta hasta el salar.",
    secreto: "En la galería vieja, junto al pozo, trepen una repisa.",
    tramos: [
      {
        que: "Desvíen la vagoneta",
        pista:
          "Uno empuje la palanca del cambio y no la suelte; el otro empuje la vagoneta por detrás. Por el desvío llega a la báscula y sube la reja.",
        deADos: true,
      },
      {
        que: "Suban por el pozo",
        pista:
          "Uno se cuelga de la manija de la polea de abajo y la jaula sube al otro. Arriba, ese se cuelga de la manija de arriba y sube al primero.",
        deADos: true,
      },
      {
        que: "Llévenle la ofrenda al Tío",
        pista:
          "Agarren la ofrenda de la repisa y llévenla en zigzag sin pasar por las velas. Suéltenla frente al Tío: se la queda y abre su puerta.",
      },
      {
        que: "Alumbren el sol de piedra",
        pista:
          "Cada uno empuje un espejo de costado hasta su tope y sosténganlos a la vez: la luz llega al sol de piedra y sube la puerta.",
        deADos: true,
      },
      {
        que: "Bajen en la vagoneta",
        pista:
          "Métanse los dos en la vagoneta de la boca de la mina: se suelta el freno y los lleva cuesta abajo por los rieles hasta el salar.",
      },
    ],
  },
  minga: {
    meta: "Ayuden en la minga de Chiloé y suban al Caleuche, el barco fantasma de fiesta.",
    secreto: "Algo huele rico bajo la arena, detrás del segundo palafito.",
    tramos: [
      {
        que: "Crucen antes de la marea",
        pista:
          "Con la marea alta la playa se tapa. Esperen en el corredor de cada palafito y crucen la arena cuando el agua baje.",
      },
      {
        que: "Muevan la casa",
        pista:
          "Cada uno agarre un cabo de la casa y caminen para atrás, juntos y derecho. Uno solo no la mueve, y si tiran torcido se sale de los troncos.",
        deADos: true,
      },
      {
        que: "Amarren la chalupa",
        pista:
          "Tomen los cabos del poste del muelle. Cada uno lleve el suyo a su bita y sosténganlo ahí a la vez: la chalupa se arrima al muelle.",
        deADos: true,
      },
      {
        que: "Suban por el ancla",
        pista:
          "Crucen la chalupa y párense sobre los brazos del ancla: la suben hasta la borda del Caleuche. Entren a la cubierta por el portalón.",
      },
      {
        que: "Bailen sin caerse",
        pista:
          "Con los dos a bordo suena la música y el barco se mece. Quédense cerca del medio hasta el final: si alguien cae, la canción vuelve a empezar.",
        deADos: true,
      },
    ],
  },
  pampa: {
    meta: "Sigan a la Luz Mala por la pampa y enciérrenla en un candil para alumbrar el camino.",
    secreto: "Alguien olvidó su mate bien arriba, en la copa del ombú.",
    tramos: [
      {
        que: "Sigan a la Luz Mala",
        pista:
          "El camino está escondido bajo el agua: pisen solo donde se para la Luz. Si vuela ladeada, se equivocó; esperen a que vuelva.",
      },
      {
        que: "Pasen la tranquera",
        pista:
          "Uno abre la tranquera de la manija y la sostiene contra el viento; el otro pasa y corre el pasador. Ya trabada, pasa el que la sostenía.",
        deADos: true,
      },
      {
        que: "Bajen el chambergo",
        pista:
          "Descuelguen las boleadoras. Cuando el sombrero pase bajo y cerca, salten y suéltenlas en el aire. Enredado, cae y se abre el portón.",
      },
      {
        que: "Suban al ombú",
        pista:
          "Uno se para junto al tronco con los brazos alzados; el otro pisa sus manos y trepa a la horqueta. Allá, empuje la palanca: baja la rama.",
        deADos: true,
      },
      {
        que: "Atrapen la Luz en el candil",
        pista:
          "Descuelguen el candil y acérquense con él en la mano a la Luz posada en un poste. Sin candil, se espanta. Encerrada, aparece la meta.",
      },
    ],
  },
  medianoche: {
    meta: "Crucen la Amazonía de noche y prendan los fuegos de Año Nuevo a la medianoche.",
    secreto: "Salten nenúfares fuera del camino, hacia el recodo del río.",
    tramos: [
      {
        que: "Sigan las huellas",
        pista:
          "El Curupira tiene los pies al revés: vayan por la trocha donde los dedos de las huellas apuntan hacia ustedes. La otra acaba en el agua.",
      },
      {
        que: "Crucen por los nenúfares",
        pista:
          "Salten de hoja en hoja hasta el muelle de la canoa. Las hojas se ladean con el peso: salten cuando la siguiente quede cerca.",
      },
      {
        que: "Remen al mismo ritmo",
        pista:
          "Súbanse los dos a la canoa, uno adelante y otro atrás. Alcen los brazos a la vez para remar: si no van juntos, la corriente los lleva.",
        deADos: true,
      },
      {
        que: "Planten el arbolito",
        pista:
          "El arbolito pesa mucho: agárrenlo uno de cada lado y llévenlo al hoyo del claro. Suéltenlo encima: el Curupira se alegra y abre el monte.",
        deADos: true,
      },
      {
        que: "Prendan los fuegos",
        pista:
          "En el castillo grande, cada uno agarre un chispero y no lo suelte hasta que prenda la mecha. Con uno solo, apenas chispea.",
        deADos: true,
      },
    ],
  },
};
