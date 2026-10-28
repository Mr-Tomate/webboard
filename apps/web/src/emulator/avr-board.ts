import {
  CPU,
  avrInstruction,
  AVRIOPort,
  AVRUSART,
  AVRTimer,
  portBConfig,
  portCConfig,
  portDConfig,
  usart0Config,
  timer0Config,
  PinState
} from 'avr8js';
import { parseIntelHex } from './intel-hex.ts';
import { createDefaultBlinkFirmware } from './firmware-samples.ts';

export interface AvrPinChangeCallback {
  (pinName: string, level: 'HIGH' | 'LOW'): void;
}

export interface AvrSerialOutputCallback {
  (text: string): void;
}

export class AVRBoard {
  public readonly cpu: CPU;
  public readonly portB: AVRIOPort;
  public readonly portC: AVRIOPort;
  public readonly portD: AVRIOPort;
  public readonly usart: AVRUSART;
  public readonly timer0: AVRTimer;

  private isRunning = false;
  private timerHandle: any = null;
  private serialBuffer = '';

  private pinChangeListeners: AvrPinChangeCallback[] = [];
  private serialOutputListeners: AvrSerialOutputCallback[] = [];

  private lastPinStates: Record<string, 'HIGH' | 'LOW'> = {};

  constructor(initialProgram?: Uint16Array) {
    const prog = initialProgram ?? createDefaultBlinkFirmware();
    this.cpu = new CPU(prog);

    this.portB = new AVRIOPort(this.cpu, portBConfig);
    this.portC = new AVRIOPort(this.cpu, portCConfig);
    this.portD = new AVRIOPort(this.cpu, portDConfig);
    this.timer0 = new AVRTimer(this.cpu, timer0Config);
    this.usart = new AVRUSART(this.cpu, usart0Config, 16000000);

    this.setupListeners();
  }

  private setupListeners(): void {
    this.usart.onByteTransmit = (byte: number) => {
      const char = String.fromCharCode(byte);
      this.serialBuffer += char;

      if (char === '\n' || this.serialBuffer.length >= 80) {
        const line = this.serialBuffer.trimEnd();
        this.serialBuffer = '';
        if (line) {
          for (const listener of this.serialOutputListeners) {
            listener(line);
          }
        }
      }
    };

    this.portB.addListener(() => {
      this.checkPin('D13', this.portB.pinState(5));
      this.checkPin('D12', this.portB.pinState(4));
      this.checkPin('D11', this.portB.pinState(3));
      this.checkPin('D10', this.portB.pinState(2));
      this.checkPin('D9', this.portB.pinState(1));
      this.checkPin('D8', this.portB.pinState(0));
    });

    this.portD.addListener(() => {
      this.checkPin('D7', this.portD.pinState(7));
      this.checkPin('D6', this.portD.pinState(6));
      this.checkPin('D5', this.portD.pinState(5));
      this.checkPin('D4', this.portD.pinState(4));
      this.checkPin('D3', this.portD.pinState(3));
      this.checkPin('D2', this.portD.pinState(2));
      this.checkPin('D1', this.portD.pinState(1));
      this.checkPin('D0', this.portD.pinState(0));
    });

    this.portC.addListener(() => {
      this.checkPin('A0', this.portC.pinState(0));
      this.checkPin('A1', this.portC.pinState(1));
      this.checkPin('A2', this.portC.pinState(2));
      this.checkPin('A3', this.portC.pinState(3));
      this.checkPin('A4', this.portC.pinState(4));
      this.checkPin('A5', this.portC.pinState(5));
    });
  }

  private checkPin(pinName: string, state: PinState): void {
    const level: 'HIGH' | 'LOW' = state === PinState.High ? 'HIGH' : 'LOW';
    if (this.lastPinStates[pinName] !== level) {
      this.lastPinStates[pinName] = level;
      for (const listener of this.pinChangeListeners) {
        listener(pinName, level);
      }
    }
  }

  public onPinChange(listener: AvrPinChangeCallback): () => void {
    this.pinChangeListeners.push(listener);
    return () => {
      this.pinChangeListeners = this.pinChangeListeners.filter((l) => l !== listener);
    };
  }

  public onSerialOutput(listener: AvrSerialOutputCallback): () => void {
    this.serialOutputListeners.push(listener);
    return () => {
      this.serialOutputListeners = this.serialOutputListeners.filter((l) => l !== listener);
    };
  }

  public sendSerialString(text: string): void {
    for (let i = 0; i < text.length; i++) {
      this.usart.writeByte(text.charCodeAt(i));
    }
  }

  public loadProgram(prog: Uint16Array): void {
    this.cpu.progBytes.set(new Uint8Array(prog.buffer, prog.byteOffset, prog.byteLength));
    this.reset();
  }

  public loadHex(hexString: string): void {
    parseIntelHex(hexString, this.cpu.progBytes);
    this.reset();
  }

  public reset(): void {
    this.cpu.reset();
    this.lastPinStates = {};
    this.serialBuffer = '';
  }

  public step(instructionCount: number = 1000): void {
    for (let i = 0; i < instructionCount; i++) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }
  }

  public start(speedInstructionsPerInterval: number = 10000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timerHandle = setInterval(() => {
      if (!this.isRunning) return;
      this.step(speedInstructionsPerInterval);
    }, 10);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  public getPinLevel(pinName: string): 'HIGH' | 'LOW' {
    return this.lastPinStates[pinName] ?? 'LOW';
  }

  public getActive(): boolean {
    return this.isRunning;
  }
}
