import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Esp32Service } from './esp32.service';
import { normalizeUrl } from '../models/device';

describe('ESP32 HTTP contract', () => {
  let service: Esp32Service;
  let http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem('smart-iot-config', JSON.stringify({ mode: 'real', baseUrl: 'http://192.168.1.105', interval: 5000 }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(Esp32Service);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear(); });
  it('reads the device response and prevents overlapping commands', async () => {
    await service.refresh(true);
    http.expectOne('http://192.168.1.105/estado').flush({ device: 'esp32-led', gpio: 2, led: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(service.state()?.led).toBe(false);
    const command = service.refresh(true);
    http.expectOne('http://192.168.1.105/led?estado=on').flush({ device: 'esp32-led', gpio: 2, led: true });
    await command;
    expect(service.state()?.led).toBe(true);
  });
  it('distinguishes disconnect from off and recovers through polling', async () => {
    http.expectOne('http://192.168.1.105/estado').flush('unavailable', { status: 503, statusText: 'Unavailable' });
    await vi.advanceTimersByTimeAsync(0);
    expect(service.connection()).toBe('disconnected');
    expect(service.state()).toBeNull();
    await vi.advanceTimersByTimeAsync(5000);
    http.expectOne('http://192.168.1.105/estado').flush({ device: 'esp32-led', gpio: 2, led: false });
    await vi.advanceTimersByTimeAsync(0);
    expect(service.connection()).toBe('connected');
    expect(service.state()?.led).toBe(false);
  });
  it('times out instead of leaving controls locked', async () => {
    const request = http.expectOne('http://192.168.1.105/estado');
    await vi.advanceTimersByTimeAsync(4000);
    expect(request.cancelled).toBe(true);
    expect(service.busy()).toBe(false);
    expect(service.connection()).toBe('disconnected');
  });
});

describe('connection URL', () => {
  it('accepts only HTTP origins', () => {
    expect(normalizeUrl(' http://192.168.1.105/ ')).toBe('http://192.168.1.105');
    for (const value of ['ftp://device', 'javascript:alert(1)', 'http://user:pass@device', 'http://device/path', 'not an IP']) expect(() => normalizeUrl(value)).toThrow();
  });
});
