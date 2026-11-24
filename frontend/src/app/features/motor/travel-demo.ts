import { MotorState } from '../../core/models/motor';

export class TravelDemo {
  private state: MotorState = { id: 0, kind: 'stepper', ticks: 0, countsPerTurn: 0, position: 0, target: 0, maxSteps: 0, referenced: false, moving: false, invert: false, fault: '', limitMinimum: false, limitMaximum: false, homing: 'idle', travelSteps: 0, switchSpanSteps: 0, positionPercent: null, targetPercent: null };
  private phaseTicks = 0;
  execute(action: string, values: Record<string, string> = {}): MotorState {
    const state = this.state;
    if (action === 'home') {
      if (state.moving) throw new Error('Detén el motor antes de mapear.');
      Object.assign(state, { homing: 'seek-minimum', moving: true, referenced: false, travelSteps: 0, switchSpanSteps: 0, positionPercent: null, targetPercent: null, limitMinimum: false, limitMaximum: false, fault: '', invert: values['invert'] === 'true' });
      this.phaseTicks = 0;
    }
    if (action === 'stop') {
      if (state.moving) Object.assign(state, { referenced: false, travelSteps: 0, positionPercent: null, targetPercent: null });
      state.moving = false;
      state.homing = 'idle';
      state.fault = '';
      state.limitMinimum = state.limitMaximum = false;
    }
    if (action === 'target') {
      const target = Number(values['percent']);
      if (!state.referenced || !state.travelSteps || state.moving) throw new Error('Mapea el recorrido antes de mover.');
      if (values['percent'] === undefined || !Number.isFinite(target) || target < 0 || target > 100) throw new Error('Introduce una posición entre 0 y 100 %.');
      state.targetPercent = target;
      state.moving = true;
    }
    if (action === 'estado' && state.moving) {
      if (state.homing !== 'idle') {
        this.phaseTicks++;
        if (this.phaseTicks === 3) { state.homing = 'seek-maximum'; state.limitMinimum = true; }
        if (this.phaseTicks === 4) state.limitMinimum = false;
        if (this.phaseTicks === 8) { state.homing = 'clear-maximum'; state.limitMaximum = true; }
        if (this.phaseTicks === 9) state.limitMaximum = false;
        if (this.phaseTicks >= 10) Object.assign(state, { homing: 'idle', moving: false, referenced: true, travelSteps: 400, switchSpanSteps: 414, ticks: 400, positionPercent: 100, targetPercent: 100 });
      } else {
        const difference = state.targetPercent! - state.positionPercent!;
        state.positionPercent! += Math.sign(difference) * Math.min(10, Math.abs(difference));
        state.ticks = Math.round(state.positionPercent! * state.travelSteps! / 100);
        state.moving = state.positionPercent !== state.targetPercent;
      }
    }
    return { ...state };
  }
}
