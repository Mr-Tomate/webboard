import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class LedLogic implements IComponentLogic {
  private color: string = 'RED';
  private forwardVoltageVolts: number = 1.8;
  private maxCurrentAmperes: number = 0.03;
  private isDestroyed: boolean = false;
  private overcurrentTimerActive: boolean = false;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.color) this.color = String(parameters.color).toUpperCase();
    if (parameters?.forwardVoltageVolts !== undefined) {
      this.forwardVoltageVolts = Number(parameters.forwardVoltageVolts);
    } else {
      this.forwardVoltageVolts = this.color === 'BLUE' || this.color === 'WHITE' ? 3.0 : 1.8;
    }
    if (parameters?.maxCurrentAmperes !== undefined) {
      this.maxCurrentAmperes = Number(parameters.maxCurrentAmperes);
    }
  }

  public onInit(ctx: ComponentContext): void {
    this.isDestroyed = false;
    ctx.setVisualState({ state: 'default', color: this.color, brightness: 0 });
  }

  public onReset(ctx: ComponentContext): void {
    this.isDestroyed = false;
    this.overcurrentTimerActive = false;
    ctx.setVisualState({ state: 'default', color: this.color, brightness: 0 });
  }

  public onPinChange(_pinId: string, ctx: ComponentContext): void {
    if (this.isDestroyed) {
      ctx.setVisualState({ state: 'failure', color: this.color, brightness: 0 });
      return;
    }

    const anode = ctx.getPin('ANODE');
    const cathode = ctx.getPin('CATHODE');
    const vAnode = anode?.voltage ?? 0;
    const vCathode = cathode?.voltage ?? 0;
    const vDrop = vAnode - vCathode;
    const current = anode?.currentAmperes ?? 0;

    // Condução direta com tolerância para arredondamento de ponto flutuante IEEE 754
    if (vDrop >= this.forwardVoltageVolts - 1e-3 && current > 1e-4) {
      // Checagem de sobrecorrente crítica
      if (current > this.maxCurrentAmperes) {
        if (!this.overcurrentTimerActive) {
          this.overcurrentTimerActive = true;
          // Agenda timer de 10ms (10000 micros) de tolerância térmica (RN-BNC-05)
          ctx.scheduleTimer(10000, 'THERMAL_OVERLOAD');
        }
      } else {
        this.overcurrentTimerActive = false;
      }

      const brightness = Math.min(1.0, current / 0.02);
      ctx.setVisualState({ state: 'active', color: this.color, brightness, currentAmperes: current });
    } else {
      this.overcurrentTimerActive = false;
      ctx.setVisualState({ state: 'default', color: this.color, brightness: 0, currentAmperes: 0 });
    }
  }

  public onEnvironmentChange(_prop: string, _val: any, _ctx: ComponentContext): void {}

  public onTimerFired(callbackId: string, ctx: ComponentContext): void {
    if (callbackId === 'THERMAL_OVERLOAD' && !this.isDestroyed) {
      this.isDestroyed = true;
      this.overcurrentTimerActive = false;
      ctx.emitFailure(
        'OVERCURRENT',
        `[FALHA TÉRMICA] Sobrecorrente crítica no LED: Limite de corrente violado. O componente foi desativado por queima.`
      );
      ctx.setVisualState({ state: 'failure', color: this.color, brightness: 0 });
    }
  }
}
