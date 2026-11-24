import { Component, Input, computed, signal } from '@angular/core';

/**
 * Ilustración animada del prototipo GIRASOL.
 * - Los pétalos se abren/cierran según `openness` (0 = cerrados, 1 = abiertos).
 * - La cabeza se orienta según azimut/elevación.
 * - Brillo solar, rayos y partículas de luz en movimiento continuo.
 */
@Component({
  selector: 'g-girasol-hero',
  standalone: true,
  template: `
<svg class="hero" [class.moving]="moving" viewBox="0 -20 400 570" role="img"
     [attr.aria-label]="'Prototipo GIRASOL, pétalos ' + (open() > .5 ? 'abiertos' : 'cerrados')">
  <defs>
    <radialGradient id="hGlow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FACC15" stop-opacity=".42"/>
      <stop offset=".45" stop-color="#FACC15" stop-opacity=".12"/>
      <stop offset="1" stop-color="#FACC15" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="hPetal" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#F2B705"/><stop offset=".55" stop-color="#FFD21F"/><stop offset="1" stop-color="#FFE873"/>
    </linearGradient>
    <linearGradient id="hPetalBack" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#B98300"/><stop offset="1" stop-color="#E5AE09"/>
    </linearGradient>
    <radialGradient id="hRing" cx=".42" cy=".38" r=".7">
      <stop offset="0" stop-color="#2FB24E"/><stop offset=".7" stop-color="#16803A"/><stop offset="1" stop-color="#0E5A27"/>
    </radialGradient>
    <linearGradient id="hPanel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d2733"/><stop offset=".5" stop-color="#0c131b"/><stop offset="1" stop-color="#1a2430"/>
    </linearGradient>
    <linearGradient id="hBody" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0E5A27"/><stop offset=".35" stop-color="#21A045"/><stop offset=".6" stop-color="#1A8A3B"/><stop offset="1" stop-color="#0B4A20"/>
    </linearGradient>
    <linearGradient id="hSteel" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5c6670"/><stop offset=".5" stop-color="#aeb7c0"/><stop offset="1" stop-color="#606a74"/>
    </linearGradient>
    <linearGradient id="hShine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="hPanelClip"><rect x="-44" y="-44" width="88" height="88" rx="4"/></clipPath>
  </defs>

  <!-- Halo y rayos -->
  <circle class="glow" cx="200" cy="200" r="190" fill="url(#hGlow)"/>
  <g class="rays" transform="translate(200 200)">
    @for (r of rays; track r) {
      <line [attr.transform]="'rotate(' + r + ')'" x1="0" y1="-150" x2="0" y2="-205" />
    }
  </g>

  <!-- Partículas de luz -->
  <g class="particles">
    @for (p of particles; track $index) {
      <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.r" [style.animation-delay.s]="p.d" [style.animation-duration.s]="p.t"/>
    }
  </g>

  <!-- Sombra -->
  <ellipse cx="200" cy="534" rx="96" ry="10" fill="#000" opacity=".45" class="shadow"/>

  <!-- Torre en celosía -->
  <g transform="translate(0 12)">
  <g class="tower">
    <path d="M118 512h164l-8-14H126z" fill="#6f7983"/>
    <path d="M126 498h148v-6H126z" fill="#8e98a2"/>
    <rect x="160" y="335" width="12" height="160" fill="url(#hSteel)"/>
    <rect x="228" y="335" width="12" height="160" fill="url(#hSteel)"/>
    <rect x="194" y="340" width="12" height="155" fill="#4c555e" opacity=".7"/>
    @for (y of braces; track y) {
      <rect x="166" [attr.y]="y" width="68" height="7" fill="#9aa4ad"/>
      <path [attr.d]="'M172 ' + (y + 7) + 'L228 ' + (y + 40)" stroke="#7f8993" stroke-width="5"/>
      <path [attr.d]="'M228 ' + (y + 7) + 'L172 ' + (y + 40)" stroke="#6b757f" stroke-width="5"/>
    }
    <rect x="150" y="330" width="100" height="10" rx="2" fill="#a9b2bb"/>
  </g>

  <!-- Cuerpo verde (base giratoria) -->
  <g class="body">
    <path d="M146 330c0-34 24-52 54-52s54 18 54 52z" fill="url(#hBody)"/>
    <rect x="146" y="318" width="108" height="14" rx="5" fill="#0d5424"/>
    <path d="M172 288c0-22 12-38 28-38s28 16 28 38z" fill="url(#hBody)"/>
    <ellipse cx="186" cy="300" rx="7" ry="16" fill="#fff" opacity=".12"/>
  </g>

  </g>

  <!-- Cabeza orientable -->
  <g transform="translate(0 -14) translate(200 200) scale(.9) translate(-200 -200)">
  <g class="head-wrap">
    <g class="head" [style.transform]="headTransform()">
      <!-- Pétalos traseros -->
      @for (a of backAngles; track a; let i = $index) {
        <g [attr.transform]="'translate(200 200) rotate(' + a + ') translate(0 -70)'">
          <g class="petal back" [style.transform]="'scaleY(' + backScale() + ')'" [style.transition-delay.ms]="i * 55">
            <path d="M-13 0C-26-30-20-74 0-98 20-74 26-30 13 0z" fill="url(#hPetalBack)"/>
          </g>
        </g>
      }

      <!-- Anillo -->
      <circle class="ring-pulse" cx="200" cy="200" r="84"/>
      <circle cx="200" cy="200" r="80" fill="url(#hRing)" stroke="#0b4a20" stroke-width="3"/>
      <circle cx="200" cy="200" r="64" fill="#0f6b2f" stroke="#0a3f1b" stroke-width="2"/>
      @for (a of frontAngles; track a) {
        <rect [attr.transform]="'translate(200 200) rotate(' + a + ')'" x="-5" y="-78" width="10" height="20" rx="2" fill="#111"/>
      }

      <!-- Panel solar -->
      <g transform="translate(200 200) rotate(45)">
        <rect x="-47" y="-47" width="94" height="94" rx="6" fill="#c9d1d9"/>
        <rect x="-44" y="-44" width="88" height="88" rx="4" fill="url(#hPanel)"/>
        <g stroke="#2a3a4a" stroke-width="1">
          @for (g of grid; track g) {
            <line [attr.x1]="g" y1="-44" [attr.x2]="g" y2="44"/>
            <line x1="-44" [attr.y1]="g" x2="44" [attr.y2]="g"/>
          }
        </g>
        <g clip-path="url(#hPanelClip)">
          <rect class="shine" x="-120" y="-60" width="60" height="120" fill="url(#hShine)"/>
        </g>
      </g>

      <!-- Pétalos frontales (se pliegan sobre el panel) -->
      @for (a of frontAngles; track a; let i = $index) {
        <g [attr.transform]="'translate(200 200) rotate(' + a + ') translate(0 -76)'">
          <g class="petal front" [style.transform]="'scaleY(' + frontScale() + ')'" [style.transition-delay.ms]="i * 70">
            <path d="M-17 0C-33-38-25-92 0-122 25-92 33-38 17 0z" fill="url(#hPetal)" stroke="#D39A00" stroke-width="1.2"/>
            <path d="M0-4V-96" stroke="#E0A500" stroke-width="2" opacity=".55"/>
            <rect x="-3" y="-34" width="6" height="34" fill="#151515"/>
          </g>
        </g>
      }
    </g>
  </g>
  </g>
</svg>`,
  styles: [`
:host{display:block;width:100%;height:100%}
.hero{width:100%;height:100%;overflow:visible;display:block}
.glow{transform-origin:200px 200px;animation:h-glow 5s ease-in-out infinite}
@keyframes h-glow{50%{transform:scale(1.08);opacity:.75}}
.rays{animation:h-rays 60s linear infinite}
.rays line{stroke:#FACC15;stroke-width:2;stroke-linecap:round;opacity:.14}
@keyframes h-rays{to{transform:translate(200px,200px) rotate(360deg)}}
.particles circle{fill:#FFE36A;opacity:0;animation:h-float 7s ease-in infinite}
@keyframes h-float{0%{opacity:0;transform:translateY(0)}20%{opacity:.9}100%{opacity:0;transform:translateY(-140px)}}
.head-wrap{transform-origin:200px 290px;animation:h-sway 7s ease-in-out infinite}
@keyframes h-sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}
.head{transform-origin:200px 200px;transition:transform 1.4s cubic-bezier(.65,0,.35,1)}
.petal{transform-origin:0 0;transform-box:view-box;transition:transform 1.15s cubic-bezier(.68,-.25,.32,1.25)}
.shine{animation:h-shine 5.5s ease-in-out infinite}
@keyframes h-shine{0%,55%{transform:translateX(0)}100%{transform:translateX(240px)}}
.ring-pulse{fill:none;stroke:#FACC15;stroke-width:2;opacity:0;transform-origin:200px 200px}
.moving .ring-pulse{animation:h-ring 1.1s ease-out infinite}
@keyframes h-ring{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}
.moving .head-wrap{animation:h-sway 7s ease-in-out infinite,h-buzz .18s linear infinite}
@keyframes h-buzz{50%{translate:.6px 0}}
@media (prefers-reduced-motion: reduce){
  .glow,.rays,.particles circle,.head-wrap,.shine,.moving .ring-pulse{animation:none!important}
  .head,.petal{transition-duration:.01ms!important}
}
`]
})
export class GirasolHeroComponent {
  private readonly _open = signal(1);
  private readonly _az = signal<number | null>(null);
  private readonly _el = signal<number | null>(null);

  @Input() set openness(v: number | null | undefined) { this._open.set(v == null ? 0.9 : Math.max(0, Math.min(1, v))); }
  @Input() set azimut(v: number | null | undefined) { this._az.set(v ?? null); }
  @Input() set elevacion(v: number | null | undefined) { this._el.set(v ?? null); }
  @Input() moving = false;

  readonly open = this._open.asReadonly();
  readonly frontScale = computed(() => (-0.6 + 1.6 * this._open()).toFixed(3));
  readonly backScale = computed(() => (0.35 + 0.65 * this._open()).toFixed(3));
  readonly headTransform = computed(() => {
    const az = this._az() ?? 180;
    const el = this._el() ?? 45;
    const rot = Math.max(-16, Math.min(16, ((az - 180) / 180) * 16));
    const sy = 0.84 + 0.16 * Math.sin((Math.max(0, Math.min(90, el)) * Math.PI) / 180);
    const ty = (1 - sy) * 40;
    return `translateY(${ty.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(1, ${sy.toFixed(3)})`;
  });

  readonly frontAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  readonly backAngles = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5];
  readonly rays = Array.from({ length: 24 }, (_, i) => i * 15);
  readonly grid = [-22, 0, 22];
  readonly braces = [345, 395, 445];
  readonly particles = Array.from({ length: 14 }, (_, i) => ({
    x: 60 + ((i * 97) % 280), y: 200 + ((i * 53) % 220), r: 1.2 + (i % 3) * 0.8,
    d: (i * 0.53) % 7, t: 6 + (i % 4)
  }));
}
