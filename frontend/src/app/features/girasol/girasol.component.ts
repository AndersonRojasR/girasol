import {
  Component, inject, signal, computed, effect, OnDestroy
} from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Esp32Service } from '../../core/services/esp32.service';
import { WebSerialService } from '../../core/services/webserial.service';
import { MotorState } from '../../core/models/motor';
import { IconComponent } from '../../shared/components/icon.component';
import { CountUpComponent } from '../../shared/components/count-up.component';
import { GirasolHeroComponent } from '../../shared/components/girasol-hero.component';

interface LdrState {
  ldrA: number;
  ldrB: number;
  diff: number;
  autoTrack: boolean;
  threshold: number;
  jog: number;
  interval: number;
}

function fmt(val: number | null | undefined): string {
  return val != null ? Math.round(val) + '%' : '—';
}

@Component({
  standalone: true,
  imports: [RouterLink, IconComponent, CountUpComponent, GirasolHeroComponent, FormsModule],
  template: `
<div class="gh" (pointermove)="spot($event)">

  <!-- ════ HERO: PROTOTIPO ANIMADO ════ -->
  <section class="g-card gh-hero" style="--i:0">
    <div class="gh-hero-art">
      <g-girasol-hero [openness]="openness()" [azimut]="azimut()" [elevacion]="elevacion()" [moving]="anyMoving()" />
    </div>
    <div class="gh-hero-foot">
      <div>
        <h2>GIRASOL</h2>
        <p>Seguidor solar biaxial</p>
      </div>
      <span class="gh-live" [class.off]="api.connection() !== 'connected'"><i></i>{{ api.demo() ? 'Simulación' : 'En vivo' }}</span>
    </div>
    <span class="gh-hero-bar"><i></i></span>
  </section>

  <!-- ════ MODO DE OPERACIÓN ════ -->
  <section class="g-card gh-mode" style="--i:1">
    <h3><iot-icon name="settings" [size]="20" /> Modo de operación</h3>
    <div class="g-seg" role="tablist" [attr.data-active]="modo()">
      <span class="g-seg-thumb" aria-hidden="true"></span>
      <button role="tab" [attr.aria-selected]="modo() === 'auto'" [class.active]="modo() === 'auto'" (click)="modo.set('auto')">
        <iot-icon name="target" [size]="18" /> Automático
      </button>
      <button role="tab" [attr.aria-selected]="modo() === 'manual'" [class.active]="modo() === 'manual'" (click)="modo.set('manual')">
        <iot-icon name="hand" [size]="18" /> Manual
      </button>
    </div>
    <p class="gh-mode-note">
      @if (modo() === 'auto') { <i class="gh-pulse"></i> Seguimiento solar activo · LDR + RTC }
      @else { <iot-icon name="hand" [size]="13" /> Control manual directo habilitado }
    </p>
  </section>

  <!-- ════ MÉTRICAS ════ -->
  <article class="g-card gh-metric" style="--i:2">
    <span class="gh-ico"><iot-icon name="navigation" [size]="24" /></span>
    <div>
      <span class="gh-label">Azimut</span>
      <strong class="gh-value"><g-num [value]="azimut()" />°</strong>
      <small class="gh-sub" [class.busy]="m2State()?.moving">{{ m2State()?.moving ? 'Girando…' : 'M2 · ' + m2PctStr() }}</small>
    </div>
    <span class="gh-meter"><i [style.width.%]="m2State()?.percent ?? 0"></i></span>
  </article>

  <article class="g-card gh-metric" style="--i:3">
    <span class="gh-ico"><iot-icon name="angle" [size]="24" /></span>
    <div>
      <span class="gh-label">Elevación</span>
      <strong class="gh-value"><g-num [value]="elevacion()" />°</strong>
      <small class="gh-sub" [class.busy]="m3State()?.moving">{{ m3State()?.moving ? 'Inclinando…' : 'M3 · ' + tiltPctStr() }}</small>
    </div>
    <span class="gh-meter"><i [style.width.%]="m3State()?.percent ?? 0"></i></span>
  </article>

  <article class="g-card gh-metric gh-petals-card" style="--i:4" [class.is-open]="(openness() ?? 1) > .5">
    <span class="gh-ico gh-ico-flower"><iot-icon [name]="(openness() ?? 1) > .5 ? 'bloom' : 'bud'" [size]="26" /></span>
    <div>
      <span class="gh-label">Pétalos</span>
      <strong class="gh-value gh-state">{{ petalosState() ?? '—' }}</strong>
      <small class="gh-sub" [class.busy]="m1State()?.moving">{{ m1State()?.moving ? 'Moviendo…' : 'M1 · ' + m1PctStr() }}</small>
    </div>
    <span class="gh-meter gold"><i [style.width.%]="m1State()?.percent ?? 0"></i></span>
  </article>

  <!-- ════ ENERGÍA ════ -->
  <article class="g-card gh-energy" style="--i:5">
    <span class="gh-label"><iot-icon name="zap" [size]="20" class="gold" /> Voltaje</span>
    <strong class="gh-value"><g-num [value]="voltageNum()" [decimals]="1" /> <small>V</small></strong>
    <span class="g-chip">{{ api.demo() ? 'Datos demo' : 'Panel solar' }}</span>
  </article>

  <article class="g-card gh-energy" style="--i:6">
    <span class="gh-label"><iot-icon name="cycle" [size]="20" class="gold" /> Potencia</span>
    <strong class="gh-value"><g-num [value]="powerNum()" [decimals]="1" /> <small>W</small></strong>
    <span class="g-chip">{{ api.demo() ? 'Datos demo' : 'Generación' }}</span>
  </article>

  <article class="g-card gh-chart" style="--i:7">
    <header>
      <span class="gh-label"><iot-icon name="bars" [size]="20" class="gold" /> Energía generada (hoy)</span>
      <span class="g-chip">{{ api.demo() ? 'Datos demo' : 'Estimado' }}</span>
    </header>
    <div class="gh-chart-body">
      <div class="gh-yaxis">@for (y of yTicks; track y) { <span>{{ y }} W</span> }</div>
      <div class="gh-plot">
        <svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="ghArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#FACC15" stop-opacity=".55"/>
              <stop offset="1" stop-color="#FACC15" stop-opacity="0"/>
            </linearGradient>
          </defs>
          @for (y of gridY; track y) { <line x1="0" x2="300" [attr.y1]="y" [attr.y2]="y" class="grid"/> }
          <path class="area" [attr.d]="chartArea()" fill="url(#ghArea)"/>
          <path class="line" [attr.d]="chartLine()" pathLength="1"/>
        </svg>
        <span class="gh-now" [style.left.%]="nowPoint().x" [style.top.%]="nowPoint().y"></span>
      </div>
      <div class="gh-xaxis">@for (x of xTicks; track x) { <span>{{ x }}</span> }</div>
    </div>
  </article>

  <!-- ════ CONTROL MANUAL ════ -->
  <section class="g-card gh-control" style="--i:8" [class.locked]="modo() === 'auto'">
    <header>
      <h3><iot-icon name="gamepad" [size]="22" /> Control manual <span>(Movimiento directo)</span></h3>
      @if (cmdBusy()) { <span class="g-chip busy"><i class="gh-spin"></i> Enviando…</span> }
      @else if (modo() === 'auto') { <button class="g-chip link" (click)="modo.set('manual')">Cambiar a manual</button> }
    </header>

    <div class="gh-ctrl-grid">
      <div class="gh-group">
        <span class="gh-group-title"><iot-icon name="cycle" [size]="16" /> Giro (Azimut)</span>
        <div class="gh-pad">
          <button class="g-key" (click)="jog(2, -20)" [disabled]="cmdBusy()" aria-label="Girar a la izquierda"><iot-icon name="left" [size]="22" /></button>
          <button class="g-key" (click)="jog(2, 20)" [disabled]="cmdBusy()" aria-label="Girar a la derecha"><iot-icon name="right" [size]="22" /></button>
        </div>
        <div class="gh-keys-label"><span>Izquierda</span><span>Derecha</span></div>
      </div>

      <div class="gh-group">
        <span class="gh-group-title"><iot-icon name="angle" [size]="16" /> Inclinación (Elevación)</span>
        <div class="gh-pad">
          <button class="g-key" (click)="jog(3, 15)" [disabled]="cmdBusy()" aria-label="Subir"><iot-icon name="up" [size]="22" /></button>
          <button class="g-key" (click)="jog(3, -15)" [disabled]="cmdBusy()" aria-label="Bajar"><iot-icon name="down" [size]="22" /></button>
        </div>
        <div class="gh-keys-label"><span>Arriba</span><span>Abajo</span></div>
      </div>

      <div class="gh-group">
        <span class="gh-group-title"><iot-icon name="bloom" [size]="16" class="gold" /> Pétalos</span>
        <div class="gh-pad">
          <button class="g-key gold" (click)="setPetals(true)" [disabled]="cmdBusy()" aria-label="Abrir pétalos"><iot-icon name="bloom" [size]="22" /></button>
          <button class="g-key gold" (click)="setPetals(false)" [disabled]="cmdBusy()" aria-label="Cerrar pétalos"><iot-icon name="bud" [size]="22" /></button>
        </div>
        <div class="gh-keys-label"><span>Abrir</span><span>Cerrar</span></div>
      </div>

      <button class="gh-stop" (click)="stopAll()" [disabled]="cmdBusy()">
        <span class="gh-stop-ring" aria-hidden="true"></span>
        <iot-icon name="alert" [size]="34" />
        <span>Parada de <br>emergencia</span>
      </button>
    </div>

    @for (err of allErrors(); track $index) {
      @if (err) { <p class="error gh-err" role="alert">M{{ $index + 1 }}: {{ err }}</p> }
    }

    <div class="gh-links">
      <a routerLink="/motores"><iot-icon name="sliders" [size]="15" /> Calibrar motores</a>
      <a routerLink="/panel"><iot-icon name="compass" [size]="15" /> Vista interactiva</a>
    </div>
  </section>

  <!-- ════ SEGUIMIENTO LDR · M2 ════ -->
  <section class="g-card" style="--i:9;grid-column:1/-1">
    <header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <h3 style="margin:0;display:flex;align-items:center;gap:6px;font-size:.93rem">
        <iot-icon name="target" [size]="18" class="gold" /> LDR · Seguimiento M2
      </h3>
      <span class="g-chip" [style.background]="autoTrack ? 'rgba(34,197,94,.2)' : ''">
        {{ autoTrack ? 'AUTO' : 'MANUAL' }}
      </span>
    </header>

    @if (ldrState(); as s) {
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:40px;font-size:.78rem;color:var(--muted);flex-shrink:0">LDR A</span>
          <div style="flex:1;height:7px;background:var(--surface-2,#1e293b);border-radius:4px;overflow:hidden">
            <div style="height:100%;background:#facc15;border-radius:4px;transition:width .3s"
              [style.width.%]="ldrBarA()"></div>
          </div>
          <span style="width:36px;text-align:right;font-size:.8rem;font-variant-numeric:tabular-nums">{{ s.ldrA }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:40px;font-size:.78rem;color:var(--muted);flex-shrink:0">LDR B</span>
          <div style="flex:1;height:7px;background:var(--surface-2,#1e293b);border-radius:4px;overflow:hidden">
            <div style="height:100%;background:#60a5fa;border-radius:4px;transition:width .3s"
              [style.width.%]="ldrBarB()"></div>
          </div>
          <span style="width:36px;text-align:right;font-size:.8rem;font-variant-numeric:tabular-nums">{{ s.ldrB }}</span>
        </div>
      </div>

      <div style="margin-bottom:14px">
        <div style="font-size:.73rem;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:4px">
          <span>← A</span><span>B →</span>
        </div>
        <div style="position:relative;height:10px;background:var(--surface-2,#1e293b);border-radius:5px">
          <div style="position:absolute;left:50%;top:0;width:1px;height:100%;background:var(--border,#334155)"></div>
          <div style="position:absolute;top:50%;width:14px;height:14px;border-radius:50%;background:#facc15;box-shadow:0 0 6px #facc1566;transition:left .4s;transform:translate(-50%,-50%)"
            [style.left.%]="50 + ldrBalancePct() / 2"></div>
        </div>
        <p style="font-size:.73rem;color:var(--muted);text-align:center;margin:5px 0 0">
          @if (s.autoTrack) {
            @if (absVal(s.diff) > s.threshold) { Ajustando… } @else { Equilibrado ✓ }
          } @else {
            Dif: {{ s.diff > 0 ? '+' : '' }}{{ s.diff }}&nbsp;·&nbsp;Umbral: {{ s.threshold }}
          }
        </p>
      </div>
    } @else {
      <p style="color:var(--muted);font-size:.85rem;margin-bottom:14px">{{ ldrError() || 'Conectando…' }}</p>
    }

    <button
      style="width:100%;padding:10px 14px;border-radius:8px;border:1px solid var(--border,#334155);background:var(--surface-2,#1e293b);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;font-size:.85rem;margin-bottom:14px;transition:background .2s"
      [style.background]="autoTrack ? 'rgba(34,197,94,.18)' : ''"
      (click)="toggleAutoTrack()">
      <iot-icon [name]="autoTrack ? 'target' : 'hand'" [size]="16" />
      {{ autoTrack ? 'Desactivar seguimiento' : 'Activar seguimiento AUTO' }}
    </button>

    <label style="display:block">
      <span style="font-size:.78rem;color:var(--muted)">Umbral de corrección: <strong>{{ threshold }}</strong></span>
      <input type="range" min="10" max="500" step="10" [(ngModel)]="threshold"
        (change)="applyThreshold()"
        style="width:100%;accent-color:#facc15;margin-top:5px;display:block">
      <span style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--muted);margin-top:2px">
        <span>Sensible (10)</span><span>Estable (500)</span>
      </span>
    </label>

    <p style="font-size:.73rem;color:var(--muted);margin-top:10px;margin-bottom:0">
      GPIO 34 = LDR A · GPIO 35 = LDR B · Si gira al revés, usa "Invertir sentido" en M2.
    </p>
  </section>
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

  // ── LDR tracker ───────────────────────────────────────────────────
  readonly ldrState = signal<LdrState | null>(null);
  readonly ldrError = signal('');
  protected autoTrack = false;
  protected threshold = 100;
  protected ldrJog      = 3;
  protected ldrInterval = 500;
  private ldrTimer?: ReturnType<typeof setTimeout>;
  private demoLdrPhase = 0;

  readonly ldrBarA = computed(() => {
    const s = this.ldrState();
    return s ? Math.round(s.ldrA / 4095 * 100) : 0;
  });
  readonly ldrBarB = computed(() => {
    const s = this.ldrState();
    return s ? Math.round(s.ldrB / 4095 * 100) : 0;
  });
  readonly ldrBalancePct = computed(() => {
    const s = this.ldrState();
    if (!s) return 0;
    const sum = s.ldrA + s.ldrB;
    if (sum === 0) return 0;
    return Math.max(-100, Math.min(100, Math.round((s.ldrA - s.ldrB) / sum * 100)));
  });

  protected absVal(n: number) { return Math.abs(n); }

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
  readonly voltageNum = computed(() => this.api.demo() ? 5.1 : null);
  readonly powerNum = computed(() => {
    if (!this.api.demo()) return null;
    const e = this.elevacion() ?? 45;
    return Math.round((1.2 + Math.sin((e * Math.PI) / 180) * 1.8) * 10) / 10; // simulación demo
  });
  readonly voltage = computed(() => this.voltageNum()?.toFixed(1) ?? '—');
  readonly power   = computed(() => this.powerNum()?.toFixed(1) ?? '—');

  readonly openness  = computed(() => { const p = this.m1State()?.percent; return p == null ? null : p / 100; });
  readonly anyMoving = computed(() => !!(this.m1State()?.moving || this.m2State()?.moving || this.m3State()?.moving));

  // Energy chart: 08:00–18:00, escala 0–3 W
  readonly yTicks = ['3.0', '2.5', '2.0', '1.5', '1.0', '0.5', '0'];
  readonly gridY  = [2, 18.3, 34.6, 51, 67.3, 83.6, 100];
  readonly xTicks = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];
  private readonly _chartPts = computed(() => {
    const peak = Math.min(3, Math.max(0.8, (this.powerNum() ?? 2.4) + 0.4));
    const n = 41;
    return Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const base = 0.12 + 0.88 * Math.pow(Math.sin(t * Math.PI / 2), 1.3);
      const wiggle = Math.sin(i * 1.7) * 0.06 + Math.sin(i * 0.63 + 1) * 0.05;
      const w = Math.max(0, Math.min(3, peak * (base + wiggle)));
      return { x: t * 300, y: 100 - (w / 3) * 98 };
    });
  });
  readonly chartLine = computed(() =>
    'M' + this._chartPts().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')
  );
  readonly chartArea = computed(() => {
    const pts = this._chartPts().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L');
    return `M0,100 L${pts} L300,100 Z`;
  });
  readonly nowPoint = computed(() => {
    const pts = this._chartPts();
    const d = new Date();
    const h = d.getHours() + d.getMinutes() / 60;
    const t = Math.max(0, Math.min(1, (h - 8) / 10));
    const p = pts[Math.round(t * (pts.length - 1))];
    return { x: (p.x / 300) * 100, y: p.y };
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
      this.ldrState.set(null);
      this.ldrError.set('');
      clearTimeout(this.ldrTimer);
      this.ldrTimer = setTimeout(() => void this.pollLdr(), 500);
    });
  }

  private freshDemo(): MotorState[] {
    // Demo: motores "calibrados" con valores iniciales (pétalos abiertos, 125°, 42°)
    const max = 2000;
    const start = [1800, Math.round(125 / 3.6 / 100 * max), Math.round(42 / 0.9 / 100 * max)];
    return [1, 2, 3].map(id => ({
      id, position: start[id - 1], target: start[id - 1], maxSteps: max, moving: false,
      percent: parseFloat((start[id - 1] * 100 / max).toFixed(1)), invert: false, fault: '',
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
        const step = Math.min(Math.max(8, Math.round((s.maxSteps ?? 0) * 0.08)), Math.abs(diff));
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
    // En demo el recorrido simulado es de 2000 pasos: amplificamos para que el movimiento se note.
    const n = this.api.demo() ? steps * 5 : steps;
    void this.command(motorId, 'jog', { steps: String(n) });
  }

  setPetals(open: boolean) {
    void this.command(1, 'target', { percent: open ? '100' : '0' });
  }

  /** Efecto "spotlight": la luz de la tarjeta sigue al cursor. */
  spot(ev: PointerEvent) {
    const card = (ev.target as HTMLElement | null)?.closest?.('.g-card') as HTMLElement | null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    card.style.setProperty('--my', `${ev.clientY - r.top}px`);
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
    clearTimeout(this.ldrTimer);
  }

  private scheduleLdr() {
    if (!this.destroyed) {
      clearTimeout(this.ldrTimer);
      this.ldrTimer = setTimeout(() => void this.pollLdr(), 1000);
    }
  }

  private async pollLdr() {
    try {
      const s = await this.ldrRequest('estado');
      if (!this.destroyed) {
        this.ldrState.set(s);
        this.autoTrack  = s.autoTrack;
        this.threshold  = s.threshold;
        this.ldrJog      = s.jog;
        this.ldrInterval = s.interval;
        this.ldrError.set('');
      }
    } catch (err) {
      if (!this.destroyed)
        this.ldrError.set(err instanceof Error ? err.message : 'Sin respuesta del LDR');
    } finally {
      this.scheduleLdr();
    }
  }

  private async ldrRequest(action: string, params: Record<string, string> = {}): Promise<LdrState> {
    const cfg = this.api.config();

    if (cfg.mode === 'demo') {
      await new Promise(r => setTimeout(r, 40));
      this.demoLdrPhase += 0.025;
      const idealPct  = 50 + Math.sin(this.demoLdrPhase) * 40;
      const currentPct = this.m2State()?.percent ?? 50;
      const error = currentPct - idealPct;
      const noise = () => Math.round((Math.random() - 0.5) * 80);
      const a = Math.max(0, Math.min(4095, 2048 + Math.round(error * 18) + noise()));
      const b = Math.max(0, Math.min(4095, 2048 - Math.round(error * 18) + noise()));
      if (action === 'auto')      this.autoTrack  = params['enable'] === 'true';
      if (action === 'threshold') this.threshold  = parseInt(params['value']    ?? '100', 10);
      if (action === 'speed') {
        this.ldrJog      = parseInt(params['jog']      ?? '3',   10);
        this.ldrInterval = parseInt(params['interval'] ?? '500', 10);
      }
      return { ldrA: a, ldrB: b, diff: a - b, autoTrack: this.autoTrack, threshold: this.threshold, jog: this.ldrJog, interval: this.ldrInterval };
    }

    if (cfg.mode === 'serial') {
      if (!this.serial.connected()) throw new Error('Puerto serie no conectado.');
      let cmd: string;
      if (action === 'estado')      cmd = 'LDR ESTADO';
      else if (action === 'auto')   cmd = `LDR AUTO ${params['enable'] === 'true' ? '1' : '0'}`;
      else if (action === 'speed')  cmd = `LDR SPEED ${params['jog'] ?? '3'} ${params['interval'] ?? '500'}`;
      else                          cmd = `LDR THRESHOLD ${params['value'] ?? '100'}`;
      const text = await this.serial.send(cmd);
      return JSON.parse(text) as LdrState;
    }

    if (location.protocol === 'https:' && cfg.baseUrl.startsWith('http:'))
      throw new Error('Abre el dashboard por HTTP local.');
    const path = '/ldr/' + action;
    const req  = action === 'estado'
      ? this.http.get<LdrState>(cfg.baseUrl + path)
      : this.http.post<LdrState>(cfg.baseUrl + path, new HttpParams({ fromObject: params }));
    return await firstValueFrom(req.pipe(timeout(2000)));
  }

  async toggleAutoTrack() {
    try {
      const s = await this.ldrRequest('auto', { enable: String(!this.autoTrack) });
      this.ldrState.set(s);
      this.autoTrack = s.autoTrack;
      this.api.notify(s.autoTrack ? 'Seguimiento LDR activado · M2' : 'Seguimiento LDR desactivado');
    } catch (err) {
      this.api.notify(err instanceof Error ? err.message : 'Error al cambiar modo LDR');
    }
  }

  async applyThreshold() {
    try {
      const s = await this.ldrRequest('threshold', { value: String(this.threshold) });
      this.ldrState.set(s);
    } catch { }
  }

  async applySpeed() {
    try {
      const s = await this.ldrRequest('speed', { jog: String(this.ldrJog), interval: String(this.ldrInterval) });
      this.ldrState.set(s);
    } catch { }
  }
}
