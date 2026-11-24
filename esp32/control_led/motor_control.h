#pragma once
#include <Arduino.h>
#include <math.h>

constexpr uint8_t MOTOR_EN = 25;
constexpr uint8_t MOTOR_IN3 = 26;
constexpr uint8_t MOTOR_IN4 = 27;
constexpr uint8_t ENCODER_A = 32;
constexpr uint8_t ENCODER_B = 33;
constexpr int MOTOR_MAX_PWM = 90;
volatile int32_t encoderTicks = 0;
portMUX_TYPE encoderMux = portMUX_INITIALIZER_UNLOCKED;
float motorCountsPerTurn = 0;
bool motorReferenced = false;
bool motorMoving = false;
bool motorInvert = false;
bool motorPwmReady = false;
int32_t motorTarget = 0;
int32_t motorStartTicks = 0;
int32_t motorLastTicks = 0;
int motorDirection = 0;
unsigned long motorStarted = 0;
unsigned long motorLastPulse = 0;
unsigned long motorLastContact = 0;
String motorFault = "";

void ARDUINO_ISR_ATTR encoderPulse() {
  portENTER_CRITICAL_ISR(&encoderMux);
  encoderTicks += digitalRead(ENCODER_B) ? -1 : 1;
  portEXIT_CRITICAL_ISR(&encoderMux);
}

int32_t readEncoder() {
  portENTER_CRITICAL(&encoderMux);
  const int32_t count = encoderTicks;
  portEXIT_CRITICAL(&encoderMux);
  return count;
}

bool validMotorCounts(double counts) { return true; }
void resetMotorPosition() {
  portENTER_CRITICAL(&encoderMux);
  encoderTicks = 0;
  portEXIT_CRITICAL(&encoderMux);
}
void beginMotorMotion(bool forward) {
  digitalWrite(MOTOR_IN3, forward ? HIGH : LOW);
  digitalWrite(MOTOR_IN4, forward ? LOW : HIGH);
}

void stopMotor(const String& reason = "") {
  if (motorPwmReady) ledcWrite(MOTOR_EN, 0);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  motorMoving = false;
  motorFault = reason;
}

void setupMotor() {
  pinMode(MOTOR_EN, OUTPUT);
  digitalWrite(MOTOR_EN, LOW);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);
  motorPwmReady = ledcAttach(MOTOR_EN, 1000, 8);
  stopMotor(motorPwmReady ? "" : "No se pudo iniciar PWM");
  pinMode(ENCODER_A, INPUT_PULLUP);
  pinMode(ENCODER_B, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENCODER_A), encoderPulse, RISING);
}

String motorJson() {
  const int32_t ticks = readEncoder();
  return String("{\"ticks\":") + ticks + ",\"countsPerTurn\":" + String(motorCountsPerTurn, 4) +
    ",\"position\":" + (motorCountsPerTurn > 0 ? String(ticks * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"target\":" + (motorCountsPerTurn > 0 ? String(motorTarget * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"referenced\":" + (motorReferenced ? "true" : "false") + ",\"moving\":" + (motorMoving ? "true" : "false") +
    ",\"invert\":" + (motorInvert ? "true" : "false") + ",\"fault\":\"" + motorFault + "\"}";
}

void updateMotor(bool connected) {
  if (!motorMoving) return;
  const unsigned long now = millis();
  if (!connected || now - motorLastContact > 1500) { stopMotor("Sin comunicacion: movimiento detenido"); return; }
  if (now - motorStarted > 10000) { stopMotor("Tiempo maximo de movimiento excedido"); return; }
  const int32_t ticks = readEncoder();
  if (ticks != motorLastTicks) { motorLastTicks = ticks; motorLastPulse = now; }
  if (now - motorLastPulse > 600) { stopMotor("Sin pulsos: revisa encoder, fuente y carga"); return; }
  if ((ticks - motorStartTicks) * motorDirection < -3) { stopMotor("Sentido del encoder invertido: revisa polaridad"); return; }
  const int32_t remaining = (motorTarget - ticks) * motorDirection;
  if (remaining <= 1) { stopMotor(); return; }
  const float errorDegrees = remaining * 360.0 / motorCountsPerTurn;
  const int pwm = constrain(static_cast<int>(errorDegrees * 2), 55, MOTOR_MAX_PWM);
  ledcWrite(MOTOR_EN, pwm);
}
