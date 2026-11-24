import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GirasolService } from '../../core/services/girasol.service';
import { Esp32Service } from '../../core/services/esp32.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  standalone: true,
  imports: [IconComponent, DecimalPipe],
  template: `
<div class="page-heading">
  <div>
    <div class="eyebrow">MONITOREO AMBIENTAL EN TIEMPO REAL</div>
    <h1>Sensores<span class="heading-dot gold-dot">.</span></h1>
    <p>11 sensores · Panel de 50 W · Parcela experimental</p>
  </div>
  <button class="button secondary" (click)="gs.refresh()"><iot-icon name="refresh" /> Actualizar</button>
</div>

@if(!gs.available()) {
  <div class="demo-banner pending-banner">
    <iot-icon name="flower" />
    <div>
      <strong>Sensores no disponibles</strong>
      <p>{{ api.demo() ? 'Activa el modo DEMO para ver la simulación.' : gs.error() }}</p>
    </div>
  </div>
}

@if(gs.state(); as s) {
  <div class="sensor-page-grid">

    <!-- LDR -->
    <article class="panel sensor-big-card">
      <div class="g-card-label"><iot-icon name="sun" [size]="13" /> SENSORES LDR</div>
      <div class="ldr-cross">
        <div class="ldr-cross-label ldr-top">N<br><strong>{{ s.ldrNorte }}</strong></div>
        <div class="ldr-cross-row">
          <div class="ldr-cross-label">O<br><strong>{{ s.ldrOeste }}</strong></div>
          <div class="ldr-cross-center">
            <div class="ldr-sun-indicator" [style.--az]="s.azimutTarget + 'deg'">
              <span class="ldr-sun-dot"></span>
            </div>
          </div>
          <div class="ldr-cross-label">E<br><strong>{{ s.ldrEste }}</strong></div>
        </div>
        <div class="ldr-cross-label ldr-bot">S<br><strong>{{ s.ldrSur }}</strong></div>
      </div>
      <div class="ldr-bars">
        <div class="ldr-bar-row">
          <span>Norte</span>
          <div class="ldr-bar-track"><div class="ldr-bar-fill ldr-gold" [style.width.%]="ldrPct(s.ldrNorte)"></div></div>
          <span>{{ s.ldrNorte }}</span>
        </div>
        <div class="ldr-bar-row">
          <span>Sur</span>
          <div class="ldr-bar-track"><div class="ldr-bar-fill ldr-gold" [style.width.%]="ldrPct(s.ldrSur)"></div></div>
          <span>{{ s.ldrSur }}</span>
        </div>
        <div class="ldr-bar-row">
          <span>Este</span>
          <div class="ldr-bar-track"><div class="ldr-bar-fill ldr-gold" [style.width.%]="ldrPct(s.ldrEste)"></div></div>
          <span>{{ s.ldrEste }}</span>
        </div>
        <div class="ldr-bar-row">
          <span>Oeste</span>
          <div class="ldr-bar-track"><div class="ldr-bar-fill ldr-gold" [style.width.%]="ldrPct(s.ldrOeste)"></div></div>
          <span>{{ s.ldrOeste }}</span>
        </div>
      </div>
    </article>

    <!-- Viento -->
    <article class="panel g-mini-card sensor-sm" [class.g-alert]="s.viento > 10">
      <div class="g-card-label"><iot-icon name="wind" [size]="13" /> ANEMÓMETRO</div>
      <div class="g-big-value">{{ s.viento | number:'1.1-1' }}<span class="g-unit">m/s</span></div>
      <div class="wind-bar-wrap">
        <div class="wind-bar"><div class="wind-fill" [style.width.%]="windPct(s.viento)" [class.wind-danger]="s.viento > 10"></div></div>
        <span class="wind-limit">10</span>
      </div>
      <small class="g-sub" [class.g-warn-text]="s.viento > 10">
        {{ s.viento > 10 ? '⚠ DEFENSA ACTIVADA' : s.viento > 7 ? 'Viento fuerte' : 'Operación normal' }}
      </small>
      <div class="sensor-info">GPIO 13 · Interrupción · pulsos/rev</div>
    </article>

    <!-- Humedad suelo -->
    <article class="panel g-mini-card sensor-sm">
      <div class="g-card-label"><iot-icon name="leaf" [size]="13" /> HUMEDAD DEL SUELO</div>
      <div class="g-big-value">{{ s.humedadSuelo }}<span class="g-unit">%</span></div>
      <div class="hum-arc">
        <svg viewBox="0 0 100 60" fill="none">
          <path d="M10 55 A45 45 0 0 1 90 55" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>
          <path d="M10 55 A45 45 0 0 1 90 55" stroke="var(--leaf)"
            stroke-width="6" stroke-linecap="round"
            stroke-dasharray="141.4"
            [attr.stroke-dashoffset]="141.4 * (1 - s.humedadSuelo / 100)" />
        </svg>
      </div>
      <small class="g-sub">{{ s.humedadSuelo < 50 ? 'Bajo el umbral de riego' : 'Nivel adecuado' }}</small>
      <div class="sensor-info">GPIO 36 · ADC1 · Capacitivo</div>
    </article>

    <!-- Lluvia -->
    <article class="panel g-mini-card sensor-sm" [class.sensor-active]="s.lluvia">
      <div class="g-card-label"><iot-icon name="drop" [size]="13" /> LLUVIA</div>
      <div class="sensor-state-icon"><iot-icon [name]="s.lluvia ? 'drop' : 'check'" [size]="36" /></div>
      <div class="g-big-value" [class.sensor-warn]="s.lluvia">{{ s.lluvia ? 'Detectada' : 'Sin lluvia' }}</div>
      <small class="g-sub">{{ s.lluvia ? 'Riego suspendido' : 'Riego habilitado' }}</small>
      <div class="sensor-info">GPIO 18 · Digital</div>
    </article>

    <!-- Nivel tanque -->
    <article class="panel g-mini-card sensor-sm" [class.sensor-warn-card]="!s.nivelTanque">
      <div class="g-card-label"><iot-icon name="drop" [size]="13" /> NIVEL TANQUE</div>
      <div class="sensor-state-icon"><iot-icon [name]="s.nivelTanque ? 'check' : 'alert'" [size]="36" /></div>
      <div class="g-big-value" [class.sensor-warn]="!s.nivelTanque">{{ s.nivelTanque ? 'Nivel OK' : 'Tanque bajo' }}</div>
      <small class="g-sub">{{ s.nivelTanque ? 'Riego disponible' : 'Rellenar depósito' }}</small>
      <div class="sensor-info">GPIO 16 · Digital · Float</div>
    </article>

    <!-- Batería -->
    <article class="panel g-mini-card sensor-sm">
      <div class="g-card-label"><iot-icon name="battery" [size]="13" /> BATERÍA LiFePO₄</div>
      <div class="g-big-value">{{ s.bateria | number:'1.2-2' }}<span class="g-unit">V</span></div>
      <div class="battery-bar-wrap">
        <div class="battery-bar">
          <div class="battery-fill"
            [style.width.%]="battPct(s.bateria)"
            [class.bat-low]="battPct(s.bateria) < 25"
            [class.bat-ok]="battPct(s.bateria) >= 25 && battPct(s.bateria) < 75"
            [class.bat-full]="battPct(s.bateria) >= 75"></div>
        </div>
        <div class="battery-nub"></div>
      </div>
      <small class="g-sub">{{ battPct(s.bateria) }}% · Nominal 12,8 V / 12 Ah</small>
      <div class="sensor-info">GPIO 39 · ADC1 · Divisor de tensión</div>
    </article>

    <!-- Bomba -->
    <article class="panel g-mini-card sensor-sm" [class.sensor-active]="s.bombaActiva">
      <div class="g-card-label"><iot-icon name="drop" [size]="13" /> BOMBA DE RIEGO</div>
      <div class="sensor-state-icon"><iot-icon [name]="s.bombaActiva ? 'drop' : 'power'" [size]="36" /></div>
      <div class="g-big-value">{{ s.bombaActiva ? 'Activa' : 'Reposo' }}</div>
      <small class="g-sub">12 V · 20 W · 9 goteros · 2 L/h cada uno</small>
      <div class="sensor-info">GPIO 5 · Relé</div>
    </article>

    <!-- Paro emergencia -->
    <article class="panel g-mini-card sensor-sm" [class.g-emergency]="s.paroEmergencia">
      <div class="g-card-label"><iot-icon name="shield" [size]="13" /> PARO DE EMERGENCIA</div>
      <div class="sensor-state-icon"><iot-icon [name]="s.paroEmergencia ? 'alert' : 'shield'" [size]="36" /></div>
      <div class="g-big-value" [class.sensor-warn]="s.paroEmergencia">{{ s.paroEmergencia ? '¡ACTIVO!' : 'Normal' }}</div>
      <small class="g-sub">{{ s.paroEmergencia ? 'Sistema detenido' : 'Sistema operativo' }}</small>
      <div class="sensor-info">GPIO 17 · NC · Interrupción</div>
    </article>

  </div>
}
  `
})
export class SensoresComponent {
  readonly gs = inject(GirasolService);
  readonly api = inject(Esp32Service);

  ldrPct(v: number): number { return Math.min(100, (v / 4095) * 100); }
  windPct(v: number): number { return Math.min(100, (v / 14) * 100); }
  battPct(v: number): number {
    return Math.round(Math.max(0, Math.min(100, (v - 11.0) / (14.4 - 11.0) * 100)));
  }
}
