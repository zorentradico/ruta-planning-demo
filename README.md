# RUTA · Planning de transporte

Demo de planificación internacional de mercancías por carretera para cinco conductores ficticios: Mikhail, Yuri, Sandu, Gavrile y Conductor 5. Cuatro camiones DAF: XF, XG, XG+ y CF.

## Uso

- Elige día, semana o mes; filtra por camión o conductor.
- Cada fila representa un camión. Los colores separan conducción, otros trabajos, pausas y disponibilidad. La anchura representa el tiempo previsto.
- Con ratón, arrastra un servicio para cambiar su inicio o pasarlo a otro camión. Conserva su conductor. El ajuste es de 15 minutos en día y de una hora en semana/mes.
- Arrastra el borde derecho para ajustar el último tramo de conducción. Las pausas y otros trabajos conservan su duración. «Deshacer» revierte el último arrastre; otra edición cancela esa posibilidad.
- Pulsa un servicio para editar conductor, camión, fecha y actividades con precisión. Esta es también la edición disponible en móvil; desliza la línea temporal para recorrerla.
- Declara los descansos por separado en «Conductores». Mover un servicio no mueve automáticamente sus descansos; cualquier solapamiento genera aviso.
- Los cambios se guardan en el navegador. Exporta/importa una copia JSON para transferirlos. No hay cuentas, servidor de datos ni sincronización entre dispositivos.

## Alcance de las comprobaciones

Es un prototipo de planificación, no un sistema de acreditación de cumplimiento ni un registro real de tacógrafo. Los ejemplos de rutas no validan distancias, velocidades o viabilidad geográfica.

Incluye comprobaciones parciales de solapamiento de conductor/camión, conducción diaria, ampliaciones, conducción semanal y bisemanal, pausas de conducción, algunos descansos diarios y semanales y posibles compensaciones pendientes. Los huecos sin información no se convierten automáticamente en descanso. La hora de base es Europe/Madrid y se tienen en cuenta los cambios de hora.

No implementa de forma integral las excepciones internacionales, el descanso fraccionado 3+9, doble tripulación, ferris/trenes, AETR, retorno, todas las compensaciones y ventanas de cuatro semanas ni los límites laborales y convenios. La situación de dos descansos semanales reducidos consecutivos exige revisión; no se declara automáticamente válida. Los datos incompletos requieren revisión, aunque no aparezca un error.

Referencias de diseño:

- [Reglamento 561/2006](https://eur-lex.europa.eu/legal-content/ES/LSU/?uri=CELEX%3A32006R0561)
- [Comisión Europea: tiempos de conducción y descanso](https://transport.ec.europa.eu/transport-modes/road/mobility-package-i/driving-rest-times_en)
- [RD 1561/1995: jornadas especiales](https://www.boe.es/buscar/act.php?id=BOE-A-1995-21346)

Antes del uso operativo: validar el motor con especialista, precisar países y modalidades, incorporar histórico real y tacógrafo, trazabilidad, usuarios, permisos, copias y base de datos privada. No introducir datos reales en el repositorio público.

## Ejecutar y publicar

No requiere dependencias ni compilación. Con Node.js instalado:

```sh
npm start
```

Abre `http://127.0.0.1:4173/`. Para verificar las reglas y transformaciones:

```sh
npm test
```

Para GitHub Pages: publicar la rama `main`, carpeta raíz. Todos los recursos del navegador usan rutas relativas. `server.mjs` es únicamente la ayuda local; GitHub Pages sirve los archivos estáticos.

## Verificación

26 pruebas automáticas de datos, reglas, límites temporales, cambio de hora y arrastre/redimensionado. Comprobaciones de navegador: edición y persistencia, filtros, desplazamiento de una hora, ajuste de 30 minutos, cambio de camión y deshacer. Revisado en tamaños de escritorio y móvil; pendiente prueba en dispositivos físicos y auditoría de accesibilidad completa.
