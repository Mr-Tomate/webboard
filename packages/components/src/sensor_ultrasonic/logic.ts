import type { ComponentContext, IComponentLogic } from '@webboard/contracts';

export class UltrasonicSensorLogic implements IComponentLogic {
  private minDistanceCm: number = 2.0;
  private maxDistanceCm: number = 400.0;
  private timeoutMicros: number = 38000;
  private isEchoHigh: boolean = false;
  private currentDistanceCm: number = 20.0;

  constructor(parameters?: Record<string, any>) {
    if (parameters?.minDistanceCm !== undefined) {
      this.minDistanceCm = Number(parameters.minDistanceCm);
    }
    if (parameters?.maxDistanceCm !== undefined) {
      this.maxDistanceCm = Number(parameters.maxDistanceCm);
    }
    if (parameters?.timeoutMicros !== undefined) {
      this.timeoutMicros = Number(parameters.timeoutMicros);
    }
    if (parameters?.distanceCm !== undefined) {
      this.currentDistanceCm = Number(parameters.distanceCm);
    }
  }

  public onInit(ctx: ComponentContext): void {
    ctx.writePinDigital('ECHO', 'LOW');
    ctx.setVisualState({ state: 'default', distanceCm: this.currentDistanceCm });
  }

  public onReset(ctx: ComponentContext): void {
    this.isEchoHigh = false;
    ctx.writePinDigital('ECHO', 'LOW');
    ctx.setVisualState({ state: 'default', distanceCm: this.currentDistanceCm });
  }

  public onPinChange(pinId: string, ctx: ComponentContext): void {
    if (pinId === 'TRIG') {
      const trig = ctx.getPin('TRIG');
      if (trig?.digitalLevel === 'HIGH' && !this.isEchoHigh) {
        this.triggerMeasurement(ctx);
      }
    }
  }

  public onEnvironmentChange(prop: string, val: any, ctx: ComponentContext): void {
    if (prop === 'distanceCm' || prop === 'distance') {
      this.currentDistanceCm = Number(val);
    } else if (prop === 'obstacles' && Array.isArray(val) && val.length > 0) {
      this.currentDistanceCm = Number(val[0].distanceCm ?? this.currentDistanceCm);
    }
  }

  public onTimerFired(callbackId: string, ctx: ComponentContext): void {
    if (callbackId === 'ECHO_FALLING_EDGE') {
      this.isEchoHigh = false;
      ctx.writePinDigital('ECHO', 'LOW');
      ctx.setVisualState({ state: 'default', distanceCm: this.currentDistanceCm });
    }
  }

  private triggerMeasurement(ctx: ComponentContext): void {
    // Consulta o ambiente para obter o obstáculo mais recente
    const envObstacles = ctx.getEnvironmentValue('obstacles');
    if (Array.isArray(envObstacles) && envObstacles.length > 0) {
      this.currentDistanceCm = Number(envObstacles[0].distanceCm ?? this.currentDistanceCm);
    }

    const d = this.currentDistanceCm;
    let pulseWidthMicros = this.timeoutMicros;

    if (d >= this.minDistanceCm && d <= this.maxDistanceCm) {
      // 58 microssegundos por centímetro de acordo com o datasheet do HC-SR04
      pulseWidthMicros = Math.round(d * 58);
    }

    this.isEchoHigh = true;
    ctx.writePinDigital('ECHO', 'HIGH');
    ctx.scheduleTimer(pulseWidthMicros, 'ECHO_FALLING_EDGE');
    ctx.setVisualState({
      state: 'active',
      distanceCm: d,
      pulseWidthMicros,
    });
  }
}
