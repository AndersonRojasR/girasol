# Mapeo del recorrido con dos finales de carrera

El firmware activo usa `stepper_limits.h`: paso a paso bipolar con L298N y dos finales mecánicos de contacto seco **normalmente cerrados (NC)**. Se mantiene el control del LED. Este mapeo NO corrige el temblor ni los pasos perdidos: no calibres un mecanismo que se atasca o que todavía no gira de forma fiable. No hay encoder; el recorrido se estima contando pasos entre dos referencias físicas.

## Conexiones adicionales

Con toda alimentación desconectada:

| Final | Contacto COM | Contacto NC |
| --- | --- | --- |
| Mínimo | GND común | ESP32 GPIO32 |
| Máximo | GND común | ESP32 GPIO33 |

No uses el terminal NO con esta configuración. No conectes alimentación de 5 V o 12 V a estas entradas. Estos pines sustituyen las entradas del antiguo encoder; desconéctalo. Si tienes módulos electrónicos con VCC/GND/OUT en lugar de interruptores mecánicos, hay que verificar su voltaje y polaridad antes de usarlos: esta tabla no se aplica directamente.

El firmware configura INPUT_PULLUP: sin pulsar, NC une el GPIO a GND (LOW, libre); al pulsar, el contacto se abre (HIGH, activo). Un cable desconectado también aparece activo. Mantén cables cortos y separados de los cables del motor; para entornos ruidosos se necesita acondicionar las entradas según la instalación. El pull-up interno no sustituye un circuito de seguridad.

El resto de conexiones sigue en [STEPPER.md](STEPPER.md): ENA→14, IN1→18, IN2→19, ENB→25, IN3→26, IN4→27. OUT1 amarillo, OUT2 rojo, OUT3 naranja y OUT4 negro. Retira jumpers ENA/ENB y mantén GND común. ESP32 por USB, motor por fuente externa. No cambia la excitación PWM ni garantiza margen de corriente de la fuente de 1 A.

## Montaje y prueba previa SIN mover el motor

1. Monta un interruptor en cada extremo para que el mecanismo lo accione ANTES de chocar contra un tope duro. Debe quedar espacio de sobrecarrera; no dependas de llegar a una pared para parar.
2. Abre `control_led/control_led.ino` y vuelve a subirlo con `stepper_limits.h` y `secrets.h` en la misma carpeta. `USE_STEPPER_MOTOR` debe estar en 1.
3. Mantén inicialmente desconectada la potencia del motor. Abre `/motor` en el dashboard, selecciona ESP32 real y verifica la IP de la ESP32 en Configuración.
4. Los dos indicadores deben mostrar Libre. Presiona y suelta cada interruptor a mano: SOLO el indicador correspondiente debe pasar a Activo y luego volver a Libre. Un circuito abierto no permite distinguir entre interruptor pulsado y cable roto.
5. No inicies el mapeo si los estados son incorrectos, ambos están activos, no sabes el sentido de giro, hay contactos intermitentes o el mecanismo todavía tiembla. Comprueba el sentido con el mecanismo desacoplado y las bobinas sin carga; la opción Invertir sentido cambia la secuencia física. No simules finales puenteándolos durante una prueba de recorrido real.

## Uso

1. Tras comprobar lo anterior, coloca el mecanismo entre extremos y conecta la alimentación del motor. Mantén disponible una desconexión física de su potencia.
2. Marca la casilla de comprobación y pulsa **Mapear recorrido**. Esto mueve el motor; no es una comprobación pasiva. Supervisa todo el proceso y conserva la pantalla visible.
3. Busca el mínimo lentamente, detiene nuevos pasos al abrirse el contacto y confirma estabilidad durante 25 ms. Se dirige al máximo contando pasos; después retrocede para liberarlo y dejar un margen.
4. Si inicia con un extremo pulsado, primero intenta alejarse para liberarlo y luego busca el mínimo. Esta maniobra se limita a 200 pasos. Un cable abierto puede parecer un extremo pulsado y provocar este intento limitado de retirada: no hay diagnóstico infalible de rotura con un solo contacto NC.
5. Al finalizar muestra los pasos entre activaciones y los pasos del recorrido útil. El extremo mínimo útil es 0 %, el máximo útil 100 %. Termina cerca del máximo útil, con los dos interruptores libres.
6. Selecciona, por ejemplo, 50 % y pulsa Mover. La ESP32 valida el rango 0–100 % y convierte el objetivo a pasos enteros. No necesitas pasos por vuelta para este control relativo del recorrido; no se muestra una distancia en mm sin conocer la transmisión.

El margen es de **5 pasos adicionales desde el punto donde se confirma la liberación de cada interruptor**, definido en `LIMIT_MARGIN_STEPS`. No es una distancia física garantizada: ajústalo y verifica la sobrecarrera según el mecanismo antes de usarlo. La histéresis y rebote del interruptor hacen que el número útil sea menor que el de activación a activación.

## Límites y recuperación

- A lo sumo 50 pasos/s, una bobina activa, PWM 90/255. Si las operaciones HTTP demoran, no se envían nuevos pasos mientras el bucle está ocupado. No hay generación de pasos independiente ni garantía de tiempo real; las bobinas pueden quedar energizadas durante esperas de red. Las protecciones se revisan al volver al bucle y antes de ordenar el siguiente paso.
- Una entrada activa bloquea nuevos pasos HACIA su extremo sin esperar el antirrebote. Durante la referenciación se permite alejarse del interruptor que se está liberando. Ambos activos o el extremo inesperado provocan fallo. Durante movimientos normales, cualquiera activo invalida el mapa y detiene el motor.
- Límites: 120 s por movimiento o mapeo, 10000 pasos acumulados de búsqueda y 200 pasos para liberar un interruptor. La ausencia de consultas de motor durante 1.5 s o desconexión Wi-Fi también detiene. Son límites de software evaluados por el bucle; no sustituyen topes, protección eléctrica ni parada de emergencia.
- Detener a mitad de movimiento o del mapeo invalida la referencia. No hay movimiento automático después de un fallo; vuelve a mapear. Cambiar la configuración anterior del motor también invalida el mapa.
- Tras reiniciar se pierde todo el mapa. Nunca se restaura una posición supuestamente absoluta desde localStorage. El mapa vive en la ESP32; todas las pantallas en modo real ven el mismo estado. DEMO es independiente por navegador, con un rango ficticio identificado como simulación.
- No se sostiene el eje al detenerse. Si se desplaza por una fuerza externa o pierde pasos, la posición intermedia es incorrecta aunque los finales funcionen: vuelve a mapear. No utilizar para cargas verticales ni mecanismos peligrosos.
- Si un final se queda cerrado por avería, la electrónica no puede saber que el extremo se alcanzó. Los límites de tiempo/pasos no garantizan evitar una colisión. Para seguridad mecánica se requieren protecciones independientes.

## API

- `POST /motor/home`, formulario `invert=true|false`: inicia mapeo supervisado, rechaza motor ocupado, entradas aún inestables o ambos finales activos.
- `POST /motor/target`, formulario `percent=0..100`: solo con mapa válido. Ya no admite órdenes en grados para el paso a paso.
- `POST /motor/stop`: detiene y, si se interrumpió movimiento, invalida el mapa.
- `GET /motor/estado`: conserva campos anteriores y añade `limitMinimum`, `limitMaximum` (contacto abierto), `homing`, `travelSteps`, `switchSpanSteps`, `positionPercent`, `targetPercent`. Porcentajes null cuando no hay referencia.
- `POST /motor/zero`: devuelve 409 para paso a paso; solo el mapeo establece los extremos.

`stepper_control.h` conserva la versión anterior sin finales, pero no está incluida por el sketch activo. `motor_control.h` conserva el motor DC y sigue disponible con `USE_STEPPER_MOTOR 0`; su pantalla está en `/motor-dc`.

## Verificación de software

Desde `frontend`, `node scripts/test-travel.cjs` comprueba la simulación: bloqueo antes de mapear, extremos del rango, rechazo fuera de rango e invalidación tras parada. `npm.cmd test` incluye además integración de la pantalla. Estas pruebas no verifican el cableado, la mecánica ni el firmware sobre una ESP32 física.
