import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { firstValueFrom, timeout } from 'rxjs';
import { Esp32Service } from '../../core/services/esp32.service';
import { WebSerialService } from '../../core/services/webserial.service';
import { MotorState } from '../../core/models/motor';
import { IconComponent } from '../../shared/components/icon.component';

const JOG_STEPS = [-100, -10, -1, 1, 10, 100] as const;
const MOTOR_IDS = [1, 2, 3] as const;

@Component({
  standalone: true,
  imports: [FormsModule, DecimalPipe, IconComponent],
  template: `
<div class="page-heading">
  <div>
    <div class="eyebrow">3 MOTORES DRV8833 · CONTROL Y CALIBRACIÓN</div>
    <h1>Motores paso a paso<span class="heading-dot">.</span></h1>
    <p>Jogging · Guardar recorrido · Posición en memoria flash</p>
  </div>
  <span class="badge">{{api.demo() ? 'SIMULACIÓN DEMO' : 'ESP32 REAL'}}</span>
</div>

<!-- Motor selector cards (M1=yellow, M2=blue, M3=green) -->
<div class="ms-grid">
  @for (m of motors; track m) {
    <article class="ms-card"
      [class.ms-sel]="selectedMotor() === m"
      [class.ms-m1]="m === 1"
      [class.ms-m2]="m === 2"
      [class.ms-m3]="m === 3"
      (click)="selectMotor(m)">
      <div class="ms-head">
        <span class="ms-badge" [class.ms-b1]="m===1" [class.ms-b2]="m===2" [class.ms-b3]="m===3">M{{m}}</span>
        <span class="ms-name">{{ motorLabel(m) }}</span>
        @if (stateOf(m)?.moving) {
          <span class="ms-moving"></span>
        }
      </div>
      <div class="ms-pct">{{ pctStr(m) }}</div>
      @if ((stateOf(m)?.maxSteps ?? 0) > 0) {
        <div class="ms-bar">
          <div class="ms-bar-fill" [style.width.%]="stateOf(m)?.percent ?? 0"></div>
        </div>
      }
      <div class="ms-pos">
        @if (errorOf(m)) {
          <span style="color:var(--danger)">⚠ Error</span>
        } @else if (stateOf(m)) {
          {{ stateOf(m)!.position }} pasos
        } @else {
          ...
        }
      </div>
      @if (stateOf(m)?.fault) {
        <div class="ms-fault">{{ stateOf(m)!.fault }}</div>
      }
    </article>
  }
</div>

<!-- Control panel for selected motor -->
<div class="control-grid">
  <article class="panel motor-position"
    [class.motor-panel-m1]="selectedMotor()===1"
    [class.motor-panel-m2]="selectedMotor()===2"
    [class.motor-panel-m3]="selectedMotor()===3">
    <div class="panel-title">
      <h3>
        <span class="ms-badge" [class.ms-b1]="selectedMotor()===1" [class.ms-b2]="selectedMotor()===2" [class.ms-b3]="selectedMotor()===3" style="margin-right:6px">M{{selectedMotor()}}</span>
        {{ motorLabel(selectedMotor()) }}
      </h3>
      <span class="badge">{{state()?.moving ? 'MOVIENDO' : state() ? 'DETENIDO' : 'SIN RESPUESTA'}}</span>
    </div>
    <dl>
      <div><dt>Posición actual</dt><dd>{{state()?.position ?? '—'}} pasos</dd></div>
      <div><dt>Objetivo</dt><dd>{{state()?.target ?? '—'}} pasos</dd></div>
      <div><dt>Máximo guardado</dt><dd>{{state()?.maxSteps ? state()!.maxSteps + ' pasos' : 'No definido aún'}}</dd></div>
      <div>
        <dt>Porcentaje</dt>
        <dd>{{state()?.percent !== null && state()?.percent !== undefined ? (state()!.percent! | number:'1.0-1') + '%' : '—'}}</dd>
      </div>
    </dl>
    @if (error()) { <p class="error" role="alert">{{error()}}</p> }
    @if (state()?.fault) { <p class="error" role="alert">{{state()!.fault}}</p> }
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="button motor-stop" type="button" (click)="stop()" [disabled]="stopping()">
        <iot-icon name="power" /> {{stopping() ? 'Deteniendo...' : 'Detener y retener'}}
      </button>
      <button class="button secondary" type="button" (click)="free()" [disabled]="stopping()">
        Liberar eje
      </button>
    </div>
    <p class="field-hint">Retener mantiene las bobinas energizadas para aguantar peso. Liberar suelta el eje para moverlo a mano.</p>
  </article>

  <article class="panel settings-panel">
    <h3>Jogging · M{{selectedMotor()}}</h3>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      @for (s of jogSteps; track s) {
        <button
          class="button secondary"
          style="min-width:52px;font-variant-numeric:tabular-nums"
          (click)="jog(s)"
          [disabled]="commandBusy()">
          {{s > 0 ? '+' : ''}}{{s}}
        </button>
      }
    </div>
    <p class="field-hint">Positivo avanza, negativo retrocede. Si hay máximo guardado, no lo supera.</p>

    <h3 class="motor-calibration-title">Configurar recorrido</h3>
    <div class="settings-actions">
      <button class="button secondary" (click)="zero()" [disabled]="commandBusy() || !!state()?.moving">
        Establecer cero aquí
      </button>
      <button class="button secondary" (click)="saveMax()" [disabled]="commandBusy() || !!state()?.moving || !state()?.position">
        Guardar máximo aquí
      </button>
      @if (state()?.maxSteps) {
        <button class="button secondary" style="color:var(--danger)" (click)="clearMax()" [disabled]="commandBusy() || !!state()?.moving">
          Borrar máximo
        </button>
      }
    </div>
    <p class="field-hint">Lleva el motor al inicio → "Establecer cero". Luego al final → "Guardar máximo". Se graba en flash del ESP32.</p>

    @if (state()?.maxSteps) {
      <h3 class="motor-calibration-title">Mover a posición</h3>
      <label [attr.for]="'pct-' + selectedMotor()">Posición objetivo: <strong>{{targetPercent}}%</strong></label>
      <input
        [id]="'pct-' + selectedMotor()"
        type="range" min="0" max="100" step="1"
        [(ngModel)]="targetPercent"
        [disabled]="commandBusy() || !!state()?.moving"
        style="accent-color:var(--green);width:100%;padding:10px 0">
      <button
        class="button primary"
        (click)="moveTo()"
        [disabled]="commandBusy() || !!state()?.moving || !!state()?.fault">
        Ir a {{targetPercent}}%
      </button>
    }

    <h3 class="motor-calibration-title">Opciones</h3>
    <div class="settings-panel motor-checkbox">
      <input
        type="checkbox"
        [(ngModel)]="invertValue"
        [disabled]="commandBusy() || !!state()?.moving"
        (change)="setInvert()">
      <span>Invertir sentido del motor {{selectedMotor()}}</span>
    </div>
    <p class="field-hint">Si el motor gira al revés del esperado, activa esta opción. Se guarda en el ESP32.</p>
  </article>
</div>

<div class="demo-banner" style="margin-top:20px">
  <iot-icon name="help" />
  <div>
    <strong>Cómo configurar el recorrido de cada motor</strong>
    <p>Mueve con jogging al inicio → "Establecer cero". Luego al máximo → "Guardar máximo". El recorrido se graba en la flash del ESP32 y se recuerda al reiniciar.</p>
  </div>
</div>
  `
})
export class MotorComponent implements OnDestroy {
  readonly api    = inject(Esp32Service);
  private  http   = inject(HttpClient);
  protected serial = inject(WebSerialService);

  readonly selectedMotor = signal<number>(1);
  private  stateSignals  = MOTOR_IDS.map(() => signal<MotorState | null>(null));
  private  errorSignals  = MOTOR_IDS.map(() => signal(''));

  readonly state  = computed(() => this.stateSignals[this.selectedMotor() - 1]());
  readonly error  = computed(() => this.errorSignals[this.selectedMotor() - 1]());
  readonly motors   = MOTOR_IDS;
  readonly jogSteps = JOG_STEPS;

  readonly commandBusy = signal(false);
  readonly stopping    = signal(false);

  targetPercent = 0;
  invertValue   = false;

  private timer?: ReturnType<typeof setTimeout>;
  private generation    = 0;
  private reading       = false;
  private pollIdx       = 0;
  private readComplete: Promise<void> = Promise.resolve();
  private finishRead?: () => void;
  private destroyed     = false;

  private demoStates: MotorState[] = MOTOR_IDS.map(id => ({
    id, position: 0, target: 0, maxSteps: 0, moving: false, percent: null, invert: false, fault: ''
  }));

  constructor() {
    effect(() => {
      this.api.config();
      this.generation++;
      clearTimeout(this.timer);
      for (const s of this.stateSignals) s.set(null);
      for (const e of this.errorSignals) e.set('');
      this.invertValue   = false;
      this.targetPercent = 0;
      this.pollIdx       = 0;
      this.demoStates    = MOTOR_IDS.map(id => ({
        id, position: 0, target: 0, maxSteps: 0, moving: false, percent: null, invert: false, fault: ''
      }));
      this.timer = setTimeout(() => void this.poll(), 0);
    });
  }

  stateOf(id: number): MotorState | null { return this.stateSignals[id - 1](); }
  errorOf(id: number): string            { return this.errorSignals[id - 1](); }

  motorLabel(m: number): string {
    return ['Apertura', 'Rotación', 'Inclinación'][m - 1] ?? '—';
  }

  pctStr(m: number): string {
    const s = this.stateOf(m);
    if (!s) return '—';
    if (s.percent !== null && s.percent !== undefined) return s.percent.toFixed(1) + '%';
    return s.position + ' pasos';
  }

  selectMotor(n: number) {
    if (this.selectedMotor() === n) return;
    this.selectedMotor.set(n);
    this.invertValue   = this.stateSignals[n - 1]()?.invert ?? false;
    this.targetPercent = 0;
  }

  protected async request(motorId: number, action: string, values: Record<string, string> = {}): Promise<MotorState> {
    const config = this.api.config();

    if (config.mode === 'demo') {
      await new Promise(r => setTimeout(r, 80));
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
      if (action === 'saveMax') { s.maxSteps = s.position; }
      if (action === 'zero') {
        s.maxSteps = Math.max(0, (s.maxSteps ?? 0) - s.position);
        s.position = 0; s.target = 0; s.moving = false;
      }
      if (action === 'target') {
        const pct = parseFloat(values['percent'] ?? '0');
        if ((s.maxSteps ?? 0) > 0) {
          s.target = Math.round(pct * s.maxSteps! / 100);
          s.moving = s.target !== s.position; s.fault = '';
        } else {
          s.fault = 'Guarda el maximo antes de mover';
        }
      }
      if (action === 'stop')     { s.target = s.position; s.moving = false; }
      if (action === 'invert')   { s.invert = values['value'] === 'true'; }
      if (action === 'clearMax') { s.maxSteps = 0; }
      if (action === 'free')     { s.moving = false; }

      s.percent = (s.maxSteps ?? 0) > 0
        ? parseFloat((s.position * 100 / s.maxSteps!).toFixed(1))
        : null;

      this.demoStates[motorId - 1] = s;
      return s;
    }

    if (config.mode === 'serial') {
      if (!this.serial.connected()) throw new Error('Puerto serie no conectado.');
      const cmd  = this.serialCmd(motorId, action, values);
      const text = await this.serial.send(cmd);
      const data = JSON.parse(text) as MotorState & { error?: string };
      if (data.error) throw new Error(data.error);
      if (!data || typeof data.position !== 'number' || typeof data.moving !== 'boolean' || typeof data.fault !== 'string')
        throw new Error('Respuesta de motor invalida. Actualiza el firmware.');
      return data;
    }

    if (location.protocol === 'https:' && config.baseUrl.startsWith('http:'))
      throw new Error('Abre el dashboard por HTTP local.');

    const base = `${config.baseUrl}/motor/${motorId}/`;
    const req  = action === 'estado'
      ? this.http.get<MotorState>(base + 'estado')
      : this.http.post<MotorState>(base + action, new HttpParams({ fromObject: values }));

    const s = await firstValueFrom(req.pipe(timeout(2000)));
    if (!s || typeof s.position !== 'number' || typeof s.moving !== 'boolean' || typeof s.fault !== 'string')
      throw new Error('Respuesta de motor invalida. Actualiza el firmware.');
    return s;
  }

  private serialCmd(motorId: number, action: string, values: Record<string, string> = {}): string {
    const m = `MOTOR ${motorId}`;
    switch (action) {
      case 'estado':  return `${m} ESTADO`;
      case 'jog':     return `${m} JOG ${values['steps'] ?? '0'}`;
      case 'saveMax': return `${m} SAVEMAX`;
      case 'zero':    return `${m} ZERO`;
      case 'target':  return `${m} TARGET ${values['percent'] ?? '0'}`;
      case 'stop':    return `${m} STOP`;
      case 'invert':   return `${m} INVERT ${values['value'] === 'true' ? '1' : '0'}`;
      case 'clearMax': return `${m} CLEARMAX`;
      case 'free':     return `${m} FREE`;
      default: throw new Error(`Acción desconocida: ${action}`);
    }
  }

  private message(error: unknown): string {
    if (error instanceof HttpErrorResponse)
      return error.error?.error || (error.status === 404
        ? 'Motor no encontrado. Carga el firmware actualizado.'
        : 'Sin comunicacion con el motor.');
    return error instanceof Error ? error.message : 'No se pudo completar la solicitud.';
  }

  private schedule() {
    if (!this.destroyed) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.poll(), 300);
    }
  }

  private async poll() {
    if (this.reading || this.commandBusy() || this.stopping()) { this.schedule(); return; }
    this.reading      = true;
    this.readComplete = new Promise(resolve => { this.finishRead = resolve; });
    const gen     = this.generation;
    const motorId = (this.pollIdx % 3) + 1;
    this.pollIdx++;
    try {
      const s = await this.request(motorId, 'estado');
      if (gen === this.generation && !this.destroyed) {
        this.stateSignals[motorId - 1].set(s);
        this.errorSignals[motorId - 1].set('');
        if (!this.commandBusy() && motorId === this.selectedMotor()) this.invertValue = s.invert;
      }
    } catch (err) {
      if (gen === this.generation) {
        this.errorSignals[motorId - 1].set(this.message(err));
        this.stateSignals[motorId - 1].set(null);
      }
    } finally {
      this.reading = false;
      this.finishRead?.();
      this.schedule();
    }
  }

  protected async command(action: string, values: Record<string, string> = {}) {
    if (this.commandBusy() || this.stopping()) return;
    clearTimeout(this.timer);
    this.commandBusy.set(true);
    const gen     = this.generation;
    const motorId = this.selectedMotor();
    try {
      await this.readComplete;
      if (gen !== this.generation || this.destroyed) return;
      clearTimeout(this.timer);
      const s = await this.request(motorId, action, values);
      if (gen === this.generation && !this.destroyed) {
        this.stateSignals[motorId - 1].set(s);
        this.errorSignals[motorId - 1].set('');
        this.invertValue = s.invert;
        const msg = `Motor ${motorId}: ${this._confirmMsg(action)}${this.api.demo() ? ' · DEMO' : ''}`;
        this.api.notify(msg);
      }
    } catch (err) {
      if (gen === this.generation) {
        this.errorSignals[motorId - 1].set(this.message(err));
        this.api.notify(this.message(err));
      }
    } finally {
      this.commandBusy.set(false);
      this.schedule();
    }
  }

  private _confirmMsg(action: string): string {
    const msgs: Record<string, string> = {
      saveMax: 'máximo guardado',
      zero:    'cero establecido',
      jog:     'jogging enviado',
      target:  'movimiento iniciado',
      invert:  'sentido actualizado',
    };
    return msgs[action] ?? 'orden confirmada';
  }

  jog(steps: number) { void this.command('jog',   { steps:   String(steps) }); }
  saveMax()          { void this.command('saveMax'); }
  clearMax()         { void this.command('clearMax'); }
  zero()             { void this.command('zero'); }
  moveTo()           { void this.command('target', { percent: String(this.targetPercent) }); }
  setInvert()        { void this.command('invert', { value:   String(this.invertValue) }); }
  free()             { void this.command('free'); }

  async stop() {
    if (this.stopping()) return;
    this.stopping.set(true);
    this.generation++;
    const motorId = this.selectedMotor();
    try {
      const s = await this.request(motorId, 'stop');
      this.stateSignals[motorId - 1].set(s);
      this.errorSignals[motorId - 1].set('');
      this.api.notify(`Motor ${motorId} detenido${this.api.demo() ? ' · DEMO' : ''}`);
    } catch (err) {
      this.errorSignals[motorId - 1].set(this.message(err));
    } finally {
      this.stopping.set(false);
      this.schedule();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.generation++;
    clearTimeout(this.timer);
  }
}
