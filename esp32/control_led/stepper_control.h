#pragma once
#include <Arduino.h>
#include <math.h>

constexpr uint8_t STEPPER_ENA = 14;
constexpr uint8_t STEPPER_IN1 = 18;
constexpr uint8_t STEPPER_IN2 = 19;
constexpr uint8_t STEPPER_ENB = 25;
constexpr uint8_t STEPPER_IN3 = 26;
constexpr uint8_t STEPPER_IN4 = 27;
constexpr uint8_t STEPPER_PWM = 90;
constexpr unsigned long STEP_INTERVAL_MS = 25;
int32_t stepperPosition = 0;
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
unsigned long stepperLastStep = 0;
int stepperPhase = 0;
String motorFault = "";

int32_t readEncoder() { return stepperPosition; }
bool validMotorCounts(double counts) { return floor(counts) == counts; }
void resetMotorPosition() { stepperPosition = 0; }

void releaseStepper() {
  if (motorPwmReady) {
    ledcWrite(STEPPER_ENA, 0);
    ledcWrite(STEPPER_ENB, 0);
  }
  digitalWrite(STEPPER_IN1, LOW);
  digitalWrite(STEPPER_IN2, LOW);
  digitalWrite(STEPPER_IN3, LOW);
  digitalWrite(STEPPER_IN4, LOW);
}

void stopMotor(const String& reason = "") {
  if (motorMoving && stepperPosition != motorTarget) motorReferenced = false;
  releaseStepper();
  motorMoving = false;
  motorFault = reason;
}

void energizeStepperPhase() {
  // Doble excitacion: dos bobinas activas por paso → ~41 % mas par que onda simple
  static const uint8_t T[4][4] = {
    {HIGH, LOW,  HIGH, LOW },
    {LOW,  HIGH, HIGH, LOW },
    {LOW,  HIGH, LOW,  HIGH},
    {HIGH, LOW,  LOW,  HIGH},
  };
  const uint8_t* p = T[stepperPhase & 3];
  digitalWrite(STEPPER_IN1, p[0]); digitalWrite(STEPPER_IN2, p[1]);
  digitalWrite(STEPPER_IN3, p[2]); digitalWrite(STEPPER_IN4, p[3]);
  ledcWrite(STEPPER_ENA, STEPPER_PWM);
  ledcWrite(STEPPER_ENB, STEPPER_PWM);
}

void setupMotor() {
  const uint8_t pins[] = { STEPPER_ENA, STEPPER_ENB, STEPPER_IN1, STEPPER_IN2, STEPPER_IN3, STEPPER_IN4 };
  for (const uint8_t pin : pins) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  const bool channelA = ledcAttach(STEPPER_ENA, 1000, 8);
  const bool channelB = ledcAttach(STEPPER_ENB, 1000, 8);
  motorPwmReady = channelA && channelB;
  if (channelA) ledcWrite(STEPPER_ENA, 0);
  if (channelB) ledcWrite(STEPPER_ENB, 0);
  stopMotor(motorPwmReady ? "" : "No se pudo iniciar PWM de ambos canales");
  Serial.println("Motor: paso a paso bipolar, posicion ESTIMADA sin encoder");
}

void beginMotorMotion(bool forward) {
  stepperLastStep = millis();
  if (stepperPosition != motorTarget) energizeStepperPhase();
}

String motorJson() {
  return String("{\"kind\":\"stepper\",\"ticks\":") + stepperPosition + ",\"countsPerTurn\":" + String(motorCountsPerTurn, 0) +
    ",\"position\":" + (motorCountsPerTurn > 0 ? String(stepperPosition * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"target\":" + (motorCountsPerTurn > 0 ? String(motorTarget * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"referenced\":" + (motorReferenced ? "true" : "false") + ",\"moving\":" + (motorMoving ? "true" : "false") +
    ",\"invert\":" + (motorInvert ? "true" : "false") + ",\"fault\":\"" + motorFault + "\"}";
}

void updateMotor(bool connected) {
  if (!motorMoving) return;
  const unsigned long now = millis();
  if (!connected || now - motorLastContact > 1500) { stopMotor("Sin comunicacion: detenido, restablece cero"); return; }
  if (now - motorStarted > 10000) { stopMotor("Tiempo maximo excedido, restablece cero"); return; }
  if (stepperPosition == motorTarget) {
    if (now - stepperLastStep >= STEP_INTERVAL_MS) stopMotor();
    return;
  }
  if (now - stepperLastStep < STEP_INTERVAL_MS) return;
  stepperLastStep = now;
  const int physicalDirection = motorInvert ? -motorDirection : motorDirection;
  stepperPhase = (stepperPhase + physicalDirection + 4) % 4;
  energizeStepperPhase();
  stepperPosition += motorDirection;
}
