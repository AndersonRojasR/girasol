import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { ConnectionConfig, DEFAULT_CONFIG, DeviceEvent, LedState, normalizeUrl } from '../models/device';
import { WebSerialService } from './webserial.service';

@Injectable({ providedIn: 'root' })
export class Esp32Service {
  private http       = inject(HttpClient);
  private serialSvc  = inject(WebSerialService);

  readonly config     = signal<ConnectionConfig>(this.load());
  readonly state      = signal<LedState | null>(null);
  readonly connection = signal<'connecting' | 'connected' | 'disconnected'>('connecting');
  readonly busy       = signal(false);
  readonly error      = signal('');
  readonly toast      = signal('');
  readonly events     = signal<DeviceEvent[]>([]);
  readonly checkedAt  = signal<Date | null>(null);
  readonly latency    = signal<number | null>(null);
  readonly demo       = computed(() => this.config().mode === 'demo');
  readonly serial     = computed(() => this.config().mode === 'serial');

  private simulatedLed    = false;
  private eventSequence   = 0;
  private consecutiveFailures = 0;
  private timer?:      ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() { void this.refresh(); }

  private load(): ConnectionConfig {
    try {
      const config = JSON.parse(localStorage.getItem('smart-iot-config') || 'null');
      if (config && ['demo', 'real', 'serial'].includes(config.mode) && Number.isInteger(config.interval) && config.interval >= 2000 && config.interval <= 60000)
        return { ...config, baseUrl: config.mode === 'serial' ? config.baseUrl : normalizeUrl(config.baseUrl) };
    } catch { }
    return { ...DEFAULT_CONFIG };
  }

  notify(message: string) {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 4500);
  }

  private record(message: string) {
    this.events.update(events => [{ id: ++this.eventSequence, time: new Date(), message, mode: this.config().mode }, ...events].slice(0, 8));
  }

  async save(config: ConnectionConfig) {
    if (this.busy()) return;
    const normalized = {
      ...config,
      baseUrl:  config.mode === 'serial' ? config.baseUrl : normalizeUrl(config.baseUrl),
      interval: config.interval,
    };
    if (!Number.isInteger(config.interval) || config.interval < 2000 || config.interval > 60000)
      throw new Error('El intervalo debe estar entre 2 y 60 segundos.');
    try { localStorage.setItem('smart-iot-config', JSON.stringify(normalized)); } catch {
      this.notify('No se pudo guardar de forma persistente; configuración aplicada a esta sesión.');
    }
    this.consecutiveFailures = 0;
    this.config.set(normalized);
    this.state.set(null);
    this.connection.set('connecting');
    this.checkedAt.set(null);
    this.latency.set(null);
    await this.refresh();
  }

  async test(config: ConnectionConfig): Promise<string> {
    if (this.busy()) throw new Error('Espera a que termine la solicitud actual.');
    if (config.mode === 'serial')
      return this.serialSvc.connected()
        ? 'Puerto USB conectado. Comunicación serie disponible.'
        : 'Puerto USB no conectado. Haz clic en "Conectar por USB" primero.';
    clearTimeout(this.timer);
    this.busy.set(true);
    try {
      await this.request({ ...config, baseUrl: normalizeUrl(config.baseUrl) });
      return config.mode === 'demo'
        ? 'Simulación disponible. No se contactó ningún dispositivo físico.'
        : 'ESP32 conectada. Respuesta válida recibida.';
    } finally { this.busy.set(false); this.schedule(); }
  }

  private async request(config: ConnectionConfig, led?: boolean): Promise<LedState> {
    if (config.mode === 'demo') {
      await new Promise(resolve => setTimeout(resolve, 350 + Math.random() * 250));
      if (led !== undefined) this.simulatedLed = led;
      return { device: 'esp32-led', led: this.simulatedLed, gpio: 2 };
    }
    if (config.mode === 'serial') {
      if (!this.serialSvc.connected()) throw new Error('Puerto serie no conectado.');
      const cmd   = led === undefined ? 'ESTADO' : led ? 'LED ON' : 'LED OFF';
      const text  = await this.serialSvc.send(cmd);
      const state = JSON.parse(text) as LedState;
      if (!state || typeof state.led !== 'boolean') throw new Error('Respuesta serie inválida del ESP32.');
      return state;
    }
    if (location.protocol === 'https:' && config.baseUrl.startsWith('http:'))
      throw new Error('Contenido mixto bloqueado: abre el dashboard mediante HTTP en la red local.');
    const path  = led === undefined ? '/estado' : '/led?estado=' + (led ? 'on' : 'off');
    const state = await firstValueFrom(this.http.get<LedState>(config.baseUrl + path).pipe(timeout(4000)));
    if (!state || typeof state.led !== 'boolean' || state.gpio !== 2 || typeof state.device !== 'string')
      throw new Error('La respuesta del dispositivo no coincide con la API esperada.');
    return state;
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), this.config().interval);
  }

  async refresh(led?: boolean) {
    if (this.busy()) return;
    clearTimeout(this.timer);
    this.busy.set(true);
    const config  = this.config();
    const started = performance.now();
    try {
      const state           = await this.request(config, led);
      const wasDisconnected = this.connection() !== 'connected';
      this.consecutiveFailures = 0;
      this.state.set(state);
      this.connection.set('connected');
      this.error.set('');
      this.checkedAt.set(new Date());
      this.latency.set(Math.round(performance.now() - started));
      if (wasDisconnected) this.record(config.mode === 'demo' ? 'Sesión DEMO iniciada' : config.mode === 'serial' ? 'ESP32 conectada por USB' : 'ESP32 conectada');
      if (led !== undefined) {
        const message = state.led ? 'LED encendido correctamente' : 'LED apagado correctamente';
        this.record(message);
        this.notify(message);
      }
    } catch (error) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures < 2 && config.mode !== 'serial') { this.schedule(); return; }
      const message = error instanceof Error && !('status' in error) && error.name !== 'TimeoutError'
        ? error.message
        : config.mode === 'serial'
          ? 'No fue posible comunicarse por USB. Reconecta el puerto.'
          : 'No fue posible establecer comunicación. Revisa la IP, Wi-Fi y CORS.';
      if (this.connection() !== 'disconnected') { this.record('ESP32 desconectada'); this.notify(message); }
      this.connection.set('disconnected');
      this.state.set(null);
      this.latency.set(null);
      this.error.set(message);
    } finally { this.busy.set(false); this.schedule(); }
  }
}
