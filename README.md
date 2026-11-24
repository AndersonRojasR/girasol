# Smart IoT Control

**Control actual de recorrido:** dos finales de carrera NC en GPIO32/33 y mapeo de 0–100 % desde `/motor`. Lee [cableado y prueba previa de los finales](esp32/FINALES-DE-CARRERA.md) antes de mover. El motor debe girar de forma fiable antes de calibrar; los finales no solucionan la pérdida de pasos.

**Hardware activo actual: paso a paso 42H40H-0504AW7 con L298N.** Antes de cargar o conectar, consulta [el cableado de ambos canales y puesta en marcha](esp32/STEPPER.md). El motor DC anterior sigue disponible seleccionando `USE_STEPPER_MOTOR 0` en el sketch.

Control de motor JGA25-370 con encoder y L298N: vista `/motor`. Lee **[cableado, alimentación, calibración y límites](esp32/MOTOR.md)** antes de conectar o mover el motor. La calibración y el cero son obligatorios; incluye modo DEMO.

Dashboard Angular independiente y firmware ESP32 HTTP. Inicia en **DEMO** sin hardware; todos sus estados, eventos y latencias se identifican como simulados. No hay backend Node/Django. Node solo ejecuta las herramientas del frontend.

## 1. Requisitos e instalación

- Node.js 24 LTS (también 22.12+), npm y navegador moderno. Descarga Node de https://nodejs.org e instala la versión LTS. Comprueba `node --version` y `npm.cmd --version` en Windows.
- Angular 21, TypeScript 5.9 y dependencias se instalan localmente: no necesitas Angular CLI global. Compatibilidad: https://angular.dev/reference/versions.
- Arduino IDE 2, ESP32 de desarrollo, cable USB de datos, protoboard, LED externo y resistencia de 330 Ω.

Desde la carpeta raíz:

```powershell
cd frontend
npm.cmd install
npm.cmd start
```

Abre **http://localhost:4205**. En Linux/macOS usa `npm` en lugar de `npm.cmd`. En Windows `.cmd` evita el bloqueo habitual de `npm.ps1` por políticas de PowerShell. No hace falta cambiar esas políticas. Para compilar: `npm.cmd run build`. Para las pruebas: `npm.cmd test`. Con lockfile disponible puedes usar `npm.cmd ci` para instalación reproducible.

En otro equipo de la misma red, abre `http://IP_DEL_PC:4205` y permite el puerto 4205 en el firewall solo para redes privadas. No publiques este servidor a Internet.

## 2. Arquitectura

### Acceso desde celulares y otros equipos de la LAN

El comando `npm.cmd start` escucha en `0.0.0.0:4205`. La IP Wi-Fi del PC detectada durante la configuración es `192.168.0.13`: abre **http://192.168.0.13:4205** desde cualquier dispositivo de la misma LAN. Mantén el PC encendido y Angular ejecutándose. `localhost` siempre apunta al dispositivo donde abres el navegador, no al PC servidor.

Si no abre, permite Node.js en redes privadas desde el aviso de Firewall de Windows. Para crear una regla limitada a la subred, ejecuta en PowerShell como administrador:

```powershell
New-NetFirewallRule -DisplayName "Smart IoT Control LAN 4205" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4205 -Profile Private -RemoteAddress LocalSubnet
```

La red Wi-Fi de confianza debe tener perfil Privado en Windows. No desactives el firewall. Las redes de invitados con aislamiento pueden impedir la conexión.

Para controlar el LED desde esa dirección, configura `FRONTEND_ORIGIN` en `secrets.h` como `http://192.168.0.13:4205` y vuelve a cargar el firmware. El firmware también acepta el origen local `http://localhost:4205`; no permite todos los sitios mediante un comodín. Cada navegador guarda su propia configuración: selecciona ESP32 real e introduce la **IP de la ESP32**, distinta de la IP del PC. Si DHCP cambia la IP del PC, actualiza el origen y recarga el firmware; puedes reservar su IP en el router.

```text
frontend/src/app/
  core/models/          Contrato LED y configuración
  core/services/        Esp32Service: HTTP, demo, polling y estado Signals
  features/dashboard/   Dashboard y vista de dispositivos
  features/settings/    Configuración persistente y prueba independiente
  shared/components/    Iconografía SVG coherente, sin descargas externas
esp32/control_led/      Sketch Arduino y plantilla de secretos
```

Rutas: `/`, `/devices`, `/settings`. La vista Dispositivos reutiliza el control de la única salida implementada. Los eventos solo viven durante la sesión; no se implementa historial persistente. El modelo identifica el dispositivo y separa configuración, transporte y presentación para añadir futuras capacidades sin inventar sensores ni lecturas.

## 3. Preparar Arduino IDE y Wi-Fi

1. Instala Arduino IDE desde https://www.arduino.cc/en/software.
2. En Preferencias → URLs adicionales del gestor de placas agrega `https://espressif.github.io/arduino-esp32/package_esp32_index.json`.
3. En el gestor de placas instala **esp32 by Espressif Systems**. `WiFi.h` y `WebServer.h` vienen incluidas.
4. Copia `esp32/control_led/secrets.example.h` a `esp32/control_led/secrets.h`. El archivo real está ignorado por Git.
5. Edita `WIFI_SSID` y `WIFI_PASSWORD` con tu red **2.4 GHz**. No subas ese archivo al repositorio.
6. Configura `FRONTEND_ORIGIN` con el origen exacto: `http://localhost:4205` en el PC o `http://IP_DEL_PC:4205` si accedes desde móvil. Sin barra final. Cambiar de origen requiere cargar de nuevo el firmware. CORS no es autenticación.

## 4. Cableado del LED

Desconecta el USB antes de cablear:

```text
ESP32 GPIO 2 → resistencia 330 Ω → ánodo LED (pata larga)
ESP32 GND   → cátodo LED (pata corta / lado plano)
```

Usa lógica de **3.3 V** y resistencia limitadora: nunca conectes el LED directamente al pin. El firmware usa LED externo activo en HIGH. GPIO 2 es un pin de arranque en algunos ESP32 y puede compartir el LED integrado: confirma el pinout de tu placa, no lo fuerces a un nivel externo durante el arranque y desconecta el circuito temporalmente si dificulta la carga. No conectes motores, cargas de red ni relés directamente al GPIO.

## 5. Cargar y obtener la IP

1. Abre `esp32/control_led/control_led.ino` en Arduino IDE.
2. Conecta el USB de datos y selecciona la placa exacta en Herramientas → Placa (por ejemplo ESP32 Dev Module para un ESP32 clásico compatible).
3. Selecciona el puerto serie correspondiente. Si no aparece, verifica cable y controlador USB de tu placa.
4. Pulsa Verificar y después Subir. Si la placa lo requiere, mantén BOOT durante el inicio de la carga y suéltalo cuando comience a escribir.
5. Abre Monitor Serial a **115200 baudios**, pulsa EN/RESET y espera `ESP32 conectada. IP: http://192.168...`.
6. El LED queda apagado al iniciar. Si no se conecta, el bucle continúa reintentando cada 15 segundos sin un `while` de espera ni `delay` prolongado.

## 6. Conectar y probar

1. Conecta ESP32 y PC a la misma LAN sin aislamiento entre clientes.
2. Abre `http://IP_ESP32/estado` en el navegador. Debe responder `{"device":"esp32-led","gpio":2,"led":false}`.
3. Dashboard → Configuración → **ESP32 real**. Introduce `http://IP_ESP32`, intervalo de 2 a 60 segundos y pulsa Probar conexión. La prueba usa el formulario sin guardarlo ni cambiar el dashboard.
4. Pulsa Guardar configuración. Verifica ESP32 conectada y la IP visible en la tarjeta de conexión.
5. Pulsa Encender: el LED físico debe iluminarse y la API devolver `led:true`. Pulsa Apagar y comprueba `led:false`. El toggle utiliza el mismo contrato.
6. Desconecta la alimentación de la ESP32: la interfaz indica desconexión y estado desconocido, nunca un falso apagado. Reconecta: el polling recupera la conexión automáticamente; tras reiniciar la salida estará apagada.
7. Vuelve a DEMO desde Configuración para usar la interfaz sin hardware.

## API

| Solicitud | Resultado |
| --- | --- |
| `GET /estado` | Estado actual de salida |
| `GET /led?estado=on` | Enciende y devuelve estado |
| `GET /led?estado=off` | Apaga y devuelve estado |
| `OPTIONS /estado` o `/led` | 204 y cabeceras CORS |

Respuestas correctas: JSON con `device`, `gpio:2`, `led:boolean`. Parámetro inválido: 400; método no admitido: 405; ruta inexistente: 404. Las respuestas no se cachean. La lectura refleja el estado lógico ordenado al GPIO, no una medición eléctrica independiente del LED. La primera versión no tiene autenticación: **solo red local de confianza, sin redirección de puertos ni exposición directa a Internet**.

El cliente espera hasta 4 segundos por petición. El siguiente polling se programa después de terminar la anterior; ni los comandos ni las comprobaciones se superponen. Los controles se bloquean mientras hay una petición. La configuración se guarda en localStorage; si el navegador impide almacenarla, se aplica solo a la sesión y aparece una notificación.

## Solución de problemas

- **No responde / timeout:** verifica IP del monitor serie, alimentación, SSID de 2.4 GHz, misma subred, firewall y aislamiento Wi-Fi de invitados. DHCP puede cambiar la IP: actualízala o reserva una dirección en el router.
- **CORS:** `FRONTEND_ORIGIN` debe coincidir exactamente con protocolo, host y puerto del navegador. `localhost` y `127.0.0.1` son orígenes diferentes. Recompila tras cambiar secretos. El firmware atiende preflight y devuelve cabeceras también en errores.
- **HTTPS → HTTP:** el navegador puede bloquear contenido mixto antes de contactar la ESP32. Ejecuta inicialmente el dashboard por HTTP en la LAN. La ESP32 de esta versión no ofrece TLS; seleccionar HTTPS no añade soporte TLS al firmware.
- **Permiso de red local:** algunos navegadores solicitan acceso a la red local o restringen peticiones a direcciones privadas. Autoriza el acceso si procede; usa el frontend HTTP local. Las cabeceras CORS no anulan las restricciones del navegador.
- **LED no ilumina:** revisa polaridad, GND, pinout, resistencia y modelo de placa. El contrato informa la salida ordenada, no comprueba físicamente el LED.
- **Dirección inválida:** usa una URL completa HTTP/HTTPS, por ejemplo `http://192.168.1.105`, sin rutas, usuario, contraseña ni parámetros.
- **Dependencias:** verifica Node compatible, ejecuta `npm.cmd ci` con el lockfile y revisa errores de red/proxy si npm no descarga paquetes.

Documentación oficial Wi-Fi: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/wifi.html.
