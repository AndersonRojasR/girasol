interface SerialPortRequestOptions {
  filters?: { usbVendorId?: number; usbProductId?: number }[];
}
interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}
interface SerialPort extends EventTarget {
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}
interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}
interface Navigator {
  readonly serial: Serial;
}
