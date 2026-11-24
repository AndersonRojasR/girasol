#pragma once
#include <Arduino.h>
#include <Preferences.h>

constexpr unsigned long DRV_STEP_MS    = 30;
constexpr int32_t       DRV_SAVE_EVERY = 50;

struct StepperDRV8833 {
  uint8_t    ain1, ain2, bin1, bin2;
  const char* ns;

  int32_t       position  = 0;
  int32_t       target    = 0;
  int32_t       maxSteps  = 0;
  bool          moving    = false;
  bool          invert    = false;
  int           phase     = 0;
  unsigned long lastStep  = 0;
  int32_t       lastSaved = 0;
  String        fault;

  void begin() {
    uint8_t pins[] = { ain1, ain2, bin1, bin2 };
    for (uint8_t p : pins) { pinMode(p, OUTPUT); digitalWrite(p, LOW); }
    Preferences prefs;
    if (prefs.begin(ns, true)) {
      position = prefs.getInt("pos", 0);
      maxSteps = prefs.getInt("max", 0);
      invert   = prefs.getBool("inv", false);
      prefs.end();
    }
    target    = position;
    lastSaved = position;
  }

  void release() {
    digitalWrite(ain1, LOW); digitalWrite(ain2, LOW);
    digitalWrite(bin1, LOW); digitalWrite(bin2, LOW);
  }

  void stop(const char* reason = "") {
    target = position;
    moving = false;
    if (reason && reason[0]) fault = reason;
    _energize();
    _persist();
  }

  void jog(int32_t steps) {
    fault  = "";
    int32_t t = position + steps;
    if (maxSteps > 0) t = constrain(t, (int32_t)0, maxSteps);
    target = t;
    moving = (target != position);
    if (moving) lastStep = millis();
  }

  bool movePct(float pct) {
    if (maxSteps <= 0) { fault = "Guarda el maximo antes de mover"; return false; }
    fault  = "";
    target = constrain((int32_t)roundf(pct * maxSteps / 100.0f), (int32_t)0, maxSteps);
    moving = (target != position);
    if (moving) lastStep = millis();
    return true;
  }

  void saveMax() {
    maxSteps = position;
    Preferences prefs;
    prefs.begin(ns, false);
    prefs.putInt("max", maxSteps);
    prefs.putInt("pos", position);
    prefs.end();
    lastSaved = position;
  }

  void setZero() {
    if (maxSteps > 0) maxSteps = max((int32_t)0, maxSteps - position);
    position  = 0;
    target    = 0;
    Preferences prefs;
    prefs.begin(ns, false);
    prefs.putInt("pos", 0);
    prefs.putInt("max", maxSteps);
    prefs.end();
    lastSaved = 0;
  }

  void freeAxis() {
    release();
    moving = false;
    target = position;
  }

  void clearMax() {
    maxSteps = 0;
    Preferences prefs;
    prefs.begin(ns, false);
    prefs.putInt("max", 0);
    prefs.end();
  }

  void setInvert(bool inv) {
    invert = inv;
    Preferences prefs;
    prefs.begin(ns, false);
    prefs.putBool("inv", inv);
    prefs.end();
  }

  void update() {
    if (!moving) return;
    unsigned long now = millis();
    if (now - lastStep < DRV_STEP_MS) return;
    lastStep = now;
    if (position == target) { moving = false; _persist(); return; }
    int ld = position < target ? 1 : -1;
    int pd = invert ? -ld : ld;
    phase  = (phase + (pd > 0 ? 1 : 3)) & 3;
    _energize();
    position += ld;
    if (abs(position - lastSaved) >= DRV_SAVE_EVERY) _persist();
  }

  String toJson(uint8_t id) const {
    String j = "{\"id\":"; j += id;
    j += ",\"position\":"; j += position;
    j += ",\"target\":";   j += target;
    j += ",\"maxSteps\":"; j += maxSteps;
    j += ",\"moving\":";   j += (moving  ? "true" : "false");
    j += ",\"percent\":";
    j += (maxSteps > 0 ? String(100.0f * position / maxSteps, 1) : String("null"));
    j += ",\"invert\":";   j += (invert  ? "true" : "false");
    j += ",\"fault\":\"";  j += fault; j += "\"}";
    return j;
  }

private:
  void _persist() {
    if (position == lastSaved) return;
    Preferences prefs;
    prefs.begin(ns, false);
    prefs.putInt("pos", position);
    prefs.end();
    lastSaved = position;
  }

  void _energize() {
    static const bool S[4][4] = {
      {1,0,1,0}, {0,1,1,0}, {0,1,0,1}, {1,0,0,1}
    };
    const bool* s = S[phase];
    digitalWrite(ain1, s[0]); digitalWrite(ain2, s[1]);
    digitalWrite(bin1, s[2]); digitalWrite(bin2, s[3]);
  }
};
