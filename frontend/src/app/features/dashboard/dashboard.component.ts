import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Esp32Service } from '../../core/services/esp32.service';
import { GirasolService } from '../../core/services/girasol.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  standalone: true,
  imports: [IconComponent, DecimalPipe, RouterLink],
  template: `
<div class="page-heading">
  <div>
    <div class="eyebrow">SEGUIDOR SOLAR BIAXIAL · FLANDES, TOLIMA · 4,29° N</div>
    <h1>GIRASOL<span class="heading-dot gold-dot">.</span></h1>
    <p>Panel de 50 W · Error objetivo ≤ 5° · Control híbrido LDR + RTC</p>
  </div>
  <div class="heading-right">
    @if(gs.state(); as s) {
      <span class="mode-pill mode-{{s.modo.toLowerCase()}}">
        <span class="dot"></span>{{ s.modo }}
      </span>
    }
    <button class="button secondary" (click)="gs.refresh()"><iot-icon name="refresh" /> Actualizar</button>
  </div>
</div>

@if(!api.demo() && !gs.available()) {
  <div class="demo-banner pending-banner">
    <iot-icon name="flower" />
    <div>
      <strong>Firmware GIRASOL no detectado en la ESP32</strong>
      <p>{{ gs.error() || 'Conecta la ESP32 con el firmware completo para ver los datos del seguidor solar.' }}<br>
      Mientras tanto puedes probar el motor con finales de carrera.</p>
    </div>
    <a routerLink="/panel">Probar motor <iot-icon name="arrow" [size]="16" /></a>
  </div>
}

@if(api.demo() && !gs.available()) {
  <div class="demo-banner"><iot-icon name="zap" /><div><strong>Modo DEMO activo</strong><p>Simulando datos del seguidor solar en tiempo real.</p></div></div>
}

@if(gs.state(); as s) {
  <!-- HERO: Brújula + Stats -->
  <div class="g-hero">
    <!-- Brújula solar -->
    <article class="panel g-compass-card">
      <div class="g-card-label"><iot-icon name="compass" [size]="14" /> POSICIÓN DEL PANEL</div>

      <div class="solar-compass">
        <span class="cc-n">N</span>
        <span class="cc-s">S</span>
        <span class="cc-e">E</span>
        <span class="cc-o">O</span>

        <!-- Sol (objetivo) -->
        <div class="c-arm" [style.transform]="'rotate(' + s.azimutTarget + 'deg)'">
          <span class="c-needle needle-sun"></span>
        </div>
        <!-- Panel (real) -->
        <div class="c-arm" [style.transform]="'rotate(' + s.azimut + 'deg)'">
          <span class="c-needle needle-panel"></span>
        </div>

        <div class="c-center">
          <strong>{{ s.azimut | number:'1.0-0' }}°</strong>
          <small>Azimut</small>
        </div>
      </div>

      <div class="c-legend">
        <span class="c-leg-sun"><span></span>Sol {{ s.azimutTarget | number:'1.0-0' }}°</span>
        <span class="c-leg-panel"><span></span>Panel {{ s.azimut | number:'1.0-0' }}°</span>
      </div>

      <!-- Arco de elevación -->
      <div class="elev-section">
        <div class="elev-label-top"><iot-icon name="sunrise" [size]="12" /> ELEVACIÓN</div>
        <div class="elev-arc-wrap">
          <div class="elev-arc">
            <div class="elev-dot" [style.left.px]="elevX(s.elevacion)" [style.top.px]="elevY(s.elevacion)"></div>
          </div>
          <div class="elev-axis">
            <span>0°</span><span>45°</span><span>90°</span>
          </div>
        </div>
        <div class="elev-value">{{ s.elevacion | number:'1.0-0' }}° — {{ elevDesc(s.elevacion) }}</div>
      </div>

      @if(s.fault) {
        <p class="g-fault"><iot-icon name="alert" [size]="13" /> {{ s.fault }}</p>
      }
      @if(s.paroEmergencia) {
        <p class="g-fault g-emergency"><iot-icon name="alert" [size]="13" /> PARO DE EMERGENCIA ACTIVO</p>
      }

      <div class="homing-row">
        <span [class.ok]="s.homingListo" [class.pending]="!s.homingListo">
          <iot-icon [name]="s.homingListo ? 'check' : 'refresh'" [size]="12" />
          {{ s.homingListo ? 'Homing completado' : 'Homing pendiente' }}
        </span>
        <a routerLink="/panel" class="g-link">Control del panel <iot-icon name="arrow" [size]="12" /></a>
      </div>
    </article>

    <!-- Stats column -->
    <div class="g-stats-col">

      <!-- Batería -->
      <article class="panel g-mini-card">
        <div class="g-card-label"><iot-icon name="battery" [size]="13" /> BATERÍA</div>
        <div class="g-big-value">{{ s.bateria | number:'1.1-1' }}<span class="g-unit">V</span></div>
        <div class="battery-bar-wrap">
          <div class="battery-bar">
            <div class="battery-fill" [style.width.%]="battPct(s.bateria)"
              [class.bat-low]="battPct(s.bateria) < 25"
              [class.bat-ok]="battPct(s.bateria) >= 25 && battPct(s.bateria) < 75"
              [class.bat-full]="battPct(s.bateria) >= 75"></div>
          </div>
          <div class="battery-nub"></div>
        </div>
        <small class="g-sub">{{ battPct(s.bateria) }}% · LiFePO₄ 12,8 V</small>
      </article>

      <!-- Viento -->
      <article class="panel g-mini-card" [class.g-alert]="s.viento > 10">
        <div class="g-card-label"><iot-icon name="wind" [size]="13" /> VIENTO</div>
        <div class="g-big-value">{{ s.viento | number:'1.1-1' }}<span class="g-unit">m/s</span></div>
        <div class="wind-bar-wrap">
          <div class="wind-bar">
            <div class="wind-fill" [style.width.%]="windPct(s.viento)"></div>
          </div>
          <span class="wind-limit">10</span>
        </div>
        <small class="g-sub" [class.g-warn-text]="s.viento > 10">
          {{ s.viento > 10 ? '⚠ Posición de defensa activada' : s.viento > 7 ? 'Viento fuerte' : 'Normal' }}
        </small>
      </article>

      <!-- Humedad suelo -->
      <article class="panel g-mini-card">
        <div class="g-card-label"><iot-icon name="leaf" [size]="13" /> HUMEDAD SUELO</div>
        <div class="g-big-value">{{ s.humedadSuelo }}<span class="g-unit">%</span></div>
        <small class="g-sub">
          {{ s.bombaActiva ? '💧 Bomba activa' : s.humedadSuelo < 50 ? 'Bajo el umbral' : 'Nivel adecuado' }}
        </small>
      </article>

      <!-- Lluvia + Tanque -->
      <article class="panel g-mini-card">
        <div class="g-card-label"><iot-icon name="drop" [size]="13" /> AGUA</div>
        <div class="g-two-states">
          <div [class.state-ok]="!s.lluvia" [class.state-warn]="s.lluvia">
            <iot-icon [name]="s.lluvia ? 'drop' : 'check'" [size]="14" />
            {{ s.lluvia ? 'Lluvia detectada' : 'Sin lluvia' }}
          </div>
          <div [class.state-ok]="s.nivelTanque" [class.state-warn]="!s.nivelTanque">
            <iot-icon [name]="s.nivelTanque ? 'check' : 'alert'" [size]="14" />
            {{ s.nivelTanque ? 'Tanque: OK' : 'Tanque bajo' }}
          </div>
        </div>
      </article>
    </div>
  </div>

  <!-- BALANCE LDR -->
  <article class="panel g-ldr-card">
    <div class="panel-title">
      <h3><iot-icon name="sun" /> Balance de luz LDR</h3>
      <span class="muted">Banda muerta activa · Corrección híbrida</span>
    </div>
    <div class="ldr-grid">
      <div class="ldr-row">
        <span class="ldr-axis-label">N <small>{{ s.ldrNorte }}</small></span>
        <div class="ldr-track">
          <div class="ldr-center-mark"></div>
          <div class="ldr-dot" [style.left.%]="50 + ldrNS(s) * 45"></div>
        </div>
        <span class="ldr-axis-label">S <small>{{ s.ldrSur }}</small></span>
        <span class="ldr-diff" [class.balanced]="abs(ldrNS(s)) < 0.08">
          {{ abs(ldrNS(s)) < 0.08 ? 'Centrado' : (ldrNS(s) > 0 ? '↑ Más Norte' : '↓ Más Sur') }}
        </span>
      </div>
      <div class="ldr-row">
        <span class="ldr-axis-label">E <small>{{ s.ldrEste }}</small></span>
        <div class="ldr-track">
          <div class="ldr-center-mark"></div>
          <div class="ldr-dot" [style.left.%]="50 + ldrEO(s) * 45"></div>
        </div>
        <span class="ldr-axis-label">O <small>{{ s.ldrOeste }}</small></span>
        <span class="ldr-diff" [class.balanced]="abs(ldrEO(s)) < 0.08">
          {{ abs(ldrEO(s)) < 0.08 ? 'Centrado' : (ldrEO(s) > 0 ? '→ Más Este' : '← Más Oeste') }}
        </span>
      </div>
    </div>
  </article>
}

<!-- Red + actividad (siempre visible) -->
<div class="g-bottom-row">
  <article class="panel network-panel">
    <div class="panel-title">
      <h3><iot-icon name="wifi" /> Conexión</h3>
      <a routerLink="/settings"><iot-icon name="sliders" [size]="17" /></a>
    </div>
    <div class="network-visual">
      <span class="network-node"><iot-icon name="dashboard" [size]="22" /></span>
      <span class="network-line"></span>
      <span class="network-check"><iot-icon [name]="api.connection() === 'connected' ? 'check' : 'refresh'" [size]="14" /></span>
      <span class="network-line"></span>
      <span class="network-node board"><iot-icon name="cpu" [size]="24" /></span>
    </div>
    <div class="network-labels"><span>Dashboard</span><span>ESP32</span></div>
    <dl>
      <div><dt>Modo</dt><dd class="cyan-text">{{ api.demo() ? 'Simulación DEMO' : 'ESP32 real' }}</dd></div>
      <div><dt>Dirección</dt><dd>{{ api.config().baseUrl }}</dd></div>
      <div><dt>Latencia</dt><dd>{{ api.latency() === null ? '—' : api.latency() + ' ms' }}</dd></div>
    </dl>
  </article>

  <article class="panel activity-panel g-activity">
    <div class="panel-title">
      <h3><iot-icon name="activity" /> Actividad</h3>
      <span class="muted">{{ api.demo() ? 'DEMO' : 'Red local' }}</span>
    </div>
    @for(ev of api.events(); track ev.id) {
      <div class="event">
        <span class="event-icon"><iot-icon name="check" [size]="13" /></span>
        <span>{{ ev.message }} <small>{{ ev.mode === 'demo' ? 'DEMO' : 'ESP32' }}</small></span>
        <time>{{ ev.time.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'}) }}</time>
      </div>
    } @empty {
      <p class="muted">Esperando la primera respuesta...</p>
    }
  </article>
</div>
  `
})
export class DashboardComponent {
  readonly api = inject(Esp32Service);
  readonly gs = inject(GirasolService);

  battPct(v: number): number {
    return Math.round(Math.max(0, Math.min(100, (v - 11.0) / (14.4 - 11.0) * 100)));
  }

  windPct(v: number): number {
    return Math.min(100, (v / 14) * 100);
  }

  ldrNS(s: { ldrNorte: number; ldrSur: number }): number {
    const sum = s.ldrNorte + s.ldrSur;
    return sum > 0 ? (s.ldrNorte - s.ldrSur) / sum : 0;
  }

  ldrEO(s: { ldrEste: number; ldrOeste: number }): number {
    const sum = s.ldrEste + s.ldrOeste;
    return sum > 0 ? (s.ldrEste - s.ldrOeste) / sum : 0;
  }

  abs(v: number): number { return Math.abs(v); }

  elevX(deg: number): number {
    const rad = (180 - deg) * Math.PI / 180;
    return Math.round(90 + 80 * Math.cos(rad));
  }

  elevY(deg: number): number {
    const rad = (180 - deg) * Math.PI / 180;
    return Math.round(80 - 80 * Math.sin(rad));
  }

  elevDesc(deg: number): string {
    if (deg <= 2) return 'Horizonte';
    if (deg < 20) return 'Amanecer / atardecer';
    if (deg < 50) return 'Sol bajo';
    if (deg < 75) return 'Sol medio';
    return 'Sol alto';
  }
}
