#pragma once
#include <Arduino.h>
#include <math.h>

constexpr uint8_t STEPPER_ENA = 14;
constexpr uint8_t STEPPER_IN1 = 18;
constexpr uint8_t STEPPER_IN2 = 19;
constexpr uint8_t STEPPER_ENB = 25;
constexpr uint8_t STEPPER_IN3 = 26;
constexpr uint8_t STEPPER_IN4 = 27;
constexpr uint8_t LIMIT_MIN_PIN = 32;
constexpr uint8_t LIMIT_MAX_PIN = 33;
constexpr uint8_t STEPPER_PWM = 160;
constexpr unsigned long STEP_INTERVAL_MS = 20;
constexpr unsigned long LIMIT_DEBOUNCE_MS = 80;
constexpr unsigned long HOME_TIMEOUT_MS = 120000;
constexpr int32_t HOME_MAX_STEPS = 10000;
constexpr int32_t RELEASE_MAX_STEPS = 200;
constexpr int32_t LIMIT_MARGIN_STEPS = 5;

struct LimitInput {
  uint8_t pin;
  bool raw = true;
  bool stable = true;
  unsigned long changedAt = 0;
  void begin() {
    pinMode(pin, INPUT_PULLUP);
    raw = stable = digitalRead(pin) == HIGH;
    changedAt = millis();
  }
  void sample(unsigned long now) {
    const bool active = digitalRead(pin) == HIGH;
    if (active != raw) { raw = active; changedAt = now; }
    if (now - changedAt >= LIMIT_DEBOUNCE_MS) stable = raw;
  }
  bool settled(unsigned long now) const { return now - changedAt >= LIMIT_DEBOUNCE_MS; }
};

LimitInput limitMinimum{LIMIT_MIN_PIN};
LimitInput limitMaximum{LIMIT_MAX_PIN};
enum class HomeStage { Idle, ReleaseMinimum, ReleaseMaximum, SeekMinimum, SeekMaximum, ClearMaximum, Finish };
HomeStage homeStage = HomeStage::Idle;
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
int32_t travelSteps = 0;
int32_t switchSpanSteps = 0;
int32_t minimumSafe = 0;
int32_t maximumSafe = 0;
int32_t stageStart = 0;
int32_t homeStepCount = 0;
bool minimumReleased = false;

int32_t readEncoder() { return stepperPosition; }
bool validMotorCounts(double counts) { return floor(counts) == counts; }
void resetMotorPosition() { stepperPosition = 0; }

const char* homeStageName() {
  switch (homeStage) {
    case HomeStage::ReleaseMinimum: return "release-minimum";
    case HomeStage::ReleaseMaximum: return "release-maximum";
    case HomeStage::SeekMinimum: return "seek-minimum";
    case HomeStage::SeekMaximum: return "seek-maximum";
    case HomeStage::ClearMaximum: return "clear-maximum";
    case HomeStage::Finish: return "finish";
    default: return "idle";
  }
}

void releaseStepper() {
  if (motorPwmReady) { ledcWrite(STEPPER_ENA, 0); ledcWrite(STEPPER_ENB, 0); }
  digitalWrite(STEPPER_IN1, LOW);
  digitalWrite(STEPPER_IN2, LOW);
  digitalWrite(STEPPER_IN3, LOW);
  digitalWrite(STEPPER_IN4, LOW);
}

void invalidateTravel() { motorReferenced = false; travelSteps = 0; }

void stopMotor(const String& reason = "") {
  if (homeStage != HomeStage::Idle || (motorMoving && stepperPosition != motorTarget) || reason.length()) invalidateTravel();
  releaseStepper();
  motorMoving = false;
  homeStage = HomeStage::Idle;
  motorFault = reason;
}

void energizeStepperPhase() {
  static const uint8_t phases[] = { 1, 4, 2, 8 };
  const uint8_t phase = phases[stepperPhase];
  releaseStepper();
  digitalWrite(STEPPER_IN1, phase & 1 ? HIGH : LOW);
  digitalWrite(STEPPER_IN2, phase & 2 ? HIGH : LOW);
  digitalWrite(STEPPER_IN3, phase & 4 ? HIGH : LOW);
  digitalWrite(STEPPER_IN4, phase & 8 ? HIGH : LOW);
  ledcWrite(phase & 3 ? STEPPER_ENA : STEPPER_ENB, STEPPER_PWM);
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
  limitMinimum.begin();
  limitMaximum.begin();
  Serial.println("Paso a paso: finales NC en GPIO32/33. Mapear antes de mover.");
}

void beginMotorMotion(bool forward) { stepperLastStep = millis(); }

void changeHomeStage(HomeStage next) {
  releaseStepper();
  homeStage = next;
  stageStart = stepperPosition;
  stepperLastStep = millis();
}

bool startHoming(bool invert) {
  const unsigned long now = millis();
  limitMinimum.sample(now);
  limitMaximum.sample(now);
  if (!motorPwmReady || motorMoving || !limitMinimum.settled(now) || !limitMaximum.settled(now)) return false;
  if (limitMinimum.raw && limitMaximum.raw) { motorFault = "Ambos finales activos: revisa contactos NC y cableado"; invalidateTravel(); return false; }
  invalidateTravel();
  motorFault = "";
  motorInvert = invert;
  switchSpanSteps = 0;
  minimumSafe = maximumSafe = 0;
  minimumReleased = false;
  homeStepCount = 0;
  motorMoving = true;
  motorStarted = motorLastContact = now;
  changeHomeStage(limitMinimum.raw ? HomeStage::ReleaseMinimum : limitMaximum.raw ? HomeStage::ReleaseMaximum : HomeStage::SeekMinimum);
  return true;
}

String motorJson() {
  return String("{\"kind\":\"stepper\",\"ticks\":") + stepperPosition + ",\"countsPerTurn\":" + String(motorCountsPerTurn, 0) +
    ",\"position\":" + (motorCountsPerTurn > 0 ? String(stepperPosition * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"target\":" + (motorCountsPerTurn > 0 ? String(motorTarget * 360.0 / motorCountsPerTurn, 2) : "null") +
    ",\"referenced\":" + (motorReferenced ? "true" : "false") + ",\"moving\":" + (motorMoving ? "true" : "false") +
    ",\"invert\":" + (motorInvert ? "true" : "false") + ",\"fault\":\"" + motorFault + "\"" +
    ",\"limitMinimum\":" + (limitMinimum.raw ? "true" : "false") + ",\"limitMaximum\":" + (limitMaximum.raw ? "true" : "false") +
    ",\"homing\":\"" + homeStageName() + "\",\"travelSteps\":" + travelSteps + ",\"switchSpanSteps\":" + switchSpanSteps +
    ",\"positionPercent\":" + (motorReferenced && travelSteps > 0 ? String(stepperPosition * 100.0 / travelSteps, 2) : "null") +
    ",\"targetPercent\":" + (motorReferenced && travelSteps > 0 ? String(motorTarget * 100.0 / travelSteps, 2) : "null") + "}";
}

void updateMotor(bool connected) {
  const unsigned long now = millis();
  limitMinimum.sample(now);
  limitMaximum.sample(now);
  if (!motorMoving) {
    if (motorReferenced && (limitMinimum.raw || limitMaximum.raw)) stopMotor("Final activo fuera del mapeo: revisa y vuelve a mapear");
    return;
  }
  if (!connected || now - motorLastContact > 1500) { stopMotor("Sin comunicacion: detenido, vuelve a mapear"); return; }
  if (now - motorStarted > HOME_TIMEOUT_MS) { stopMotor("Tiempo maximo excedido, revisa recorrido y finales"); return; }
  if (limitMinimum.raw && limitMaximum.raw) { stopMotor("Ambos finales activos: cable roto o finales incorrectos"); return; }
  if (homeStage != HomeStage::Idle) {
    if (homeStepCount >= HOME_MAX_STEPS) { stopMotor("No se encontro un final dentro del limite de pasos"); return; }
    const bool settled = limitMinimum.settled(now) && limitMaximum.settled(now);
    switch (homeStage) {
      case HomeStage::ReleaseMinimum:
        motorDirection = 1;
        if (limitMaximum.raw) { stopMotor("Maximo inesperado al liberar minimo"); return; }
        if (settled && !limitMinimum.stable) { changeHomeStage(HomeStage::SeekMinimum); return; }
        if (stepperPosition - stageStart >= RELEASE_MAX_STEPS) { stopMotor("El final minimo no se libera: revisa NC y sentido"); return; }
        break;
      case HomeStage::ReleaseMaximum:
        motorDirection = -1;
        if (limitMinimum.raw) { stopMotor("Minimo inesperado al liberar maximo"); return; }
        if (settled && !limitMaximum.stable) { changeHomeStage(HomeStage::SeekMinimum); return; }
        if (stageStart - stepperPosition >= RELEASE_MAX_STEPS) { stopMotor("El final maximo no se libera: revisa NC y sentido"); return; }
        break;
      case HomeStage::SeekMinimum:
        motorDirection = -1;
        if (limitMaximum.raw) { stopMotor("Maximo al buscar minimo: invierte sentido o revisa finales"); return; }
        if (limitMinimum.raw) {
          releaseStepper();
          if (settled && limitMinimum.stable) { stepperPosition = 0; changeHomeStage(HomeStage::SeekMaximum); }
          return;
        }
        break;
      case HomeStage::SeekMaximum:
        motorDirection = 1;
        if (!minimumReleased && settled && !limitMinimum.stable) { minimumSafe = stepperPosition + LIMIT_MARGIN_STEPS; minimumReleased = true; }
        if (minimumReleased && limitMinimum.raw) { stopMotor("Minimo inesperado durante busqueda del maximo"); return; }
        if (!minimumReleased && stepperPosition >= RELEASE_MAX_STEPS) { stopMotor("El minimo no se libera: revisa cableado y sentido"); return; }
        if (limitMaximum.raw) {
          releaseStepper();
          if (settled && limitMaximum.stable) {
            if (!minimumReleased) { stopMotor("Recorrido insuficiente entre finales"); return; }
            switchSpanSteps = stepperPosition;
            changeHomeStage(HomeStage::ClearMaximum);
          }
          return;
        }
        break;
      case HomeStage::ClearMaximum:
        motorDirection = -1;
        if (limitMinimum.raw) { stopMotor("Minimo inesperado al liberar maximo"); return; }
        if (settled && !limitMaximum.stable) {
          maximumSafe = stepperPosition - LIMIT_MARGIN_STEPS;
          if (maximumSafe <= minimumSafe) { stopMotor("Recorrido insuficiente para margenes de seguridad"); return; }
          changeHomeStage(HomeStage::Finish);
          return;
        }
        if (stageStart - stepperPosition >= RELEASE_MAX_STEPS) { stopMotor("El maximo no se libera: revisa NC y sentido"); return; }
        break;
      case HomeStage::Finish:
        motorDirection = -1;
        if (limitMaximum.raw || limitMinimum.raw) { stopMotor("Final inesperado al terminar el mapeo"); return; }
        if (stepperPosition <= maximumSafe) {
          travelSteps = maximumSafe - minimumSafe;
          stepperPosition -= minimumSafe;
          motorTarget = stepperPosition;
          homeStage = HomeStage::Idle;
          motorReferenced = true;
          stopMotor();
          return;
        }
        break;
      default: break;
    }
  } else {
    if (!motorReferenced || travelSteps <= 0 || motorTarget < 0 || motorTarget > travelSteps) { stopMotor("Recorrido no valido: vuelve a mapear"); return; }
    if (limitMinimum.raw || limitMaximum.raw) { stopMotor("Final de carrera inesperado: detenido, vuelve a mapear"); return; }
    if (stepperPosition == motorTarget) {
      if (now - stepperLastStep >= STEP_INTERVAL_MS) stopMotor();
      return;
    }
  }
  if ((motorDirection < 0 && limitMinimum.raw) || (motorDirection > 0 && limitMaximum.raw)) { releaseStepper(); return; }
  if (now - stepperLastStep < STEP_INTERVAL_MS) return;
  stepperLastStep = now;
  const int physicalDirection = motorInvert ? -motorDirection : motorDirection;
  stepperPhase = (stepperPhase + physicalDirection + 4) % 4;
  energizeStepperPhase();
  stepperPosition += motorDirection;
  if (homeStage != HomeStage::Idle) homeStepCount++;
}
