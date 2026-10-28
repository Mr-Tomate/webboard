import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class BreadboardLogic implements IComponentLogic {
  constructor(_parameters?: Record<string, any>) {}

  public onInit(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default' });
  }

  public onReset(ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default' });
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    ctx.setVisualState({ state: 'default' });
  }

  public onEnvironmentChange(_prop: string, _val: any, _ctx: ComponentContext): void {}

  public onTimerFired(_callbackId: string, _ctx: ComponentContext): void {}
}
