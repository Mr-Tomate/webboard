import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class PotentiometerLogic implements IComponentLogic {
  private alpha: number = 0.5;
  private totalResistanceOhms: number = 10000;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.alpha !== undefined) {
      this.alpha = Math.max(0.0, Math.min(1.0, Number(parameters.alpha)));
    }
    if (parameters?.totalResistanceOhms !== undefined) {
      this.totalResistanceOhms = Number(parameters.totalResistanceOhms);
    }
  }

  public onInit(ctx: ComponentContext): void {
    this.updateWiperVoltage(ctx);
  }

  public onReset(ctx: ComponentContext): void {
    this.alpha = 0.5;
    this.updateWiperVoltage(ctx);
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    this.updateWiperVoltage(ctx);
  }

  public onEnvironmentChange(prop: string, val: any, ctx: ComponentContext): void {
    if (prop === 'alpha' || prop === 'position') {
      this.alpha = Math.max(0.0, Math.min(1.0, Number(val)));
      this.updateWiperVoltage(ctx);
    }
  }

  public onTimerFired(_callbackId: string, _ctx: ComponentContext): void {}

  private updateWiperVoltage(ctx: ComponentContext): void {
    const t1 = ctx.getPin('TERMINAL_1');
    const t2 = ctx.getPin('TERMINAL_2');
    const v1 = t1?.voltage ?? 0.0;
    const v2 = t2?.voltage ?? 5.0; // Assume padrão se t2 conectado ao 5V

    const vWiper = v1 + this.alpha * (v2 - v1);
    ctx.writePinVoltage('WIPER', vWiper);
    ctx.setVisualState({
      state: 'active',
      alpha: this.alpha,
      wiperVoltage: vWiper,
      rotationDegrees: (this.alpha - 0.5) * 270,
    });
  }
}
