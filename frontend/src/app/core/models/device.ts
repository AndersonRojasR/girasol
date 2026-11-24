export interface ConnectionConfig { mode: 'demo' | 'real' | 'serial'; baseUrl: string; interval: number; }
export interface LedState { device: string; led: boolean; gpio: number; }
export interface DeviceEvent { id: number; time: Date; message: string; mode: 'demo' | 'real' | 'serial'; }
export const DEFAULT_CONFIG: ConnectionConfig = { mode: 'demo', baseUrl: 'http://192.168.1.105', interval: 5000 };
export function normalizeUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Dirección IP inválida. Usa http://192.168.1.105 sin rutas ni credenciales.');
  return url.origin;
}
