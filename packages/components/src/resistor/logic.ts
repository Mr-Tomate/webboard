import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class ResistorLogic implements IComponentLogic {
  private resistanceOhms: number = 220;
  private powerRatingWatts: number = 0.25;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.resistanceOhms !== undefined) {
      this.resistanceOhms = Number(parameters.resistanceOhms);
    }
    if (parameters?.powerRatingWatts !== undefined) {
      this.powerRatingWatts = Number(parameters.powerRatingWatts);
    }
  }

  public onInit(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default', resistanceOhms: this.resistanceOhms });
  }

  public onReset(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default', resistanceOhms: this.resistanceOhms });
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    const p1 = ctx.getPin('PIN_1');
    const p2 = ctx.getPin('PIN_2');
    const vDiff = Math.abs((p1?.voltage ?? 0) - (p2?.voltage ?? 0));
    const current = this.resistanceOhms > 0 ? vDiff / this.resistanceOhms : 0;
    const power = vDiff * current;

    if (power > this.powerRatingWatts * 2) {
      ctx.emitFailure(
        'OVERCURRENT',
        `Potência dissipada no resistor excedeu limite nominal (${power.toFixed(2)}W > ${this.powerRatingWatts}W)`
      );
      ctx.setVisualState({ state: 'failure', powerWatts: power });
      return;
    }

    if (current > 1e-4) {
      ctx.setVisualState({ state: 'active', currentAmperes: current, voltageDrop: vDiff });
    } else {
      ctx.setVisualState({ state: 'default', currentAmperes: 0, voltageDrop: 0 });
    }
  }

  public onEnvironmentChange(_prop: string, _val: any, _ctx: ComponentContext): void {}

  public onTimerFired(_callbackId: string, _ctx: ComponentContext): void {}
}
