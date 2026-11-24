# Paso a paso 42H40H-0504AW7 con ESP32 y L298N

**Actualización:** el sketch activo ahora exige dos finales NC y mapeo del recorrido. Sigue [FINALES-DE-CARRERA.md](FINALES-DE-CARRERA.md) para el procedimiento actual. Las instrucciones de grados y cero manual que siguen documentan la versión anterior `stepper_control.h`, conservada como referencia, no incluida por defecto.

El usuario confirma alimentación nominal de 12 V y mide aproximadamente 10 Ω en cada bobina. No se ha obtenido ficha verificable del modelo exacto: corriente por fase y ángulo por paso siguen sin confirmar. El valor de resistencia no determina la corriente admisible. La fuente disponible es 12 V / 1 A; no se garantiza su margen bajo carga. El límite PWM del firmware NO mide ni regula la corriente de las bobinas. La compatibilidad eléctrica no se considera verificada solo por confirmar 12 V.

## Firmware

Abre y sube `control_led/control_led.ino`, con `secrets.h`, `stepper_control.h` y `motor_control.h` en la misma carpeta. Ahora `USE_STEPPER_MOTOR` vale 1: selecciona paso a paso. El driver DC anterior sigue en `motor_control.h`; para volver a él cambia la macro a 0, restaura su cableado y vuelve a cargar. Nunca conectes el paso a paso usando el firmware DC.

Requiere Arduino ESP32 core 3.x. El LED sigue funcionando en GPIO 2 y la API de motor conserva `/motor/estado`, `/motor/config`, `/motor/zero`, `/motor/target` y `/motor/stop`.

## Cableado completo, con alimentación desconectada

Se conserva el canal B que ya estaba cableado. Hay que AÑADIR el canal A:

| L298N | Conexión |
| --- | --- |
| OUT1 | Amarillo |
| OUT2 | Rojo |
| OUT3 | Naranja |
| OUT4 | Negro |
| ENA | ESP32 GPIO14 |
| IN1 | ESP32 GPIO18 |
| IN2 | ESP32 GPIO19 |
| ENB | ESP32 GPIO25 |
| IN3 | ESP32 GPIO26 |
| IN4 | ESP32 GPIO27 |
| GND | GND ESP32 y negativo de fuente, todos comunes |
| Alimentación de potencia +12 V | Fuente externa, no GPIO |

Retira AMBOS jumpers ENA y ENB: no deben unir 5 V con los GPIO. Son distintos del jumper del regulador 5V-EN; la alimentación lógica depende del módulo concreto y debe seguir su documentación. No conectar la salida 5 V del módulo a 3V3 ni al USB de la ESP32. ESP32 alimentada por USB. Desconecta el encoder anterior: este motor no lo utiliza. Se recomiendan resistencias de 10 kΩ de ENA y ENB a GND para mantener ambos puentes deshabilitados durante reset.

Las dos bobinas deben estar aisladas entre sí. Si siguen apareciendo resistencias de cientos de kΩ con todo desconectado, sin tocar puntas y con el multímetro comprobado, revisa conexiones/aislamiento antes de alimentar.

## Posición y puesta en marcha

1. Sube firmware y comprueba `/motor/estado` en la IP de la ESP32. Debe incluir `"kind":"stepper"`.
2. Abre `/motor` en el dashboard y verifica modo ESP32 real en Configuración. La pantalla debe indicar Motor paso a paso y posición **estimada**, no medida.
3. Introduce pasos COMPLETOS por vuelta, según el ángulo de la ficha/etiqueta: `360 / ángulo`. Por ejemplo, solo si se confirma 1.8° son 200; si se confirma 0.9° son 400. No se presume ninguno para este modelo. No hay microstepping.
4. Pulsa Aplicar calibración, coloca una referencia mecánica con las bobinas liberadas y pulsa Establecer cero aquí. No hay búsqueda automática de origen. El primer accionamiento puede alinear el rotor con una fase y desplazarlo ligeramente: el cero manual no proporciona precisión absoluta.
5. Primera prueba sin mecanismo ni carga, eje libre y motor sujeto; objetivo pequeño. Comprueba visualmente el sentido y desplazamiento. Invertir polaridad invierte la secuencia; después de modificar configuración hay que restablecer cero.
6. El eje se libera al terminar: no sostiene cargas. Si se mueve a mano o pierde pasos, la posición calculada deja de coincidir con la real; establece cero de nuevo. No se detectan atascos sin encoder.

Para probar la pantalla sin alimentar motor, usa DEMO. Los pasos por vuelta usados en las pruebas de software son ejemplos matemáticos de simulación, no parámetros confirmados del motor real.

## Funcionamiento y límites

- Secuencia de paso completo con UNA bobina activa, sin doble excitación. 50 pasos/s como máximo; si HTTP tarda, los pasos se ralentizan en vez de acumularse de golpe. PWM fijo inicial 90/255 a 1 kHz para reducir excitación; no equivale a un límite garantizado de amperios ni asegura suficiente par.
- El firmware ordena pasos, no mide movimiento físico. `ticks` representa pasos ordenados y `position` los convierte a grados. `/motor/estado` agrega `kind: "stepper"`.
- Sin pasos por vuelta y sin cero NO se permite movimiento. Ambos se pierden con reset. Las configuraciones de pasos deben ser enteros positivos.
- Parada por pérdida de Wi-Fi, 1.5 s sin consultas de motor, 10 s de movimiento o botón Detener. Los plazos se evalúan en el bucle; las operaciones de red pueden retrasarlos. No son una parada de emergencia certificada. Un segundo navegador puede mantener las consultas activas.
- El límite de 10 s puede interrumpir recorridos largos: a 50 pasos/s un movimiento de más de aproximadamente 500 pasos no completará. Una parada antes del objetivo invalida la referencia y requiere establecer cero de nuevo. No se realiza recuperación automática tras pérdida de alimentación.
- No hay límites de carrera físicos, sensor de corriente, autenticación ni confirmación de posición. No usar con mecanismos que puedan causar atrapamiento ni cargas que caigan al liberar bobinas. Corta físicamente la alimentación si una parada no se confirma.

El L298 admite motores paso a paso pero la regulación de corriente requiere circuitería adicional; consulta https://www.st.com/resource/en/datasheet/l298.pdf. No aumentar PWM para compensar un fallo sin comprobar los datos eléctricos y la fuente.
