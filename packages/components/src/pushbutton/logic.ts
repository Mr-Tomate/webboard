import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class PushbuttonLogic implements IComponentLogic {
  private isPressed: boolean = false;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.isPressed !== undefined) {
      this.isPressed = Boolean(parameters.isPressed);
    }
  }

  public onInit(ctx: ComponentContext): void {
    ctx.setVisualState({ state: this.isPressed ? 'active' : 'default', isPressed: this.isPressed });
  }

  public onReset(ctx: ComponentContext): void {
    this.isPressed = false;
    ctx.setVisualState({ state: 'default', isPressed: false });
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    this.syncConduction(ctx);
  }

  public onEnvironmentChange(prop: string, val: any, ctx: ComponentContext): void {
    if (prop === 'isPressed' || prop === 'pressed') {
      this.isPressed = Boolean(val);
      ctx.setVisualState({ state: this.isPressed ? 'active' : 'default', isPressed: this.isPressed });
      this.syncConduction(ctx);
    }
  }

  public onTimerFired(_callbackId: string, _ctx: ComponentContext): void {}

  private syncConduction(ctx: ComponentContext): void {
    if (this.isPressed) {
      const p1 = ctx.getPin('PIN_1A') || ctx.getPin('PIN_1B');
      const p2 = ctx.getPin('PIN_2A') || ctx.getPin('PIN_2B');
      if (p1 && p2) {
        if (p1.voltage !== undefined && p2.voltage === undefined) {
          ctx.writePinVoltage('PIN_2A', p1.voltage);
          ctx.writePinVoltage('PIN_2B', p1.voltage);
        } else if (p2.voltage !== undefined && p1.voltage === undefined) {
          ctx.writePinVoltage('PIN_1A', p2.voltage);
          ctx.writePinVoltage('PIN_1B', p2.voltage);
        }
      }
    }
  }
}
