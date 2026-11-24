import { Component, Input } from '@angular/core';

/** Logo GIRASOL: flor con pétalos dorados que gira lentamente. */
@Component({
  selector: 'g-logo',
  standalone: true,
  template: `
<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 64 64" aria-hidden="true" class="logo" [class.spin]="spin">
  <defs>
    <linearGradient [attr.id]="uid + 'p'" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE45C"/><stop offset="1" stop-color="#F5B800"/>
    </linearGradient>
    <radialGradient [attr.id]="uid + 'c'" cx=".4" cy=".35" r=".7">
      <stop offset="0" stop-color="#5a3a12"/><stop offset="1" stop-color="#2a1906"/>
    </radialGradient>
  </defs>
  <g class="petals">
    @for (a of angles; track a) {
      <path [attr.transform]="'rotate(' + a + ' 32 32)'" d="M32 4c5 5 6 11 0 18-6-7-5-13 0-18z" [attr.fill]=" 'url(#' + uid + 'p)'"/>
    }
  </g>
  <circle cx="32" cy="32" r="10.5" [attr.fill]=" 'url(#' + uid + 'c)'" stroke="#F5B800" stroke-width="1.4"/>
  <circle cx="29" cy="29" r="2.2" fill="#ffffff" opacity=".18"/>
</svg>`,
  styles: [`
:host{display:inline-flex;filter:drop-shadow(0 4px 14px rgba(250,204,21,.35))}
.logo .petals{transform-origin:32px 32px}
.logo.spin .petals{animation:g-logo-spin 28s linear infinite}
@keyframes g-logo-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.logo.spin .petals{animation:none}}
`]
})
export class SunflowerLogoComponent {
  @Input() size = 44;
  @Input() spin = true;
  readonly uid = 'lg' + Math.random().toString(36).slice(2, 8);
  readonly angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
}
