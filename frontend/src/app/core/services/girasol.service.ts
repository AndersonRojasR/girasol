import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { Esp32Service } from './esp32.service';
import { GirasolState } from '../models/girasol';

@Injectable({ providedIn: 'root' })
export class GirasolService {
  private http = inject(HttpClient);
  private esp32 = inject(Esp32Service);

  readonly state = signal<GirasolState | null>(null);
  readonly error = signal('');
  readonly available = computed(() => this.state() !== null);

  private timer?: ReturnType<typeof setTimeout>;
  private demoWind = 5.2;
  private demoHumedad = 67;

  constructor() { this.schedule(0); }

  private schedule(delay = 3000) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), delay);
  }

  async refresh() {
    const config = this.esp32.config();
    if (config.mode === 'demo') {
      this.updateDemo();
      this.schedule();
      return;
    }
    if (this.esp32.connection() !== 'connected') { this.schedule(); return; }
    try {
      const s = await firstValueFrom(
        this.http.get<GirasolState>(config.baseUrl + '/girasol/estado').pipe(timeout(2000))
      );
      this.state.set(s);
      this.error.set('');
    } catch {
      this.state.set(null);
      this.error.set('Firmware GIRASOL no detectado. Puedes probar el motor con la conexión actual.');
    }
    this.schedule();
  }

  private updateDemo() {
    this.demoWind += (Math.random() - 0.5) * 0.6;
    this.demoWind = Math.max(0.5, Math.min(11, this.demoWind));
    this.demoHumedad += (Math.random() - 0.5) * 0.4;
    this.demoHumedad = Math.max(40, Math.min(90, this.demoHumedad));

    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;
    const isDay = hour >= 6 && hour <= 18.5;
    const t = isDay ? (hour - 6) / 12.5 : 0;
    const elevacion = isDay ? Math.round(Math.sin(t * Math.PI) * 86) : 0;
    const azimut = isDay ? Math.round(70 + t * 220) : 70;
    const noon = t > 0.5;
    const ldrBase = isDay ? 2800 : 180;
    const sp = isDay ? 350 : 40;

    this.state.set({
      modo: isDay ? 'AUTO' : 'NOCHE',
      azimut,
      elevacion,
      azimutTarget: Math.min(360, Math.max(0, azimut + Math.round((Math.random() - 0.5) * 6))),
      elevacionTarget: Math.max(0, elevacion + Math.round((Math.random() - 0.5) * 4)),
      ldrNorte: ldrBase - 180 + Math.round(Math.random() * sp),
      ldrSur: ldrBase + 280 + Math.round(Math.random() * sp),
      ldrEste: ldrBase + (noon ? -320 : 380) + Math.round(Math.random() * sp),
      ldrOeste: ldrBase + (noon ? 380 : -320) + Math.round(Math.random() * sp),
      viento: parseFloat(this.demoWind.toFixed(1)),
      lluvia: false,
      humedadSuelo: Math.round(this.demoHumedad),
      nivelTanque: true,
      bateria: parseFloat((12.4 + Math.random() * 0.3).toFixed(2)),
      bombaActiva: false,
      paroEmergencia: false,
      homingListo: true,
      fault: ''
    });
  }

  batteryPct(v: number): number {
    return Math.round(Math.max(0, Math.min(100, (v - 11.0) / (14.4 - 11.0) * 100)));
  }

  ldrBalanceNS(s: GirasolState): number {
    const sum = s.ldrNorte + s.ldrSur;
    return sum > 0 ? (s.ldrNorte - s.ldrSur) / sum : 0;
  }

  ldrBalanceEO(s: GirasolState): number {
    const sum = s.ldrEste + s.ldrOeste;
    return sum > 0 ? (s.ldrEste - s.ldrOeste) / sum : 0;
  }
}
