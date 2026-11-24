import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Esp32Service } from './core/services/esp32.service';
import { IconComponent } from './shared/components/icon.component';
import { SunflowerLogoComponent } from './shared/components/sunflower-logo.component';

interface NavItem { path: string; label: string; short: string; icon: string; exact?: boolean; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, IconComponent, SunflowerLogoComponent],
  template: `
<div class="shell g2" [class.light]="light()">
  <!-- Fondo ambiental animado -->
  <div class="g-ambient" aria-hidden="true">
    <span class="g-blob b1"></span><span class="g-blob b2"></span><span class="g-blob b3"></span>
  </div>

  <!-- ═════════ SIDEBAR (escritorio) ═════════ -->
  <aside class="sidebar g-sidebar">
    <a routerLink="/" class="g-brand">
      <g-logo [size]="46" />
      <span class="g-brand-text">
        <strong>GIRASOL</strong>
        <small>Seguidor Solar Biaxial</small>
      </span>
    </a>

    <nav class="g-nav" aria-label="Principal">
      @for (item of nav; track item.path; let i = $index) {
        <a [routerLink]="item.path" routerLinkActive="active" #rla="routerLinkActive"
           [routerLinkActiveOptions]="{exact: !!item.exact}" [style.--i]="i"
           [attr.aria-current]="rla.isActive ? 'page' : null">
          <iot-icon [name]="item.icon" [size]="21" />
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>

    <div class="g-side-bottom">
      <div class="g-status-card" [class.off]="!online()">
        <span class="g-wifi"><iot-icon name="wifi" [size]="20" /></span>
        <span>
          <strong>{{ statusTitle() }}</strong>
          <small>{{ statusSub() }}</small>
        </span>
      </div>
      <svg class="g-leaves" viewBox="0 0 220 120" aria-hidden="true">
        <path class="lf l1" d="M10 120C20 70 60 40 120 38 100 80 70 110 10 120z"/>
        <path class="lf l2" d="M-10 120C10 95 30 80 60 76 55 100 30 115-10 120z"/>
        <path class="vein" d="M14 116C45 88 80 62 116 42"/>
      </svg>
    </div>
  </aside>

  <div class="main g-main">
    <!-- ═════════ HEADER ═════════ -->
    <header class="g-topbar">
      <button class="g-icon-btn g-only-mobile" aria-label="Menú" (click)="menu.set(!menu())">
        <iot-icon name="menu" [size]="22" />
      </button>
      <a routerLink="/" class="g-brand g-brand-mobile g-only-mobile">
        <g-logo [size]="34" />
        <span class="g-brand-text"><strong>GIRASOL</strong><small>Seguidor Solar</small></span>
      </a>

      <div class="g-head-title g-hide-mobile">
        <h1>{{ pageTitle() }}</h1>
        <p>{{ pageSub() }}</p>
      </div>

      <div class="g-head-actions">
        @if (api.demo()) { <span class="g-demo-chip g-only-mobile"><i></i>Demo</span> }
        <span class="g-conn g-hide-mobile" [class.off]="!online()">
          <iot-icon name="wifi" [size]="22" />
          <span><strong>{{ statusTitle() }}</strong><small>{{ statusSub() }}</small></span>
        </span>
        <button class="g-icon-btn g-round g-hide-mobile" (click)="toggleTheme()" [attr.aria-label]="light() ? 'Tema oscuro' : 'Tema claro'">
          <iot-icon [name]="light() ? 'moon' : 'sun'" [size]="20" />
        </button>
        <button class="g-icon-btn g-round g-bell g-hide-mobile" aria-label="Notificaciones" (click)="openNotices()">
          <iot-icon name="bell" [size]="21" />
          @if (api.events().length) { <i class="g-badge-dot"></i> }
        </button>
        <a class="g-icon-btn g-round g-hide-mobile" routerLink="/settings" aria-label="Configuración">
          <iot-icon name="user" [size]="21" />
        </a>
      </div>
    </header>

    <!-- Menú desplegable móvil -->
    @if (menu()) {
      <div class="g-mobile-menu" (click)="menu.set(false)">
        <div class="g-mobile-sheet" (click)="$event.stopPropagation()">
          @for (item of nav; track item.path; let i = $index) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: !!item.exact}"
               (click)="menu.set(false)" [style.--i]="i">
              <iot-icon [name]="item.icon" [size]="20" /> {{ item.label }}
            </a>
          }
          <button class="g-sheet-theme" (click)="toggleTheme()">
            <iot-icon [name]="light() ? 'moon' : 'sun'" [size]="18" /> {{ light() ? 'Tema oscuro' : 'Tema claro' }}
          </button>
        </div>
      </div>
    }

    <main class="g-content"><router-outlet /></main>

    <footer class="g-footer">
      <span><span class="dot gold-dot-sm"></span> GIRASOL · Seguidor Solar Biaxial</span>
      <span>Flandes, Tolima · Ing. Mecánica</span>
    </footer>
  </div>

  <!-- ═════════ NAV INFERIOR (móvil) ═════════ -->
  <nav class="bottom-nav g-bottom-nav" aria-label="Navegación móvil">
    @for (item of nav; track item.path) {
      <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{exact: !!item.exact}">
        <iot-icon [name]="item.icon" [size]="22" />
        <span>{{ item.short }}</span>
      </a>
    }
  </nav>

  @if (api.toast()) {
    <div class="toast g-toast" role="status">
      <span class="g-toast-icon"><iot-icon name="bell" [size]="16" /></span>
      <span>{{ api.toast() }}</span>
      <button class="icon-button" (click)="api.toast.set('')" aria-label="Cerrar">×</button>
    </div>
  }
</div>
  `
})
export class AppComponent {
  readonly api = inject(Esp32Service);
  private router = inject(Router);
  readonly light = signal(false);
  readonly menu = signal(false);

  readonly nav: NavItem[] = [
    { path: '/', label: 'Inicio', short: 'Inicio', icon: 'home', exact: true },
    { path: '/motores', label: 'Control manual', short: 'Control', icon: 'gamepad' },
    { path: '/sensores', label: 'Monitoreo', short: 'Monitoreo', icon: 'bars' },
    { path: '/historial', label: 'Historial', short: 'Historial', icon: 'clock' },
    { path: '/settings', label: 'Configuración', short: 'Ajustes', icon: 'settings' },
  ];

  private readonly titles: Record<string, [string, string]> = {
    '': ['Panel de control', 'Control y monitoreo del prototipo GIRASOL'],
    motores: ['Control manual', 'Calibración y movimiento de los motores'],
    motor: ['Vista interactiva', 'Orientación del seguidor en tiempo real'],
    panel: ['Vista interactiva', 'Orientación del seguidor en tiempo real'],
    sensores: ['Monitoreo', 'Sensores LDR, clima y energía'],
    historial: ['Historial', 'Eventos y actividad del sistema'],
    settings: ['Configuración', 'Conexión con la ESP32 y preferencias'],
    dashboard: ['Dashboard', 'Resumen del dispositivo'],
  };

  private readonly url = toSignal(
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(e => (e as NavigationEnd).urlAfterRedirects)),
    { initialValue: this.router.url }
  );
  private readonly section = computed(() => (this.url() || '/').split(/[?#]/)[0].split('/')[1] ?? '');
  readonly pageTitle = computed(() => (this.titles[this.section()] ?? this.titles[''])[0]);
  readonly pageSub = computed(() => (this.titles[this.section()] ?? this.titles[''])[1]);

  readonly online = computed(() => this.api.connection() === 'connected');
  readonly statusTitle = computed(() => {
    const c = this.api.connection();
    if (c === 'connected') return this.api.serial() ? 'ESP32 por USB' : 'ESP32 conectada';
    return c === 'connecting' ? 'Conectando…' : 'Sin conexión';
  });
  readonly statusSub = computed(() =>
    this.api.demo() ? 'Modo demo' : this.api.serial() ? 'USB serie' : this.online() ? 'Wi-Fi local' : 'Revisa la red'
  );

  constructor() {
    try { this.light.set(localStorage.getItem('iot-theme') === 'light'); } catch { }
  }
  toggleTheme() {
    this.light.update(v => !v);
    try { localStorage.setItem('iot-theme', this.light() ? 'light' : 'dark'); } catch { }
  }
  openNotices() {
    const last = this.api.events()[0];
    this.api.notify(last ? last.message : 'Sin notificaciones nuevas');
  }
}
