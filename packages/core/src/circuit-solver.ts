import type {
  CircuitDefinition,
  ComponentDefinition,
  PinDigitalLevel,
  PinDirection,
  PinType,
  WorkbenchFaultPayload,
} from '@webboard/contracts';
import { NetlistSolver, type NetNode, type PinDriverInfo } from './netlist.js';

export interface ComponentElectricalState {
  componentId: string;
  componentType: string;
  currentAmperes: number;
  voltageDrop: number;
  isConducting: boolean;
  isDestroyed: boolean;
  destroyedReason?: string;
  overcurrentExposureSeconds: number;
  visualState: 'default' | 'active' | 'destroyed';
}

export interface CircuitSolverOptions {
  /** Resistência interna dos transistores de saída do MCU (P-MOS / N-MOS) em Ohms. Padrão: 25 */
  mcuInternalResistanceOhms?: number;
  /** Resistência dinâmica de pequenos sinais do diodo/LED conduzindo em Ohms. Padrão: 0.1 */
  diodeDynamicResistanceOhms?: number;
  /** Tempo cumulativo de sobrecorrente tolerado antes de destruição térmica em segundos. Padrão: 0.010 (10ms) */
  overcurrentThresholdSeconds?: number;
}

export interface CircuitSolverResult {
  nets: NetNode[];
  voltages: Map<string, number>;
  componentStates: Map<string, ComponentElectricalState>;
  fault?: WorkbenchFaultPayload;
  hasFault: boolean;
  virtualTimeSeconds: number;
}

export class CircuitSolver {
  private circuit: CircuitDefinition;
  private options: Required<CircuitSolverOptions>;
  private virtualTimeSeconds: number = 0;
  private pinStates: Map<string, PinDriverInfo> = new Map();
  private componentStates: Map<string, ComponentElectricalState> = new Map();
  private fault?: WorkbenchFaultPayload;

  constructor(circuit: CircuitDefinition, options?: CircuitSolverOptions) {
    this.circuit = circuit;
    this.options = {
      mcuInternalResistanceOhms: options?.mcuInternalResistanceOhms ?? 25,
      diodeDynamicResistanceOhms: options?.diodeDynamicResistanceOhms ?? 0.1,
      overcurrentThresholdSeconds: options?.overcurrentThresholdSeconds ?? 0.01,
    };

    // Inicializar estados dos componentes
    for (const comp of circuit.components) {
      this.componentStates.set(comp.id, {
        componentId: comp.id,
        componentType: comp.type,
        currentAmperes: 0,
        voltageDrop: 0,
        isConducting: false,
        isDestroyed: false,
        overcurrentExposureSeconds: 0,
        visualState: 'default',
      });
    }
  }

  /**
   * Configura o estado operacional de um pino de saída ou entrada.
   */
  public setPinOutput(
    componentId: string,
    pinId: string,
    level: PinDigitalLevel,
    voltage?: number
  ): void {
    const key = `${componentId}:${pinId}`;
    const v = voltage ?? (level === 'HIGH' ? 5.0 : 0.0);
    this.pinStates.set(key, {
      componentId,
      pinId,
      type: 'DIGITAL_IO',
      direction: 'OUTPUT',
      digitalLevel: level,
      voltage: v,
    });
  }

  /**
   * Obtém o estado elétrico atual de um componente.
   */
  public getComponentState(
    componentId: string
  ): ComponentElectricalState | undefined {
    return this.componentStates.get(componentId);
  }

  /**
   * Retorna o snapshot atual do resultado do circuito.
   */
  public getResult(nets: NetNode[] = [], voltages = new Map<string, number>()): CircuitSolverResult {
    return {
      nets,
      voltages,
      componentStates: new Map(this.componentStates),
      fault: this.fault,
      hasFault: this.fault !== undefined,
      virtualTimeSeconds: this.virtualTimeSeconds,
    };
  }

  /**
   * Executa um passo de simulação física avançando o tempo virtual em dtSeconds.
   */
  public step(dtSeconds: number): CircuitSolverResult {
    // 1. Resolução de nós pelo NetlistSolver e checagem de curto-circuito direto (RN-BNC-04)
    const netlistResult = NetlistSolver.solve(this.circuit, (comp, pin) => {
      return this.pinStates.get(`${comp}:${pin}`);
    });

    if (netlistResult.hasFault) {
      this.fault = netlistResult.fault;
      return this.getResult(netlistResult.nets);
    }

    const nets = netlistResult.nets;
    const pinToNetMap = netlistResult.pinToNetMap;

    // 2. Determinar tensões de nós fixos (Fontes de alimentação e GPIOs ativos)
    const nodeVoltages = new Map<string, number>();
    const isNodeFixed = new Map<string, boolean>();

    for (const net of nets) {
      let fixedV: number | undefined = undefined;

      for (const p of net.pins) {
        const pinState = this.pinStates.get(p.pinKey);
        if (pinState && pinState.direction === 'OUTPUT') {
          fixedV = pinState.voltage ?? (pinState.digitalLevel === 'HIGH' ? 5.0 : 0.0);
          break;
        }

        const upperPin = p.pinId.toUpperCase();
        if (
          upperPin === '5V' ||
          upperPin === 'VCC' ||
          upperPin === '3V3' ||
          upperPin === '3.3V'
        ) {
          fixedV = upperPin.startsWith('3') ? 3.3 : 5.0;
          break;
        }
        if (upperPin.startsWith('GND')) {
          fixedV = 0.0;
          break;
        }
      }

      if (fixedV !== undefined) {
        nodeVoltages.set(net.id, fixedV);
        isNodeFixed.set(net.id, true);
      } else {
        nodeVoltages.set(net.id, 0.0);
        isNodeFixed.set(net.id, false);
      }
    }

    // 3. Identificar galhos de dois terminais associados aos nós
    interface Branch {
      component: ComponentDefinition;
      netA: NetNode;
      netB: NetNode;
      pinA: string;
      pinB: string;
    }

    const branches: Branch[] = [];

    for (const comp of this.circuit.components) {
      if (
        comp.type.includes('RESISTOR') ||
        comp.type.includes('LED') ||
        comp.type.includes('PUSHBUTTON')
      ) {
        // Encontrar os dois pinos conectados a nets
        const connectedPins: Array<{ pinId: string; net: NetNode }> = [];
        for (const net of nets) {
          for (const p of net.pins) {
            if (p.componentId === comp.id) {
              connectedPins.push({ pinId: p.pinId, net });
            }
          }
        }

        if (connectedPins.length >= 2) {
          branches.push({
            component: comp,
            netA: connectedPins[0].net,
            netB: connectedPins[1].net,
            pinA: connectedPins[0].pinId,
            pinB: connectedPins[1].pinId,
          });
        }
      }
    }

    // 4. Resolução iterativa de nós flutuantes (Nodal Analysis com Relaxação Gauss-Seidel)
    const MAX_ITERATIONS = 30;
    const TOLERANCE = 1e-5;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let maxDelta = 0;

      for (const net of nets) {
        if (isNodeFixed.get(net.id)) continue;

        // KCL no nó net: sum(I_in) = sum(I_out)
        // Para cada galho conectado ao nó:
        let numerator = 0;
        let denominator = 0;

        for (const b of branches) {
          if (b.netA.id !== net.id && b.netB.id !== net.id) continue;

          const isNodeA = b.netA.id === net.id;
          const otherNetId = isNodeA ? b.netB.id : b.netA.id;
          const vOther = nodeVoltages.get(otherNetId) ?? 0.0;
          const compState = this.componentStates.get(b.component.id);

          if (compState?.isDestroyed) {
            continue; // circuito aberto
          }

          if (b.component.type.includes('RESISTOR')) {
            const r = Number(b.component.parameters?.resistanceOhms) || 220;
            const g = 1 / r;
            denominator += g;
            numerator += g * vOther;
          } else if (b.component.type.includes('LED')) {
            const vf = Number(b.component.parameters?.forwardVoltageVolts) || 1.8;
            const rd = this.options.diodeDynamicResistanceOhms;
            const gd = 1 / rd;

            // Determinar qual terminal é o Anodo
            const isAnodeA =
              b.pinA.toUpperCase().includes('ANODE') ||
              b.pinA.toUpperCase() === 'A' ||
              b.pinA === 'PIN_1';
            const vAnode = isAnodeA ? (isNodeA ? nodeVoltages.get(net.id)! : vOther) : (isNodeA ? vOther : nodeVoltages.get(net.id)!);
            const vCathode = isAnodeA ? (isNodeA ? vOther : nodeVoltages.get(net.id)!) : (isNodeA ? nodeVoltages.get(net.id)! : vOther);

            if (vAnode - vCathode >= vf) {
              denominator += gd;
              if (isAnodeA) {
                // net é Anodo, vOther é Catodo
                numerator += gd * (vOther + vf);
              } else {
                // net é Catodo, vOther é Anodo
                numerator += gd * (vOther - vf);
              }
            }
          }
        }

        if (denominator > 0) {
          const nextV = numerator / denominator;
          const currentV = nodeVoltages.get(net.id) ?? 0.0;
          const delta = Math.abs(nextV - currentV);
          if (delta > maxDelta) maxDelta = delta;
          nodeVoltages.set(net.id, nextV);
        }
      }

      if (maxDelta < TOLERANCE) break;
    }

    // 5. Calcular Correntes, Quedas de Tensão e Atualizar Estados Físicos
    for (const b of branches) {
      const state = this.componentStates.get(b.component.id)!;
      if (state.isDestroyed) {
        state.currentAmperes = 0;
        state.voltageDrop = 0;
        state.isConducting = false;
        state.visualState = 'destroyed';
        continue;
      }

      const vA = nodeVoltages.get(b.netA.id) ?? 0.0;
      const vB = nodeVoltages.get(b.netB.id) ?? 0.0;

      if (b.component.type.includes('RESISTOR')) {
        const r = Number(b.component.parameters?.resistanceOhms) || 220;
        const vDiff = Math.abs(vA - vB);
        const current = vDiff / r;
        state.currentAmperes = current;
        state.voltageDrop = vDiff;
        state.isConducting = current > 1e-5;
        state.visualState = state.isConducting ? 'active' : 'default';
      } else if (b.component.type.includes('LED')) {
        const vf = Number(b.component.parameters?.forwardVoltageVolts) || 1.8;
        const maxI = Number(b.component.parameters?.maxCurrentAmperes) || 0.03;

        const isAnodeA =
          b.pinA.toUpperCase().includes('ANODE') ||
          b.pinA.toUpperCase() === 'A' ||
          b.pinA === 'PIN_1';
        const vAnode = isAnodeA ? vA : vB;
        const vCathode = isAnodeA ? vB : vA;
        const vDrop = vAnode - vCathode;

        let current = 0;

        // Se o LED estiver ligado diretamente entre dois nós fixos sem resistor em série
        const bothNodesFixed =
          Boolean(isNodeFixed.get(b.netA.id)) && Boolean(isNodeFixed.get(b.netB.id));

        if (vDrop >= vf) {
          if (bothNodesFixed) {
            // Conexão direta ao pino de saída: limitado pela resistência interna do driver MCU
            const rDriver = this.options.mcuInternalResistanceOhms;
            current = (vDrop - vf) / (rDriver + this.options.diodeDynamicResistanceOhms);
          } else {
            // Em série com resistor: a corrente é regulada pela malha
            // Procura a corrente do resistor em série no mesmo nó
            const intermediateNetId = isAnodeA ? b.netA.id : b.netB.id;
            const seriesResistorBranch = branches.find(
              (otherB) =>
                otherB.component.type.includes('RESISTOR') &&
                (otherB.netA.id === intermediateNetId ||
                  otherB.netB.id === intermediateNetId)
            );

            if (seriesResistorBranch) {
              const rState = this.componentStates.get(
                seriesResistorBranch.component.id
              );
              current = rState?.currentAmperes ?? (vDrop - vf) / this.options.diodeDynamicResistanceOhms;
            } else {
              current = (vDrop - vf) / this.options.diodeDynamicResistanceOhms;
            }
          }
        }

        state.currentAmperes = current;
        state.voltageDrop = Math.max(0, vDrop);

        // Checagem de Destruição Térmica por Sobrecarga (RN-BNC-05)
        if (current > maxI) {
          state.overcurrentExposureSeconds += dtSeconds;

          if (
            state.overcurrentExposureSeconds >=
            this.options.overcurrentThresholdSeconds
          ) {
            state.isDestroyed = true;
            state.destroyedReason = `Limite de corrente nominal violado (${(current * 1000).toFixed(1)}mA > ${(maxI * 1000).toFixed(1)}mA)`;
            state.currentAmperes = 0;
            state.isConducting = false;
            state.visualState = 'destroyed';

            this.fault = {
              type: 'OVERCURRENT',
              message: `[FALHA TÉRMICA] Sobrecorrente crítica em ${b.component.id}: Limite de corrente violado. O componente foi desativado por queima.`,
              failedComponentId: b.component.id,
            };
          } else {
            state.isConducting = true;
            state.visualState = 'active';
          }
        } else {
          // Operação segura: reseta tempo de exposição
          state.overcurrentExposureSeconds = 0;
          state.isConducting = current >= 0.001;
          state.visualState = state.isConducting ? 'active' : 'default';
        }
      }
    }

    this.virtualTimeSeconds += dtSeconds;
    return this.getResult(nets, nodeVoltages);
  }

  /**
   * Executa uma resolução pontual estática (snapshot).
   */
  public static solve(
    circuit: CircuitDefinition,
    options?: CircuitSolverOptions
  ): CircuitSolverResult {
    const solver = new CircuitSolver(circuit, options);
    return solver.step(0.001);
  }
}
