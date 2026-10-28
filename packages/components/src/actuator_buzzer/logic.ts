import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class BuzzerLogic implements IComponentLogic {
  private isPassive: boolean = false;
  private nominalFrequencyHz: number = 2500;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.isPassive !== undefined) {
      this.isPassive = Boolean(parameters.isPassive);
    }
    if (parameters?.nominalFrequencyHz !== undefined) {
      this.nominalFrequencyHz = Number(parameters.nominalFrequencyHz);
    }
  }

  public onInit(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default', isBeeping: false });
  }

  public onReset(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default', isBeeping: false });
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    const vcc = ctx.getPin('VCC');
    const gnd = ctx.getPin('GND');
    const vDiff = (vcc?.voltage ?? 0) - (gnd?.voltage ?? 0);

    if (vDiff >= 3.0) {
      ctx.setVisualState({
        state: 'active',
        isBeeping: true,
        frequencyHz: this.nominalFrequencyHz,
        voltage: vDiff,
      });
    } else {
      ctx.setVisualState({ state: 'default', isBeeping: false, voltage: vDiff });
    }
  }

  public onEnvironmentChange(_prop: string, _val: any, _ctx: ComponentContext): void {}

  public onTimerFired(_callbackId: string, _ctx: ComponentContext): void {}
}
