import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { MotorComponent } from './motor.component';
import { IconComponent } from '../../shared/components/icon.component';
import { MotorState } from '../../core/models/motor';
import { ConnectionConfig } from '../../core/models/device';
import { TravelDemo } from './travel-demo';

@Component({ standalone: true, imports: [FormsModule, DecimalPipe, IconComponent], template: `
<div class="page-heading"><div><div class="eyebrow">RECORRIDO CON DOS FINALES</div><h1>Motor paso a paso<span class="heading-dot">.</span></h1><p>42H40H-0504AW7 · L298N · Posición estimada entre extremos</p></div><span class="badge">{{api.demo() ? 'SIMULACIÓN DEMO' : 'ESP32 REAL'}}</span></div>
<div class="demo-banner"><iot-icon name="help" /><div><strong>{{api.demo() ? 'Mapeo simulado: sin movimiento físico' : 'Mapear recorrido mueve el mecanismo hacia ambos extremos'}}</strong><p>Comprueba a mano los dos finales antes de iniciar. La calibración no corrige pasos perdidos ni el temblor del motor. No uses un mecanismo que todavía no se mueve de forma fiable.</p></div></div>
<div class="demo-banner" role="status"><iot-icon name="activity" /><div><strong>{{travelStatus}}</strong><p>El mapeo mide pasos entre interruptores, no milímetros. El rango útil deja margen antes de los topes. Debe repetirse tras reiniciar, mover el eje a mano o perder la referencia.</p></div></div>
<div class="control-grid"><article class="panel motor-position"><div class="panel-title"><h3>Posición dentro del recorrido</h3><span class="badge">{{state()?.moving ? 'MOVIENDO' : state() ? 'DETENIDO' : 'SIN RESPUESTA'}}</span></div><div class="position-dial" [style.--angle]="((state()?.positionPercent || 0) * 3.6) + 'deg'"><span class="dial-pointer"></span><div><strong>{{state()?.positionPercent == null ? '—' : (state()?.positionPercent | number:'1.1-1')}} %</strong><small>{{api.demo() ? 'Estado simulado' : 'Estimada, sin encoder'}}</small></div></div>
<div class="limit-indicators"><div [class.limit-active]="state()?.limitMinimum"><iot-icon name="check" /><strong>Final mínimo</strong><span>{{limitLabel(state()?.limitMinimum)}}</span></div><div [class.limit-active]="state()?.limitMaximum"><iot-icon name="check" /><strong>Final máximo</strong><span>{{limitLabel(state()?.limitMaximum)}}</span></div></div>
<dl><div><dt>Recorrido útil</dt><dd>{{state()?.travelSteps || '—'}} pasos</dd></div><div><dt>Entre activaciones de finales</dt><dd>{{state()?.switchSpanSteps || '—'}} pasos</dd></div><div><dt>Pasos ordenados desde 0 %</dt><dd>{{state()?.referenced ? state()?.ticks : '—'}}</dd></div><div><dt>Referencia</dt><dd>{{state()?.referenced ? 'Recorrido mapeado' : 'Sin mapa válido'}}</dd></div></dl>
@if(error()) {<p class="error" role="alert">{{error()}}</p>}@if(state()?.fault) {<p class="error" role="alert">{{state()?.fault}}</p>}<button class="button motor-stop" (click)="stop()" [disabled]="stopping()"><iot-icon name="power" />{{stopping() ? 'Enviando parada...' : 'Detener motor'}}</button><p class="field-hint">Parada por red, no emergencia física. Las bobinas se liberan al terminar: no sostiene cargas. Si se interrumpe un movimiento hay que mapear de nuevo.</p></article>
<article class="panel settings-panel"><h3>1. Detectar el recorrido</h3><p class="field-hint">Primero busca el mínimo, después el máximo y retrocede para liberar el interruptor. Conserva esta pantalla abierta y supervisa todo el recorrido.</p><label class="motor-checkbox"><input type="checkbox" [(ngModel)]="invert" [disabled]="commandBusy() || !!state()?.moving"> Invertir sentido del motor</label><label class="motor-checkbox"><input type="checkbox" [(ngModel)]="limitsChecked" [disabled]="commandBusy() || !!state()?.moving"> He comprobado los dos finales NC y el sentido hacia el mínimo</label><button class="button primary" (click)="home()" [disabled]="!supportsLimits || !limitsChecked || commandBusy() || !!state()?.moving || (state()?.limitMinimum && state()?.limitMaximum)"><iot-icon name="refresh" />{{state()?.referenced ? 'Volver a mapear recorrido' : 'Mapear recorrido'}}</button><p class="field-hint">Sin mapa no se permite movimiento por posición. No necesitas conocer los pasos por vuelta para mover entre 0 % y 100 %.</p>
<h3 class="motor-calibration-title">2. Elegir posición</h3><label for="travel-target">Objetivo dentro del recorrido útil (%)</label><input id="travel-target" type="number" min="0" max="100" step="1" [(ngModel)]="target" [disabled]="commandBusy() || !!state()?.moving"><input aria-label="Posición dentro del recorrido" type="range" min="0" max="100" step="1" [(ngModel)]="target" [disabled]="commandBusy() || !!state()?.moving"><div class="travel-scale"><span>0 % · Mínimo seguro</span><span>100 % · Máximo seguro</span></div><button class="button primary" (click)="move()" [disabled]="!state()?.referenced || !supportsLimits || commandBusy() || !!state()?.moving || !!state()?.fault || !!error()">Mover a {{target}} %</button><p class="field-hint">NC mínimo → GPIO32 y GND. NC máximo → GPIO33 y GND. Solo contactos secos: nunca 5 V ni 12 V a estas entradas.</p>@if(!supportsLimits && state()) {<p class="error">La ESP32 necesita el firmware nuevo con stepper_limits.h. Vuelve a subir control_led.ino.</p>}</article></div>
` })
export class TravelComponent extends MotorComponent {
  invert        = false;
  target        = 0;
  limitsChecked = false;
  private travelDemo = new TravelDemo();
  private demoConfiguration?: ConnectionConfig;

  get supportsLimits(): boolean { return typeof this.state()?.limitMinimum === 'boolean' && typeof this.state()?.limitMaximum === 'boolean'; }
  limitLabel(active: boolean | undefined): string { return active === undefined ? 'Sin respuesta' : active ? 'Activo / circuito abierto' : 'Libre / circuito cerrado'; }

  get travelStatus(): string {
    const state = this.state();
    if (this.error()) return this.error();
    if (!state) return 'Consultando finales de carrera...';
    if (!this.supportsLimits) return 'Carga el firmware con soporte para dos finales de carrera.';
    if (state.fault) return state.fault;
    if (state.limitMinimum && state.limitMaximum) return 'Ambos finales activos: revisa el cableado NC antes de mapear.';
    const phases: Record<string, string> = { 'release-minimum': 'Liberando el mínimo', 'release-maximum': 'Liberando el máximo', 'seek-minimum': 'Buscando el extremo mínimo', 'seek-maximum': 'Midiendo hasta el máximo', 'clear-maximum': 'Retrocediendo desde el máximo', finish: 'Aplicando margen de seguridad' };
    if (state.homing && state.homing !== 'idle') return phases[state.homing] || 'Mapeando...';
    if (state.moving) return 'Moviendo hacia la posición objetivo...';
    return state.referenced ? 'Recorrido listo. Elige una posición de 0 % a 100 %.' : 'Comprueba los finales e inicia Mapear recorrido.';
  }

  home() {
    if (!this.limitsChecked || !this.supportsLimits || this.state()?.moving) return;
    void this.command('home', { invert: String(this.invert) });
  }

  move() {
    if (!Number.isFinite(Number(this.target)) || this.target < 0 || this.target > 100) { this.api.notify('Introduce una posición entre 0 y 100 %.'); return; }
    if (!this.state()?.referenced || !this.state()?.travelSteps || this.state()?.moving) { this.api.notify('Mapea el recorrido antes de mover.'); return; }
    void this.command('target', { percent: String(this.target) });
  }

  protected override async request(motorId: number, action: string, values: Record<string, string> = {}): Promise<MotorState> {
    const config = this.api.config();
    if (config.mode !== 'demo') return super.request(motorId, action, values);
    if (this.demoConfiguration !== config) { this.demoConfiguration = config; this.travelDemo = new TravelDemo(); }
    await new Promise(resolve => setTimeout(resolve, 120));
    return this.travelDemo.execute(action, values);
  }
}
