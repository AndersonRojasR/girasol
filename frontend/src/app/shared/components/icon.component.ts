import { Component, Input } from '@angular/core';
@Component({ selector: 'iot-icon', standalone: true, template: '<svg [attr.width]="size" [attr.height]="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="icons[name] || icons[\'cpu\']" /></svg>', styles: [':host { display:inline-flex; vertical-align:middle; }'] })
export class IconComponent {
  @Input() name = 'cpu';
  @Input() size = 20;
  readonly icons: Record<string, string> = {
    home: 'M3 11 12 3l9 8 M5 9.5V21h5v-6h4v6h5V9.5',
    gamepad: 'M7 7h10a5 5 0 0 1 4.9 6l-.6 3a3 3 0 0 1-5.3 1.3L14.5 16h-5L8 17.3A3 3 0 0 1 2.7 16l-.6-3A5 5 0 0 1 7 7z M8 10v4 M6 12h4 M15.5 11h.01 M17.5 13h.01',
    bars: 'M5 20v-6 M10 20V9 M15 20v-8 M20 20V5 M3 20h18',
    clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 7v5l3 2',
    bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4z M10 21h4',
    user: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21c1-4 4-6 8-6s7 2 8 6',
    left: 'M15 5l-7 7 7 7', right: 'M9 5l7 7-7 7', up: 'M5 15l7-7 7 7', down: 'M5 9l7 7 7-7',
    hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V11 M11 10V4a1.5 1.5 0 0 1 3 0v6 M14 10.5V6a1.5 1.5 0 0 1 3 0v7.5 M8 13l-1.6-1.6a1.6 1.6 0 0 0-2.3 2.2L8 18c1.5 2 3 3 5.5 3a5.5 5.5 0 0 0 5.5-5.5V12',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 1v4 M12 19v4 M1 12h4 M19 12h4',
    navigation: 'M4 20 20 4l-6 17-3-7z',
    angle: 'M4 20h16 M4 20 16 6 M11 20a7 7 0 0 0-2.2-5',
    gauge: 'M12 14l4-4 M3.5 18a10 10 0 1 1 17 0z',
    cycle: 'M20 12a8 8 0 0 1-14.3 5 M4 12a8 8 0 0 1 14.3-5 M18 3v4h-4 M6 21v-4h4',
    bloom: 'M12 21v-6 M12 15c-3 0-6-2-7-6 3 0 5 1 7 3 2-2 4-3 7-3-1 4-4 6-7 6z M12 12c-1.5-2-1.5-5 0-8 1.5 3 1.5 6 0 8z',
    bud: 'M12 21v-5 M12 16c-3.5 0-5.5-3-5.5-6.5C6.5 6 9 3.5 12 3c3 .5 5.5 3 5.5 6.5S15.5 16 12 16z M9 6.5c2 1.5 4 4.5 3 9.5',
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
