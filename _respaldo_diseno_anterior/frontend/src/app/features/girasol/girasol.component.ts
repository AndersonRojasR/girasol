import {
  Component, inject, signal, computed, effect, OnDestroy
} from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RouterLink } from '@angular/router';
import { Esp32Service } from '../../core/services/esp32.service';
import { WebSerialService } from '../../core/services/webserial.service';
import { MotorState } from '../../core/models/motor';
import { IconComponent } from '../../shared/components/icon.component';

function fmt(val: number | null | undefined): string {
  return val != null ? Math.round(val) + '%' : '—';
}

@Component({
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
<!-- ════ PAGE HEADER ════ -->
<div class="gc-page-head">
  <div>
    <div class="eyebrow">SEGUIDOR SOLAR BIAXIAL · FLANDES, TOLIMA</div>
    <h1>Panel de control<span class="heading-dot gold-dot">.</span></h1>
    <p style="color:var(--muted);font-size:11px;margin:4px 0 0">Control y monitoreo del prototipo GIRASOL</p>
  </div>
  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
    @if (api.demo()) {
      <span class="badge">DEMO</span>
    }
    <span class="connection-pill" [class.offline]="api.connection() !== 'connected'">
      <span class="dot"></span>
      {{ api.demo() ? 'Simulación activa' : api.serial() ? 'USB Serie' : api.connection() === 'connected' ? 'ESP32 conectada' : 'Sin conexión' }}
    </span>
  </div>
</div>

<!-- ════ MODO DE OPERACIÓN ════ -->
<div class="panel gc-mode-card">
  <span class="gc-mode-label"><iot-icon name="zap" [size]="12"/> MODO DE OPERACIÓN</span>
  <div class="gc-mode-tabs">
    <button class="gc-mode-tab" [class.active]="modo() === 'auto'" (click)="modo.set('auto')">
      Automático
    </button>
    <button class="gc-mode-tab" [class.active]="modo() === 'manual'" (click)="modo.set('manual')">
      Manual
    </button>
  </div>
  <span class="gc-mode-status">
    @if (modo() === 'auto') {
      <span class="dot" style="display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--green);margin-right:5px;vertical-align:middle"></span>
      Seguimiento solar activo · LDR + RTC
    } @else {
      <span style="color:var(--gold)"><iot-icon name="sliders" [size]="11"/> Control manual directo</span>
    }
  </span>
</div>

<!-- ════ MÉTRICAS PRINCIPALES ════ -->
<div class="gc-metrics">

  <!-- Azimut (M2) -->
  <article class="panel gc-metric-card">
    <div class="gc-metric-label"><iot-icon name="compass" [size]="12"/> AZIMUT</div>
    <div class="gc-metric-value">
      {{ azimut() ?? '—' }}<span class="gc-metric-unit">°</span>
    </div>
    @if ((m2State()?.maxSteps ?? 0) > 0) {
      <div class="gc-metric-bar">
        <div class="gc-metric-fill" [style.width.%]="m2State()?.percent ?? 0"></div>
      </div>
    }
    <div class="gc-metric-sub">
      M2 ·
      @if (m2State()?.moving) { <span style="color:#f97316">Girando…</span> }
      @else { {{ m2PctStr() }} del recorrido }
    </div>
  </article>

  <!-- Elevación (M3) -->
  <article class="panel gc-metric-card">
    <div class="gc-metric-label"><iot-icon name="sunrise" [size]="12"/> ELEVACIÓN</div>
    <div class="gc-metric-value" style="color:var(--green)">
      {{ elevacion() ?? '—' }}<span class="gc-metric-unit" style="color:var(--muted)">°</span>
    </div>
    @if ((m3State()?.maxSteps ?? 0) > 0) {
      <div class="gc-metric-bar">
        <div class="gc-metric-fill gc-fill-green" [style.width.%]="m3State()?.percent ?? 0"></div>
      </div>
    }
    <div class="gc-metric-sub">
      M3 ·
      @if (m3State()?.moving) { <span style="color:#f97316">Inclinando…</span> }
      @else { {{ tiltPctStr() }} del recorrido }
    </div>
  </article>

  <!-- Pétalos (M1) -->
  <article class="panel gc-metric-card">
    <div class="gc-metric-label"><iot-icon name="flower" [size]="12"/> PÉTALOS</div>
    <div class="gc-petal-state">
      <div class="gc-petal-icon" [class.gc-open]="(m1State()?.percent ?? 0) > 50">
        <iot-icon name="flower" [size]="20"/>
      </div>
      <span class="gc-metric-value gc-metric-value-sm">{{ petalosState() ?? '—' }}</span>
    </div>
    @if ((m1State()?.maxSteps ?? 0) > 0) {
      <div class="gc-metric-bar">
        <div class="gc-metric-fill gc-fill-gold" [style.width.%]="m1State()?.percent ?? 0"></div>
      </div>
    }
    <div class="gc-metric-sub">
      M1 ·
      @if (m1State()?.moving) { <span style="color:#f97316">Moviendo…</span> }
      @else { {{ m1PctStr() }} }
    </div>
  </article>

</div>

<!-- ════ DATOS: VOLTAJE · POTENCIA · GRÁFICA ════ -->
<div class="gc-data-row">

  <article class="panel gc-data-card">
    <div class="gc-metric-label"><iot-icon name="zap" [size]="12"/> VOLTAJE</div>
    <div class="gc-data-value">{{ voltage() }}<span class="gc-data-unit">V</span></div>
    <div class="gc-metric-sub" style="margin-top:2px">Panel solar · LiFePO₄</div>
  </article>

  <article class="panel gc-data-card">
    <div class="gc-metric-label"><iot-icon name="leaf" [size]="12"/> POTENCIA</div>
    <div class="gc-data-value">{{ power() }}<span class="gc-data-unit">W</span></div>
    <div class="gc-metric-sub" style="margin-top:2px">Generación actual</div>
  </article>

  <article class="panel gc-chart-card">
    <div class="gc-chart-head">
      <div class="gc-metric-label"><iot-icon name="activity" [size]="12"/> ENERGÍA GENERADA (hs)</div>
      <span style="font-size:9px;color:var(--gold)">50 W pico estimado</span>
    </div>
    <svg class="gc-chart-svg" viewBox="0 0 300 60" preserveAspectRatio="none">
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#FACC15" stop-opacity=".45"/>
          <stop offset="100%" stop-color="#FACC15" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path [attr.d]="chartArea()" fill="url(#cg)"/>
      <polyline [attr.points]="chartLine()" fill="none" stroke="#FACC15" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div class="gc-chart-axis">
      <span>06:00</span><span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span>
    </div>
  </article>

</div>

<!-- ════ CONTROL MANUAL DIRECTO ════ -->
<div class="panel gc-control-card">
  <div class="panel-title">
    <h3><iot-icon name="sliders"/> Control manual (directo)</h3>
    @if (cmdBusy()) {
      <span class="badge" style="animation:sfpulse .8s infinite">Enviando…</span>
    }
  </div>

  <div class="gc-ctrl-btns">
    <button class="gc-ctrl-btn" (click)="jog(2, -20)" [disabled]="cmdBusy()">
      <iot-icon name="chevron" [size]="22" style="transform:rotate(180deg)"/>
      Sin Girar ←
    </button>
    <button class="gc-ctrl-btn" (click)="jog(3, -15)" [disabled]="cmdBusy()">
      <iot-icon name="sunrise" [size]="22"/>
      Inclinación ↓
    </button>
    <button class="gc-ctrl-btn" (click)="togglePetals()" [disabled]="cmdBusy()">
      <iot-icon name="flower" [size]="22"/>
      Pétalos
    </button>
    <button class="gc-ctrl-btn gc-emergency" (click)="stopAll()" [disabled]="cmdBusy()">
      <iot-icon name="power" [size]="24"/>
      Parada de emergencia
    </button>
  </div>

  @for (err of allErrors(); track $index) {
    @if (err) { <p class="error" role="alert" style="margin-top:8px;font-size:10px">M{{$index + 1}}: {{err}}</p> }
  }

  <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap">
    <a routerLink="/motores" class="button secondary" style="font-size:10px">
      <iot-icon name="sliders" [size]="14"/> Calibrar motores
    </a>
    <a routerLink="/panel" class="button secondary" style="font-size:10px">
      <iot-icon name="flower" [size]="14"/> Vista interactiva
    </a>
  </div>
</div>
  `
})
export class GirasolComponent implements OnDestroy {
  readonly api    = inject(Esp32Service);
  private  http   = inject(HttpClient);
  private  serial = inject(WebSerialService);

  // ── Motor state ───────────────────────────────────────────────────
  protected readonly states = [
    signal<MotorState | null>(null),
    signal<MotorState | null>(null),
    signal<MotorState | null>(null),
  ] as const;
  protected readonly errors = [signal(''), signal(''), signal('')] as const;

  readonly m1State = computed(() => this.states[0]());
  readonly m2State = computed(() => this.states[1]());
  readonly m3State = computed(() => this.states[2]());

  // ── Dashboard computed values ─────────────────────────────────────
  readonly modo = signal<'auto' | 'manual'>('auto');

  readonly azimut = computed(() => {
    const pct = this.m2State()?.percent ?? null;
    return pct !== null ? Math.round(pct * 3.6) : null;
  });
  readonly elevacion = computed(() => {
    const pct = this.m3State()?.percent ?? null;
    return pct !== null ? Math.round(pct * 0.9) : null;
  });
  readonly petalosState = computed(() => {
    const pct = this.m1State()?.percent ?? null;
    if (pct === null) return null;
    if (pct >= 70) return 'Abiertos';
    if (pct <= 20) return 'Cerrados';
    return 'Parcial ' + Math.round(pct) + '%';
  });

  readonly m1PctStr   = computed(() => fmt(this.m1State()?.percent));
  readonly m2PctStr   = computed(() => fmt(this.m2State()?.percent));
  readonly tiltPctStr = computed(() => fmt(this.m3State()?.percent));

  readonly allErrors = computed(() => this.errors.map(e => e()));

  // Sensor data (simulated — real values come from future ESP32 ADC)
  readonly voltage = computed(() => this.api.demo() ? '12.8' : '—');
  readonly power   = computed(() => {
    if (!this.api.demo()) return '—';
    const e = this.elevacion() ?? 45;
    return (e / 90 * 50 * 0.048).toFixed(1); // panel efficiency sim
  });

  // Energy chart: smooth sine over 12h (06:00–18:00), 25 points
  private readonly _chartPts = computed(() => {
    const pct = Math.max(0.1, (this.elevacion() ?? 45) / 90);
    return Array.from({ length: 25 }, (_, i) => {
      const solar = Math.max(0, Math.sin(i / 24 * Math.PI) * pct);
      return { x: (i / 24) * 300, y: 56 - solar * 50 };
    });
  });
  readonly chartLine = computed(() =>
    this._chartPts().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  );
  readonly chartArea = computed(() => {
    const pts = this._chartPts().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    return `M0,56 L${pts} L300,56 Z`;
  });

  // ── Poll state ────────────────────────────────────────────────────
  readonly cmdBusy = signal(false);
  private  pollIdx    = 0;
  private  polling    = false;
  private  generation = 0;
  private  destroyed  = false;
  private  timer?:    ReturnType<typeof setTimeout>;
  private  demoStates: MotorState[] = this.freshDemo();

  constructor() {
    effect(() => {
      this.api.config();
      this.generation++;
      clearTimeout(this.timer);
      for (const s of this.states) s.set(null);
      for (const e of this.errors) e.set('');
      this.demoStates = this.freshDemo();
      this.timer = setTimeout(() => void this.poll(), 0);
    });
  }

  private freshDemo(): MotorState[] {
    return [1, 2, 3].map(id => ({
      id, position: 0, target: 0, maxSteps: 0, moving: false,
      percent: null, invert: false, fault: '',
    }));
  }

  // ── HTTP / Serial / Demo ──────────────────────────────────────────
  private async request(motorId: number, action: string, values: Record<string, string> = {}): Promise<MotorState> {
    const cfg = this.api.config();

    if (cfg.mode === 'demo') {
      await new Promise(r => setTimeout(r, 55));
      const s = { ...this.demoStates[motorId - 1] };
      if (action === 'estado' && s.moving) {
        const diff = s.target - s.position;
        const step = Math.min(5, Math.abs(diff));
        s.position += Math.sign(diff) * step;
        if (s.position === s.target) s.moving = false;
      }
      if (action === 'jog') {
        const steps = parseInt(values['steps'] ?? '0', 10);
        let t = s.position + steps;
        if ((s.maxSteps ?? 0) > 0) t = Math.max(0, Math.min(s.maxSteps!, t));
        s.target = t; s.moving = t !== s.position; s.fault = '';
      }
      if (action === 'target') {
        const pct = parseFloat(values['percent'] ?? '0');
        if ((s.maxSteps ?? 0) > 0) {
          s.target = Math.round(pct * s.maxSteps! / 100);
          s.moving = s.target !== s.position; s.fault = '';
        } else { s.fault = 'Guarda el maximo antes de mover'; }
      }
      if (action === 'stop') { s.target = s.position; s.moving = false; }
      s.percent = (s.maxSteps ?? 0) > 0
        ? parseFloat((s.position * 100 / s.maxSteps!).toFixed(1))
        : null;
      this.demoStates[motorId - 1] = s;
      return s;
    }

    if (cfg.mode === 'serial') {
      if (!this.serial.connected()) throw new Error('Puerto serie no conectado.');
      const text = await this.serial.send(this.serialCmd(motorId, action, values));
      const data = JSON.parse(text) as MotorState & { error?: string };
      if (data.error) throw new Error(data.error);
      return data;
    }

    if (location.protocol === 'https:' && cfg.baseUrl.startsWith('http:'))
      throw new Error('Abre el dashboard por HTTP local.');
    const base = `${cfg.baseUrl}/motor/${motorId}/`;
    const req  = action === 'estado'
      ? this.http.get<MotorState>(base + 'estado')
      : this.http.post<MotorState>(base + action, new HttpParams({ fromObject: values }));
    return await firstValueFrom(req.pipe(timeout(2500)));
  }

  private serialCmd(id: number, action: string, v: Record<string, string>): string {
    const m = `MOTOR ${id}`;
    switch (action) {
      case 'estado':   return `${m} ESTADO`;
      case 'jog':      return `${m} JOG ${v['steps'] ?? '0'}`;
      case 'target':   return `${m} TARGET ${v['percent'] ?? '0'}`;
      case 'stop':     return `${m} STOP`;
      default: throw new Error(`Acción desconocida: ${action}`);
    }
  }

  private message(err: unknown): string {
    if (err instanceof HttpErrorResponse)
      return err.error?.error || 'Sin comunicación con el motor.';
    return err instanceof Error ? err.message : 'No se pudo completar la solicitud.';
  }

  // ── Polling (round-robin) ─────────────────────────────────────────
  private schedule() {
    if (!this.destroyed) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.poll(), 350);
    }
  }

  private async poll() {
    if (this.polling || this.cmdBusy()) { this.schedule(); return; }
    this.polling = true;
    const gen     = this.generation;
    const motorId = (this.pollIdx % 3) + 1;
    this.pollIdx++;
    try {
      const s = await this.request(motorId, 'estado');
      if (gen === this.generation && !this.destroyed) {
        this.states[motorId - 1].set(s);
        this.errors[motorId - 1].set('');
      }
    } catch (err) {
      if (gen === this.generation)
        this.errors[motorId - 1].set(this.message(err));
    } finally {
      this.polling = false;
      this.schedule();
    }
  }

  // ── Commands ──────────────────────────────────────────────────────
  private async command(motorId: number, action: string, values: Record<string, string> = {}) {
    if (this.cmdBusy()) return;
    clearTimeout(this.timer);
    this.cmdBusy.set(true);
    const gen = this.generation;
    try {
      const s = await this.request(motorId, action, values);
      if (gen === this.generation && !this.destroyed) {
        this.states[motorId - 1].set(s);
        this.errors[motorId - 1].set('');
      }
    } catch (err) {
      if (gen === this.generation) {
        this.errors[motorId - 1].set(this.message(err));
        this.api.notify(this.message(err));
      }
    } finally {
      this.cmdBusy.set(false);
      this.schedule();
    }
  }

  jog(motorId: number, steps: number) {
    void this.command(motorId, 'jog', { steps: String(steps) });
  }

  togglePetals() {
    const pct = this.m1State()?.percent ?? 0;
    void this.command(1, 'target', { percent: pct > 50 ? '0' : '100' });
  }

  async stopAll() {
    if (this.cmdBusy()) return;
    clearTimeout(this.timer);
    this.cmdBusy.set(true);
    const gen = this.generation;
    try {
      for (let i = 1; i <= 3; i++) {
        const s = await this.request(i, 'stop');
        if (gen === this.generation && !this.destroyed) {
          this.states[i - 1].set(s);
          this.errors[i - 1].set('');
        }
      }
      this.api.notify('Paro de emergencia · Todos los motores detenidos');
    } catch (err) {
      this.api.notify(this.message(err));
    } finally {
      this.cmdBusy.set(false);
      this.schedule();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.generation++;
    clearTimeout(this.timer);
  }
}
