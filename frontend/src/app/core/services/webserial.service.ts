import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WebSerialService {
  readonly supported = typeof navigator !== 'undefined' && 'serial' in navigator;
  readonly connected = signal(false);

  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer  = '';
  private pendingResolve: ((s: string) => void) | null = null;
  private pendingReject:  ((e: unknown)  => void) | null = null;
  private lock    = Promise.resolve<void>(undefined);
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();

  async connect(): Promise<void> {
    if (!this.supported) throw new Error('WebSerial no disponible. Usa Chrome o Edge.');
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });
    this.port   = port;
    this.reader = port.readable!.getReader();
    this.writer = port.writable!.getWriter();
    this.buffer = '';
    this.connected.set(true);
    void this.readLoop();
  }

  async disconnect(): Promise<void> {
    this.connected.set(false);
    this.pendingReject?.(new Error('Puerto desconectado.'));
    this.pendingResolve = null;
    this.pendingReject  = null;
    try { await this.reader?.cancel(); } catch { /* port may already be closing */ }
    try { this.writer?.releaseLock(); }  catch { /* ignore */ }
    try { await this.port?.close(); }    catch { /* ignore */ }
    this.port   = null;
    this.reader = null;
    this.writer = null;
  }

  private async readLoop(): Promise<void> {
    try {
      while (this.connected()) {
        const result = await this.reader!.read();
        if (result.done) break;
        this.buffer += this.decoder.decode(result.value, { stream: true });
        let nl: number;
        while ((nl = this.buffer.indexOf('\n')) !== -1) {
          const line = this.buffer.slice(0, nl).trim();
          this.buffer = this.buffer.slice(nl + 1);
          if (line.startsWith('{') && this.pendingResolve) {
            const resolve      = this.pendingResolve;
            this.pendingResolve = null;
            this.pendingReject  = null;
            resolve(line);
          }
        }
      }
    } catch {
      this.connected.set(false);
      const reject      = this.pendingReject;
      this.pendingResolve = null;
      this.pendingReject  = null;
      reject?.(new Error('Puerto serie desconectado.'));
    }
  }

  send(cmd: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.lock = this.lock.then(
        () => new Promise<void>(done => {
          if (!this.connected() || !this.writer) {
            reject(new Error('Puerto serie no conectado.'));
            done();
            return;
          }
          const timer = setTimeout(() => {
            this.pendingResolve = null;
            this.pendingReject  = null;
            reject(new Error('Tiempo de espera del puerto serie agotado.'));
            done();
          }, 2000);

          this.pendingResolve = line => { clearTimeout(timer); resolve(line); done(); };
          this.pendingReject  = err  => { clearTimeout(timer); reject(err);   done(); };

          this.writer!.write(this.encoder.encode(cmd + '\n')).catch(err => {
            clearTimeout(timer);
            this.pendingResolve = null;
            this.pendingReject  = null;
            reject(err);
            done();
          });
        })
      );
    });
  }
}
