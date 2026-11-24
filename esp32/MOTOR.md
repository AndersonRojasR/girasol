# Motor JGA25-370 12 V / 1000 RPM con L298N

Usa el mismo sketch `control_led/control_led.ino`, ahora acompañado de `motor_control.h`. Mantiene los endpoints del LED. Requiere **Arduino ESP32 core 3.x** (`ledcAttach` / `ledcWrite` por pin), placa ESP32 clásica con GPIO 25/26/27/32/33 disponibles.

## Alimentación y primera prueba

La fuente disponible es 12 V / 1 A. La ficha del vendedor publica un pico de bloqueo de 1 A: no hay margen garantizado para arranque, pérdidas y carga. No se garantiza su funcionamiento ni la precisión con esa fuente. La limitación PWM a 90/255 no limita corriente instantánea. El firmware no tiene sensor de corriente y no reemplaza protección eléctrica. Si el motor no arranca, no aumentes PWM a ciegas; revisa alimentación y carga. Corta alimentación ante calentamiento, vibraciones o reinicios.

Conecta con todo desconectado. Primera prueba con motor sujeto, eje libre, sin acoplar cargas ni mecanismos. Una entrada de parada por HTTP no sustituye cortar físicamente la alimentación del motor. Esta versión no debe mover mecanismos con riesgo de atrapamiento ni cargas verticales: al parar, deshabilita el puente y NO sostiene posición.

## Cableado

| Señal | Conexión |
| --- | --- |
| Fuente +12 V | Bornera de alimentación +12 V del L298N |
| Fuente negativo | GND L298N y GND ESP32 común |
| Motor, dos terminales de potencia | OUT3 y OUT4 del L298N, NO a GPIO ni al GND del encoder |
| L298N ENB | ESP32 GPIO25; retirar el jumper ENB |
| L298N IN3 | ESP32 GPIO26 |
| L298N IN4 | ESP32 GPIO27 |
| Encoder A | ESP32 GPIO32 |
| Encoder B | ESP32 GPIO33 |
| Encoder VCC | ESP32 3V3, si tu unidad admite 3.3 V como publica la ficha |
| Encoder GND | GND común |
| ESP32 | Alimentación USB independiente |

Se recomienda resistencia externa de 10 kΩ entre ENB y GND para mantener el puente deshabilitado durante reset. No conectar 12 V a la ESP32. No conectar el terminal 5 V del módulo L298N a 3V3 ni a la alimentación USB de la ESP32. El jumper de regulador **5V-EN** es distinto al de **ENB**: verifica el manual de tu módulo para alimentar su lógica; no presupongas que todos los módulos tienen el mismo regulador o rango admitido. Verifica diodos de protección y disipador del módulo.

La ficha de la variante de Naylamp identifica los pines del conector: 1 Motor−, 2 Encoder GND, 3 Encoder A, 4 Encoder B, 5 Encoder VCC, 6 Motor+. Confirma orientación y numeración con la unidad real; no deduzcas las funciones solo por colores. Nunca introducir señales de 5 V a los GPIO de la ESP32.

## Calibración obligatoria

El encoder se cuenta en **x1** (flanco ascendente de A y sentido según B). La ficha comercial es contradictoria: anuncia relación 1:12 y también una resolución calculada con otra relación. No hay un valor por defecto en firmware. No se habilita movimiento sin cuentas por vuelta y referencia de cero.

1. Sube el firmware, comprueba `/motor/estado` en la IP de la ESP32 y abre `/motor` en el dashboard. Sin calibrar verás cuentas pero posición desconocida.
2. Determina las cuentas x1 por vuelta del **eje de salida** usando la ficha exacta del proveedor o una medición independiente supervisada. Si el motor está totalmente desconectado de potencia y la reductora permite giro manual suave, anota cuentas, gira exactamente una vuelta y toma el valor absoluto de la diferencia. No fuerces una reductora que no sea reversible. Para valores fraccionarios mide varias vueltas y divide.
3. Si se confirma una reductora 12:1 y 11 pulsos por vuelta interna de A, el cálculo x1 sería 132; es un ejemplo condicionado, no una calibración confirmada para tu motor. No uses cuentas de decodificación x4 con este firmware.
4. Introduce las cuentas por vuelta en la vista Motor y pulsa Aplicar calibración. Coloca la referencia y pulsa Establecer cero aquí. No hay homing automático.
5. Prueba un movimiento pequeño sin carga. Si indica sentido invertido, pulsa Detener, invierte la polaridad de accionamiento en la pantalla y vuelve a calibrar/establecer cero. Comprueba visualmente que el eje y la lectura coinciden.
6. Calibración y referencia se pierden al reiniciar la ESP32; deben establecerse de nuevo. No se persiste una falsa posición absoluta en flash.

El control es proporcional con límite de PWM, zona de llegada de una cuenta y parada al cruzar objetivo. No es un servo industrial: inercia, holgura, baja resolución y carga afectan precisión. No sostiene el eje después de llegar. Una marca de cero manual no permite conocer posición absoluta tras apagar.

## API

GET `/motor/estado`: `ticks`, `countsPerTurn`, `position` (grados o null), `target` (grados o null), `referenced`, `moving`, `invert`, `fault`.

POST con formulario `application/x-www-form-urlencoded`:

- `/motor/config`: `countsPerTurn` (1–100000), `invert` (true/false). Solo detenido; invalida referencia.
- `/motor/zero`: establece cero, solo detenido y calibrado.
- `/motor/target`: `degrees` entre −360 y +360 desde cero. Solo calibrado, referenciado, sin fallo y detenido.
- `/motor/stop`: deshabilita puente y limpia fallo. Disponible incluso mientras hay otra solicitud en el navegador.

La vista consulta cada 300 ms tras terminar la petición. La ESP32 detiene por Wi-Fi desconectado, 1.5 s sin consultas de estado del motor, 600 ms sin pulsos, movimiento en dirección opuesta o 10 s de movimiento. Cerrar la vista o pestaña detiene por ausencia de consultas, salvo que otro navegador mantenga consultas. El límite de 10 s siempre aplica; cualquier cliente autorizado en la LAN puede parar o dar órdenes. No hay arbitraje ni autenticación. El LED mantiene su polling independiente.

El modo DEMO simula motor y referencia localmente, identificado como simulación. Las paradas de software no son protección certificada ni detectan todos los fallos de encoder.

## Referencias

- Ficha del vendedor: https://naylampmechatronics.com/motores-dc/798-motor-dc-jga25-370-12v1000rpm-con-encoder.html
- PWM Arduino ESP32: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html
