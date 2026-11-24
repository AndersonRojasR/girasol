import { Component, inject } from '@angular/core';
import { Esp32Service } from '../../core/services/esp32.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  standalone: true,
  imports: [IconComponent],
  template: `
<div class="page-heading">
  <div>
    <div class="eyebrow">REGISTRO DE ACTIVIDAD DEL SISTEMA</div>
    <h1>Historial<span class="heading-dot gold-dot">.</span></h1>
    <p>Últimos {{ api.events().length }} eventos · Sesión actual</p>
  </div>
  <button class="button secondary" (click)="api.events.set([])">
    <iot-icon name="refresh" [size]="15" /> Limpiar
  </button>
</div>

<article class="panel activity-panel g-activity" style="max-width:900px">
  <div class="panel-title" style="margin-bottom:16px">
    <h3><iot-icon name="activity" /> Actividad registrada</h3>
    <span class="muted">{{ api.demo() ? 'DEMO' : (api.serial() ? 'USB Serie' : 'Red local') }}</span>
  </div>
  @for (ev of api.events(); track ev.id) {
    <div class="event">
      <span class="event-icon"><iot-icon name="check" [size]="13" /></span>
      <span>{{ ev.message }}
        <small>{{ ev.mode === 'demo' ? 'DEMO' : ev.mode === 'serial' ? 'USB' : 'ESP32' }}</small>
      </span>
      <time>{{ ev.time.toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit', second:'2-digit'}) }}</time>
    </div>
  } @empty {
    <div style="padding:48px 0;text-align:center;color:var(--muted)">
      <iot-icon name="activity" [size]="36" />
      <p style="margin:14px 0 0;font-size:13px">Sin actividad registrada en esta sesión.</p>
      <p style="margin:6px 0 0;font-size:11px">Los comandos enviados al ESP32 aparecerán aquí.</p>
    </div>
  }
</article>
  `
})
export class HistorialComponent {
  readonly api = inject(Esp32Service);
}
