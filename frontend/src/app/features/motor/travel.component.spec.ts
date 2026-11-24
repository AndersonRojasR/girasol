import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { TravelComponent } from './travel.component';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear(); });

it('maps the simulated range, positions within it, and never contacts physical hardware', async () => {
  vi.useFakeTimers();
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [TravelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(TravelComponent);
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(200);
  const motor = fixture.componentInstance;
  expect(motor.supportsLimits).toBe(true);
  motor.home();
  expect(motor.commandBusy()).toBe(false);
  motor.limitsChecked = true;
  motor.home();
  await vi.advanceTimersByTimeAsync(5000);
  expect(motor.state()?.referenced).toBe(true);
  motor.target = 50;
  motor.move();
  await vi.advanceTimersByTimeAsync(3000);
  expect(motor.state()?.positionPercent).toBe(50);
  expect(motor.state()?.moving).toBe(false);
  TestBed.inject(HttpTestingController).verify();
  fixture.destroy();
});
