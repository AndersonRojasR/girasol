import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { MotorComponent } from './motor.component';

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear(); });

it('queues a jog clicked during polling instead of dropping the command', async () => {
  vi.useFakeTimers();
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [MotorComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(MotorComponent);
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(450);
  const motor = fixture.componentInstance;
  motor.jog(10);
  expect(motor.commandBusy()).toBe(true);
  await vi.advanceTimersByTimeAsync(250);
  expect(motor.state()?.position).toBe(10);
  expect(motor.commandBusy()).toBe(false);
  TestBed.inject(HttpTestingController).verify();
  fixture.destroy();
});

it('simulates jogging, saving max, and moving to percent without sending HTTP requests', async () => {
  vi.useFakeTimers();
  localStorage.clear();
  TestBed.configureTestingModule({ imports: [MotorComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(MotorComponent);
  fixture.detectChanges();
  await vi.advanceTimersByTimeAsync(200);
  const motor = fixture.componentInstance;
  expect(motor.state()?.position).toBe(0);
  expect(motor.state()?.maxSteps).toBe(0);
  motor.jog(500);
  await vi.advanceTimersByTimeAsync(120);
  expect(motor.state()?.position).toBe(500);
  motor.saveMax();
  await vi.advanceTimersByTimeAsync(120);
  expect(motor.state()?.maxSteps).toBe(500);
  motor.zero();
  await vi.advanceTimersByTimeAsync(120);
  expect(motor.state()?.position).toBe(0);
  expect(motor.state()?.maxSteps).toBe(500);
  motor.targetPercent = 50;
  motor.moveTo();
  await vi.advanceTimersByTimeAsync(120);
  expect(motor.state()?.moving).toBe(true);
  await vi.advanceTimersByTimeAsync(4000);
  expect(motor.state()?.position).toBe(250);
  expect(motor.state()?.moving).toBe(false);
  TestBed.inject(HttpTestingController).expectNone(request => request.url.includes('/motor/'));
  TestBed.inject(HttpTestingController).verify();
  fixture.destroy();
});
