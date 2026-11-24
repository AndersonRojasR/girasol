import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Esp32Service } from '../../core/services/esp32.service';
import { WebSerialService } from '../../core/services/webserial.service';
import { ConnectionConfig, DEFAULT_CONFIG, normalizeUrl } from '../../core/models/device';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  standalone: true,
  imports: [FormsModule, IconComponent],
  template: `
<div class="page-heading">
  <div>
    <div class="eyebrow">PERSONALIZA TU ESPACIO</div>
    <h1>Configuración<span class="heading-dot">.</span></h1>
    <p>Una conexión sencilla, un control completo.</p>
  </div>
</div>

<section class="panel settings-panel">
  <div class="panel-title"><h3><iot-icon name="sliders" /> Conexión y funcionamiento</h3></div>
  <form (ngSubmit)="save()">
    <label for="mode">Modo de funcionamiento</label>
    <select id="mode" name="mode" [(ngModel)]="draft.mode" [disabled]="working || api.busy()">
      <option value="demo">DEMO · Simulación sin hardware</option>
      <option value="real">ESP32 real · Red Wi-Fi local</option>
      <option value="serial">ESP32 real · Cable USB (WebSerial)</option>
    </select>
    <p class="field-hint">DEMO nunca envía solicitudes al dispositivo físico. USB requiere Chrome o Edge y el ESP32 conectado al PC.</p>

    @if (draft.mode !== 'serial') {
      <label for="url">Dirección IP o URL base</label>
      <input id="url" name="url" type="url" required [(ngModel)]="draft.baseUrl"
             placeholder="http://192.168.1.105" [disabled]="working || api.busy()">
      <p class="field-hint">Incluye http://. Sin rutas, parámetros ni credenciales.</p>
    }

    <label for="interval">Actualización automática (segundos)</label>
    <input id="interval" name="interval" type="number" min="2" max="60" step="1"
           [(ngModel)]="seconds" [disabled]="working || api.busy()">
    <p class="field-hint">Entre 2 y 60 segundos. Las solicitudes nunca se superponen.</p>

    @if (draft.mode === 'serial') {
      <div style="margin:16px 0 8px">
        @if (serial.connected()) {
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span class="dot" style="background:#22c55e;width:9px;height:9px;border-radius:50%;flex-shrink:0"></span>
            <span>Puerto USB conectado</span>
          </div>
          <button class="button secondary" type="button" (click)="disconnect()" [disabled]="working">
            Desconectar puerto
          </button>
        } @else {
          @if (!serial.supported) {
            <p class="error" role="alert">WebSerial no disponible. Usa Chrome o Edge (no Firefox ni Safari).</p>
          } @else {
            <button class="button primary" type="button" (click)="connect()" [disabled]="working">
              <iot-icon name="wifi" [size]="17" /> Conectar por USB
            </button>
          }
          <p class="field-hint" style="margin-top:8px">Selecciona el puerto COM del ESP32 cuando aparezca el diálogo.</p>
        }
      </div>
    }

    <div class="settings-actions">
      <button class="button primary" type="submit" [disabled]="working || api.busy()">
        Guardar configuración
      </button>
      @if (draft.mode !== 'serial') {
        <button class="button secondary" type="button" [disabled]="working || api.busy()" (click)="test()">
          <iot-icon name="wifi" [size]="17" /> Probar conexión
        </button>
      }
    </div>
    <button class="text-button" type="button" [disabled]="working || api.busy()" (click)="reset()">
      Restaurar configuración predeterminada
    </button>
    @if (result) { <p class="test-result" role="status">{{result}}</p> }
  </form>
</section>

@if (api.connection() === 'connected' && !api.demo()) {
  <section class="panel settings-panel" style="margin-top:20px">
    <div class="panel-title"><h3><iot-icon name="zap" /> Prueba de hardware</h3></div>
    <p style="margin-bottom:14px;color:var(--muted)">LED integrado del ESP32 (GPIO 2). Verifica que la conexión responde correctamente.</p>
    <div class="settings-actions">
      <button class="button primary" type="button" (click)="ledOn()" [disabled]="api.busy()">
        <iot-icon name="sun" /> Encender LED
      </button>
      <button class="button secondary" type="button" (click)="ledOff()" [disabled]="api.busy()">
        <iot-icon name="moon" /> Apagar LED
      </button>
    </div>
    @if (api.state(); as s) {
      <p class="test-result" role="status" style="margin-top:12px">
        LED: <strong>{{ s.led ? 'Encendido' : 'Apagado' }}</strong>
        @if (api.latency() !== null) { · {{ api.latency() }} ms }
      </p>
    }
  </section>
}

<div class="demo-banner settings-note">
  <iot-icon name="help" />
  <div>
    <strong>Tu dispositivo y tu navegador, en la misma red</strong>
    <p>Usa HTTP local o USB para evitar bloqueos de contenido mixto. Esta versión no tiene autenticación: solo redes de confianza. El modo USB elimina la dependencia del Wi-Fi y reduce la latencia.</p>
  </div>
</div>`
})
export class SettingsComponent {
  readonly api    = inject(Esp32Service);
  readonly serial = inject(WebSerialService);

  draft:   ConnectionConfig = { ...this.api.config() };
  seconds  = this.draft.interval / 1000;
  working  = false;
  result   = '';

  ledOn()  { void this.api.refresh(true); }
  ledOff() { void this.api.refresh(false); }

  private values(): ConnectionConfig {
    return {
      ...this.draft,
      baseUrl:  this.draft.mode === 'serial' ? this.draft.baseUrl : normalizeUrl(this.draft.baseUrl),
      interval: this.seconds * 1000,
    };
  }

  async save() {
    this.working = true;
    try {
      await this.api.save(this.values());
      this.result = 'Configuración guardada. ' + (this.api.error() || 'Conexión disponible.');
      this.api.notify('Configuración guardada');
    } catch (error) {
      this.result = String(error);
      this.api.notify(this.result);
    } finally { this.working = false; }
  }

  async test() {
    this.working = true;
    this.result  = 'Conectando...';
    try {
      this.result = await this.api.test(this.values());
    } catch (error) {
      this.result = 'No fue posible establecer comunicación. ' + (error instanceof Error ? error.message : 'Revisa la IP, Wi-Fi y CORS.');
    } finally { this.working = false; }
  }

  async connect() {
    this.working = true;
    this.result  = '';
    try {
      await this.serial.connect();
      this.result = 'Puerto USB conectado. Guarda la configuración para activar el modo serie.';
    } catch (error) {
      this.result = error instanceof Error ? error.message : 'No se pudo conectar al puerto serie.';
    } finally { this.working = false; }
  }

  async disconnect() {
    this.working = true;
    try { await this.serial.disconnect(); } finally { this.working = false; }
  }

  async reset() {
    this.draft   = { ...DEFAULT_CONFIG };
    this.seconds = DEFAULT_CONFIG.interval / 1000;
    await this.save();
  }
}
