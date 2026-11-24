import { Component, Input } from '@angular/core';
@Component({ selector: 'iot-icon', standalone: true, template: '<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="icons[name] || icons[\'cpu\']" /></svg>', styles: [':host { display:inline-flex; vertical-align:middle; }'] })
export class IconComponent {
  @Input() name = 'cpu';
  @Input() size = 20;
  readonly icons: Record<string, string> = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    cpu: 'M5 5h14v14H5z M9 9h6v6H9z M9 2v3 M15 2v3 M9 19v3 M15 19v3 M2 9h3 M2 15h3 M19 9h3 M19 15h3',
    settings: 'M9 3h6l1 4 4 1v8l-4 1-1 4H9l-1-4-4-1V8l4-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    wifi: 'M2 8a16 16 0 0 1 20 0 M5 12a11 11 0 0 1 14 0 M8 16a6 6 0 0 1 8 0 M12 20h.01',
    bulb: 'M9 18h6 M9 21h6 M9 15c0-2-4-3-4-7a7 7 0 0 1 14 0c0 4-4 5-4 7v1H9z',
    activity: 'M2 12h5l3-9 4 18 3-9h5', arrow: 'M7 17 17 7 M7 7h10v10',
    moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10',
    sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1',
    chevron: 'm9 5 7 7-7 7', zap: 'm13 2-9 12h7l-1 8 10-12h-7z',
    radio: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 5a10 10 0 0 0 0 14 M19 5a10 10 0 0 1 0 14 M8 8a6 6 0 0 0 0 8 M16 8a6 6 0 0 1 0 8',
    refresh: 'M20 7a9 9 0 1 0 1 8 M20 2v6h-6', power: 'M12 2v10 M6 5a9 9 0 1 0 12 0',
    sliders: 'M4 3v7 M4 14v7 M12 3v3 M12 10v11 M20 3v11 M20 18v3 M1 10h6 M9 6h6 M17 14h6',
    help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9 9a3 3 0 1 1 4 3c-1 1-1 1-1 3 M12 18h.01',
    check: 'm5 12 4 4 10-10', menu: 'M3 6h18 M3 12h18 M3 18h18',
    wind: 'M4 6h8.5a2.5 2.5 0 0 1 0 5H4 M4 12h10.5a2.5 2.5 0 0 1 0 5H4 M4 9h15.5a2 2 0 0 1 0 4',
    drop: 'M12 2C9.5 5.5 6 9.5 6 14a6 6 0 0 0 12 0C18 9.5 14.5 5.5 12 2z',
    leaf: 'M2 22c3-3 6-8 7-14 M4 16c3-3 9-6 17-6-1 7-6 11-11 12a7 7 0 0 1-6-6z',
    shield: 'M12 2L4 6v5c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V6z',
    battery: 'M6 7h11a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M18 10h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2',
    sunrise: 'M17 18a5 5 0 0 0-10 0 M12 3v3 M5.5 7.5l1.5 1.5 M2 18h2 M20 18h2 M18.5 9L17 7.5 M23 22H1 M9 5l3-3 3 3',
    compass: 'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z',
    flower: 'M12 22V12 M12 12C12 8 9 5 5 5c0 4 3 7 7 7 M12 12c0-4 3-7 7-7 0 4-3 7-7 7 M12 12C8 12 5 9 5 5c0 0 4 0 7 7 M12 12c4 0 7-3 7-7 0 0-4 0-7 7',
    thermometer: 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
    alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
    list: 'M9 7h11 M9 12h11 M9 17h11 M5 7h.01 M5 12h.01 M5 17h.01',
    trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M9 6V4h6v2 M10 11v6 M14 11v6'
  };
}
