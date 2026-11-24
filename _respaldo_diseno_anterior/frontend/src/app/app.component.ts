import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Esp32Service } from './core/services/esp32.service';
import { IconComponent } from './shared/components/icon.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent],
  template: `
<div class="shell" [class.light]="light()">
  <aside class="sidebar">

    <a routerLink="/" class="brand">
      <span class="brand-icon"><iot-icon name="flower" [size]="22" /></span>
      <span>GIRASOL<span class="brand-sub">SEGUIDOR SOLAR</span></span>
    </a>

    <div class="nav-label">MENÚ PRINCIPAL</div>
    <nav>
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
        <iot-icon name="dashboard" /> Inicio
      </a>
      <a routerLink="/motores" routerLinkActive="active">
        <iot-icon name="sliders" /> Control manual
      </a>
      <a routerLink="/sensores" routerLinkActive="active">
        <iot-icon name="activity" /> Monitores
      </a>
      <a routerLink="/historial" routerLinkActive="active">
        <iot-icon name="list" /> Historial
      </a>
      <a routerLink="/settings" routerLinkActive="active">
        <iot-icon name="settings" /> Configuración
      </a>
    </nav>

    <div class="sidebar-bottom">
      <div class="local-card girasol-local-card">
        <div class="sidebar-flower">
          <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden="true">
            <g transform="rotate(0,40,40)">
              @for (a of petalAngles; track $index) {
                <g [attr.transform]="'rotate(' + a + ',40,40)'">
                  <path d="M40,20 C35,12 34,6 40,2 C46,6 45,12 40,20Z" fill="#FACC15" opacity="0.9"/>
                </g>
              }
              <circle cx="40" cy="40" r="16" fill="#132513" stroke="#22C55E" stroke-width="4"/>
              <rect x="30" y="30" width="20" height="20" rx="2" transform="rotate(45,40,40)" fill="#0d1c0d" stroke="#1e361e"/>
            </g>
          </svg>
        </div>
        <span class="version" style="margin-top:4px;display:block">GIRASOL · v1.0</span>
        <p>Panel 50 W · Flandes, Tolima</p>
      </div>

      <div class="sidebar-status">
        <span class="dot" [class.offline-dot]="api.connection() !== 'connected'"></span>
        <span>
          {{ api.demo() ? 'Modo DEMO' : api.connection() === 'connected' ? 'ESP32 conectada' : 'Sin conexión' }}
        </span>
      </div>
    </div>

  </aside>

  <div class="main">
    <header class="topbar">
      <span class="breadcrumb">
        GIRASOL <iot-icon name="chevron" [size]="13" />
        <strong>Sistema de seguimiento solar biaxial</strong>
      </span>
      <div class="header-actions">
        <span class="connection-pill" [class.offline]="api.connection() === 'disconnected'">
          <span class="dot"></span>
          {{ api.demo() ? 'Modo DEMO' : api.serial() ? (api.connection() === 'connected' ? 'USB Serie' : 'Sin conexión USB') : api.connection() === 'connected' ? 'ESP32 conectada' : api.connection() === 'connecting' ? 'Conectando...' : 'Sin conexión' }}
        </span>
        <button class="icon-button" (click)="toggleTheme()" [attr.aria-label]="light() ? 'Tema oscuro' : 'Tema claro'">
          <iot-icon [name]="light() ? 'moon' : 'sun'" />
        </button>
        <a class="icon-button" routerLink="/settings" aria-label="Configuración">
          <iot-icon name="settings" />
        </a>
      </div>
    </header>

    <main><router-outlet /></main>

    <footer>
      <span><span class="dot gold-dot-sm"></span> GIRASOL · Seguidor Solar Biaxial</span>
      <span>Flandes, Tolima · Ing. Mecánica</span>
    </footer>
  </div>

  <!-- Mobile bottom navigation -->
  <nav class="bottom-nav">
    <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}">
      <iot-icon name="dashboard" [size]="22" />
      <span>Inicio</span>
    </a>
    <a routerLink="/motores" routerLinkActive="active">
      <iot-icon name="sliders" [size]="22" />
      <span>Control</span>
    </a>
    <a routerLink="/sensores" routerLinkActive="active">
      <iot-icon name="activity" [size]="22" />
      <span>Monitores</span>
    </a>
    <a routerLink="/historial" routerLinkActive="active">
      <iot-icon name="list" [size]="22" />
      <span>Historial</span>
    </a>
    <a routerLink="/settings" routerLinkActive="active">
      <iot-icon name="settings" [size]="22" />
      <span>Config</span>
    </a>
  </nav>

  @if(api.toast()) {
    <div class="toast" role="status">
      <iot-icon name="activity" />{{ api.toast() }}
      <button class="icon-button" (click)="api.toast.set('')" aria-label="Cerrar">×</button>
    </div>
  }
</div>
  `,
  styles: [`
.sidebar-flower {
  display: flex; justify-content: center; margin: 12px 0 6px;
}
.sidebar-status {
  display: flex; align-items: center; gap: 8px;
  font-size: 10px; color: var(--muted); padding: 14px 0 8px;
  border-top: 1px solid var(--line); margin-top: 8px;
}
.sidebar-status .dot { background: var(--green); }
.offline-dot { background: #EF4444 !important; }
  `]
})
export class AppComponent {
  readonly api = inject(Esp32Service);
  readonly light = signal(false);
  readonly petalAngles = [0, 45, 90, 135, 180, 225, 270, 315];

  constructor() {
    try { this.light.set(localStorage.getItem('iot-theme') === 'light'); } catch { }
  }
  toggleTheme() {
    this.light.update(v => !v);
    try { localStorage.setItem('iot-theme', this.light() ? 'light' : 'dark'); } catch { }
  }
}
