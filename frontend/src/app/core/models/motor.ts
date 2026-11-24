export interface MotorState {
  // DRV8833 fields
  id?: number;
  position: number;
  target: number;
  maxSteps?: number;
  moving: boolean;
  percent?: number | null;
  invert: boolean;
  fault: string;
  // Legacy stepper_limits fields (travel component)
  kind?: string;
  ticks?: number;
  countsPerTurn?: number;
  referenced?: boolean;
  limitMinimum?: boolean;
  limitMaximum?: boolean;
  homing?: string;
  travelSteps?: number;
  switchSpanSteps?: number;
  positionPercent?: number | null;
  targetPercent?: number | null;
}
