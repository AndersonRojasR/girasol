#include <WiFi.h>
#include <WebServer.h>
#include "secrets.h"
#include "stepper_drv8833.h"

constexpr uint8_t       LED_PIN          = 2;
constexpr unsigned long RETRY_INTERVAL_MS = 15000;

constexpr uint8_t LDR_A_PIN = 34;
constexpr uint8_t LDR_B_PIN = 35;

WebServer server(80);
bool      ledOn              = false;
bool      previouslyConnected = false;
unsigned long lastAttempt    = 0;
String    serialBuf;

bool          ldrAuto      = false;
int           ldrThreshold = 100;
int           ldrJog       = 3;
unsigned long ldrInterval  = 500;
unsigned long lastLdrCheck = 0;

StepperDRV8833 motors[3] = {
  {18, 19, 26, 27, "motor1"},
  {32, 33,  4, 25, "motor2"},
  {22, 23, 21, 13, "motor3"}
};

String ldrJson() {
  int a = analogRead(LDR_A_PIN);
  int b = analogRead(LDR_B_PIN);
  String j = "{\"ldrA\":";  j += a;
  j += ",\"ldrB\":";        j += b;
  j += ",\"diff\":";        j += (a - b);
  j += ",\"autoTrack\":";   j += (ldrAuto ? "true" : "false");
  j += ",\"threshold\":";   j += ldrThreshold;
  j += ",\"jog\":";         j += ldrJog;
  j += ",\"interval\":";    j += ldrInterval;
  j += "}";
  return j;
}

void ldrLoop() {
  if (!ldrAuto) return;
  unsigned long now = millis();
  if (now - lastLdrCheck < ldrInterval) return;
  lastLdrCheck = now;
  if (motors[1].moving) return;
  int diff = analogRead(LDR_A_PIN) - analogRead(LDR_B_PIN);
  if (abs(diff) > ldrThreshold)
    motors[1].jog(diff > 0 ? -ldrJog : ldrJog);
}

void cors() {
  const String origin        = server.header("Origin");
  const String allowedOrigin = (origin == "http://localhost:4205") ? origin : String(FRONTEND_ORIGIN);
  server.sendHeader("Access-Control-Allow-Origin",          allowedOrigin);
  server.sendHeader("Vary",                                 "Origin");
  server.sendHeader("Access-Control-Allow-Methods",         "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers",         "Content-Type");
  server.sendHeader("Access-Control-Allow-Private-Network", "true");
  server.sendHeader("Cache-Control",                        "no-store");
}

void sendJson(int status, const String& body) {
  cors();
  server.send(status, "application/json", body);
}

void sendState() {
  sendJson(200, String("{\"device\":\"esp32-led\",\"gpio\":2,\"led\":") + (ledOn ? "true}" : "false}"));
}

void registerMotor(uint8_t i) {
  String b = "/motor/" + String(i + 1) + "/";

  server.on(b + "estado", HTTP_GET, [i]() {
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "jog", HTTP_POST, [i]() {
    const String s = server.arg("steps");
    if (s.length() == 0) { sendJson(400, "{\"error\":\"Falta steps\"}"); return; }
    motors[i].jog((int32_t)s.toInt());
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "saveMax", HTTP_POST, [i]() {
    if (motors[i].position <= 0) {
      sendJson(409, "{\"error\":\"Mueve el motor antes de guardar el maximo\"}"); return;
    }
    motors[i].saveMax();
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "zero", HTTP_POST, [i]() {
    motors[i].setZero();
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "target", HTTP_POST, [i]() {
    const String text = server.arg("percent");
    char* end = nullptr;
    const float pct = strtof(text.c_str(), &end);
    if (text.length() == 0 || *end != '\0' || !isfinite(pct) || pct < 0 || pct > 100) {
      sendJson(400, "{\"error\":\"percent debe ser 0-100\"}"); return;
    }
    if (!motors[i].movePct(pct)) {
      sendJson(409, "{\"error\":\"" + motors[i].fault + "\"}"); return;
    }
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "stop", HTTP_POST, [i]() {
    motors[i].stop();
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "invert", HTTP_POST, [i]() {
    motors[i].setInvert(server.arg("value") == "true");
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "clearMax", HTTP_POST, [i]() {
    motors[i].clearMax();
    sendJson(200, motors[i].toJson(i + 1));
  });

  server.on(b + "free", HTTP_POST, [i]() {
    motors[i].freeAxis();
    sendJson(200, motors[i].toJson(i + 1));
  });
}

void processSerial(const String& line) {
  if (line.length() == 0) return;

  if (line == "ESTADO") {
    Serial.println(String("{\"device\":\"esp32-led\",\"gpio\":2,\"led\":") + (ledOn ? "true}" : "false}"));
    return;
  }

  if (line == "LED ON" || line == "LED OFF") {
    ledOn = (line == "LED ON");
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    Serial.println(String("{\"device\":\"esp32-led\",\"gpio\":2,\"led\":") + (ledOn ? "true}" : "false}"));
    return;
  }

  if (line.startsWith("MOTOR ")) {
    // "MOTOR n CMD [arg]"
    String rest = line.substring(6);           // "n CMD [arg]"
    int sp1 = rest.indexOf(' ');
    if (sp1 < 0) { Serial.println("{\"error\":\"Formato: MOTOR n CMD\"}"); return; }

    int n = rest.substring(0, sp1).toInt();
    if (n < 1 || n > 3) { Serial.println("{\"error\":\"Motor debe ser 1, 2 o 3\"}"); return; }
    uint8_t i = (uint8_t)(n - 1);

    rest = rest.substring(sp1 + 1);            // "CMD [arg]"
    int sp2 = rest.indexOf(' ');
    String cmd = sp2 < 0 ? rest : rest.substring(0, sp2);
    String arg = sp2 < 0 ? String("") : rest.substring(sp2 + 1);
    cmd.toUpperCase();

    if (cmd == "ESTADO")  { Serial.println(motors[i].toJson(n)); return; }

    if (cmd == "JOG") {
      motors[i].jog((int32_t)arg.toInt());
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "SAVEMAX") {
      if (motors[i].position <= 0) { Serial.println("{\"error\":\"Mueve el motor antes de guardar el maximo\"}"); return; }
      motors[i].saveMax();
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "ZERO") {
      motors[i].setZero();
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "TARGET") {
      char* end = nullptr;
      float pct = strtof(arg.c_str(), &end);
      if (arg.length() == 0 || *end != '\0' || !isfinite(pct) || pct < 0 || pct > 100) {
        Serial.println("{\"error\":\"percent debe ser 0-100\"}"); return;
      }
      if (!motors[i].movePct(pct)) {
        Serial.println("{\"error\":\"" + motors[i].fault + "\"}"); return;
      }
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "STOP") {
      motors[i].stop();
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "INVERT") {
      motors[i].setInvert(arg == "1");
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "CLEARMAX") {
      motors[i].clearMax();
      Serial.println(motors[i].toJson(n)); return;
    }
    if (cmd == "FREE") {
      motors[i].freeAxis();
      Serial.println(motors[i].toJson(n)); return;
    }
    Serial.println("{\"error\":\"Comando desconocido: " + cmd + "\"}");
    return;
  }

  if (line.startsWith("LDR ")) {
    String rest = line.substring(4);
    int sp = rest.indexOf(' ');
    String sub = sp < 0 ? rest : rest.substring(0, sp);
    String arg = sp < 0 ? String("") : rest.substring(sp + 1);
    sub.toUpperCase();
    if (sub == "ESTADO") { Serial.println(ldrJson()); return; }
    if (sub == "AUTO") {
      ldrAuto = arg == "1";
      if (!ldrAuto) motors[1].stop();
      Serial.println(ldrJson()); return;
    }
    if (sub == "THRESHOLD") {
      if (arg.length() > 0) ldrThreshold = constrain(arg.toInt(), 10, 1000);
      Serial.println(ldrJson()); return;
    }
    if (sub == "SPEED") {
      int sp2 = arg.indexOf(' ');
      if (sp2 > 0) {
        ldrJog      = constrain(arg.substring(0, sp2).toInt(), 1, 50);
        ldrInterval = constrain(arg.substring(sp2 + 1).toInt(), 100, 5000);
      }
      Serial.println(ldrJson()); return;
    }
    Serial.println("{\"error\":\"Subcomando LDR desconocido\"}");
    return;
  }

  Serial.println("{\"error\":\"Ruta no reconocida\"}");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nSmart IoT Control: iniciando firmware...");
  digitalWrite(LED_PIN, LOW);
  pinMode(LED_PIN, OUTPUT);

  for (uint8_t i = 0; i < 3; i++) motors[i].begin();
  Serial.println("Motores DRV8833 listos (3x). Recorrido cargado desde flash.");
  pinMode(LDR_A_PIN, INPUT);
  pinMode(LDR_B_PIN, INPUT);

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Conectando a Wi-Fi 2.4 GHz...");
  lastAttempt = millis();

  const char* headers[] = { "Origin" };
  server.collectHeaders(headers, 1);

  server.on("/estado", HTTP_GET, []() { sendState(); });
  server.on("/led", HTTP_GET, []() {
    const String state = server.arg("estado");
    if (state != "on" && state != "off") {
      sendJson(400, "{\"error\":\"Usa estado=on o estado=off\"}"); return;
    }
    ledOn = state == "on";
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    sendState();
  });

  for (uint8_t i = 0; i < 3; i++) registerMotor(i);

  server.on("/ldr/estado",    HTTP_GET,  []() { sendJson(200, ldrJson()); });
  server.on("/ldr/auto",      HTTP_POST, []() {
    ldrAuto = server.arg("enable") == "true";
    if (!ldrAuto) motors[1].stop();
    sendJson(200, ldrJson());
  });
  server.on("/ldr/threshold", HTTP_POST, []() {
    const String v = server.arg("value");
    if (v.length() > 0) ldrThreshold = constrain(v.toInt(), 10, 1000);
    sendJson(200, ldrJson());
  });
  server.on("/ldr/speed", HTTP_POST, []() {
    const String j = server.arg("jog");
    const String iv = server.arg("interval");
    if (j.length()  > 0) ldrJog      = constrain(j.toInt(),   1, 50);
    if (iv.length() > 0) ldrInterval = constrain(iv.toInt(), 100, 5000);
    sendJson(200, ldrJson());
  });

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) {
      const String uri = server.uri();
      if (uri == "/estado" || uri == "/led" ||
          uri.startsWith("/motor/1/") ||
          uri.startsWith("/motor/2/") ||
          uri.startsWith("/motor/3/") ||
          uri == "/ldr/estado" || uri == "/ldr/auto" ||
          uri == "/ldr/threshold" || uri == "/ldr/speed") {
        cors(); server.send(204); return;
      }
    }
    sendJson(404, "{\"error\":\"Ruta no encontrada\"}");
  });
}

void loop() {
  const bool connected = WiFi.status() == WL_CONNECTED;

  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      serialBuf.trim();
      processSerial(serialBuf);
      serialBuf = "";
    } else if (c != '\r') {
      serialBuf += c;
    }
  }

  for (uint8_t i = 0; i < 3; i++) motors[i].update();
  ldrLoop();

  if (connected && !previouslyConnected) {
    server.begin();
    Serial.print("ESP32 conectada. IP: http://");
    Serial.println(WiFi.localIP());
    Serial.println("Servidor HTTP listo. /motor/1/ /motor/2/ /motor/3/");
  }
  if (!connected && previouslyConnected) {
    server.stop();
    Serial.println("Wi-Fi desconectado. Reconectando...");
  }
  previouslyConnected = connected;
  if (connected) server.handleClient();
  if (!connected && millis() - lastAttempt >= RETRY_INTERVAL_MS) {
    lastAttempt = millis();
    WiFi.reconnect();
  }
}
