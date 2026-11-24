export type GirasolModo = 'AUTO' | 'MAN' | 'DEF' | 'NOCHE' | 'INICIO';

export interface GirasolState {
  modo: GirasolModo;
  azimut: number;
  elevacion: number;
  azimutTarget: number;
  elevacionTarget: number;
  ldrNorte: number;
  ldrSur: number;
  ldrEste: number;
  ldrOeste: number;
  viento: number;
  lluvia: boolean;
  humedadSuelo: number;
  nivelTanque: boolean;
  bateria: number;
  bombaActiva: boolean;
  paroEmergencia: boolean;
  homingListo: boolean;
  fault: string;
}
