import { Component, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Número que se anima suavemente (count-up) cada vez que cambia su valor.
 * Respeta prefers-reduced-motion: en ese caso salta directo al valor.
 */
@Component({
  selector: 'g-num',
  standalone: true,
  template: '',
  styles: [':host{font-variant-numeric:tabular-nums}']
})
export class CountUpComponent implements OnChanges, OnDestroy {
  @Input() value: number | null | undefined = null;
  @Input() decimals = 0;
  @Input() duration = 900;
  @Input() empty = '—';

  private el = inject(ElementRef<HTMLElement>);
  private current = 0;
  private raf = 0;
  private first = true;

  ngOnChanges() {
    cancelAnimationFrame(this.raf);
    const host = this.el.nativeElement as HTMLElement;
    if (this.value == null || Number.isNaN(this.value)) { host.textContent = this.empty; this.first = true; return; }
    const to = this.value;
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = this.first ? 0 : this.current;
    this.first = false;
    if (reduce || from === to) { this.current = to; host.textContent = to.toFixed(this.decimals); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / this.duration);
      const e = 1 - Math.pow(1 - t, 4); // easeOutQuart
      this.current = from + (to - from) * e;
      host.textContent = this.current.toFixed(this.decimals);
      if (t < 1) this.raf = requestAnimationFrame(tick);
      else this.current = to;
    };
    this.raf = requestAnimationFrame(tick);
  }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }
}
