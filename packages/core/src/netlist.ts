import type {
  CircuitDefinition,
  WireDefinition,
  PinType,
  PinDirection,
  PinDigitalLevel,
  WorkbenchFaultPayload,
} from '@webboard/contracts';
import { generateBreadboardInternalBridges } from './breadboard.js';

export interface NetPinRef {
  componentId: string;
  pinId: string;
  pinKey: string;
}

export interface NetNode {
  id: string;
  pins: NetPinRef[];
  wireIds: string[];
  voltage?: number;
  isGround: boolean;
  isPower: boolean;
}

export interface PinDriverInfo {
  componentId: string;
  pinId: string;
  type?: PinType;
  direction?: PinDirection;
  voltage?: number;
  digitalLevel?: PinDigitalLevel;
}

export type PinResolver = (
  componentId: string,
  pinId: string,
  circuit?: CircuitDefinition
) => PinDriverInfo | undefined;

export interface NetlistResult {
  nets: NetNode[];
  pinToNetMap: Map<string, NetNode>;
  fault?: WorkbenchFaultPayload;
  hasFault: boolean;
  getNetForPin(componentId: string, pinId: string): NetNode | undefined;
}

export function defaultPinResolver(
  componentId: string,
  pinId: string,
  circuit?: CircuitDefinition
): PinDriverInfo {
  const upperPin = pinId.toUpperCase();
  const component = circuit?.components.find((c) => c.id === componentId);
  const componentType = component?.type || '';

  // Determinar se o componente atua como gerador de energia (Fontes, Baterias ou MCUs)
  const isPowerSource =
    componentType.includes('MCU') ||
    componentType.includes('ARDUINO') ||
    componentType.includes('ESP32') ||
    componentType.includes('POWER') ||
    componentType.includes('BATTERY') ||
    componentType.includes('SUPPLY') ||
    componentType === '';

  // Reconhecimento de alimentação padrão (5V, 3.3V, VIN) exclusivo para fontes ou MCUs
  if (
    isPowerSource &&
    (upperPin === '5V' ||
      upperPin === '3V3' ||
      upperPin === '3.3V' ||
      upperPin === 'VCC')
  ) {
    const voltage = upperPin === '3V3' || upperPin === '3.3V' ? 3.3 : 5.0;
    return {
      componentId,
      pinId,
      type: 'POWER_VCC',
      direction: 'OUTPUT',
      voltage,
      digitalLevel: 'HIGH',
    };
  }

  // Reconhecimento de Terra padrão (GND, GND_1, etc.) exclusivo para fontes ou MCUs
  if (isPowerSource && upperPin.startsWith('GND')) {
    return {
      componentId,
      pinId,
      type: 'POWER_GND',
      direction: 'OUTPUT',
      voltage: 0.0,
      digitalLevel: 'LOW',
    };
  }

  // Pinos do Arduino Uno conhecidos
  if (componentType === 'MICROCONTROLLER_ARDUINO_UNO') {
    if (upperPin.startsWith('A')) {
      return {
        componentId,
        pinId,
        type: 'ANALOG_IN',
        direction: 'INPUT',
      };
    }
    if (upperPin.startsWith('D')) {
      return {
        componentId,
        pinId,
        type: 'DIGITAL_IO',
        direction: 'INPUT', // padrão em boot até sketch configurar
      };
    }
  }

  // Pinos de componentes passivos, protoboards ou atuadores são terminais receptores (PASSIVE)
  return {
    componentId,
    pinId,
    type: 'PASSIVE',
  };
}

export class NetlistSolver {
  /**
   * Resolve o grafo de fios e componentes em nós equipotenciais (NetNodes)
   * e valida a integridade contra colisões de condução direta (RN-BNC-04).
   * Suporta pontes internas de condutância zero da Protoboard Virtual (Eixo A).
   */
  public static solve(
    circuit: CircuitDefinition,
    customPinResolver?: PinResolver
  ): NetlistResult {
    const pinToKey = (componentId: string, pinId: string) =>
      `${componentId}:${pinId}`;

    const resolver: PinResolver = (comp, pin) => {
      if (customPinResolver) {
        const custom = customPinResolver(comp, pin, circuit);
        if (custom) return custom;
      }
      return defaultPinResolver(comp, pin, circuit);
    };

    // 1. Construir lista de adjacência de pinos conectados por fios e pontes internas
    const adjacency = new Map<
      string,
      Array<{ targetKey: string; wireId: string; wire?: WireDefinition }>
    >();
    const allPinKeys = new Set<string>();

    const addEdge = (fromKey: string, toKey: string, wireId: string, wire?: WireDefinition) => {
      allPinKeys.add(fromKey);
      allPinKeys.add(toKey);

      if (!adjacency.has(fromKey)) adjacency.set(fromKey, []);
      if (!adjacency.has(toKey)) adjacency.set(toKey, []);

      adjacency.get(fromKey)!.push({ targetKey: toKey, wireId, wire });
      adjacency.get(toKey)!.push({ targetKey: fromKey, wireId, wire });
    };

    // 1.1 Fios externos explícitos do circuito
    for (const wire of circuit.wires) {
      const fromKey = pinToKey(wire.from.componentId, wire.from.pinId);
      const toKey = pinToKey(wire.to.componentId, wire.to.pinId);
      addEdge(fromKey, toKey, wire.id, wire);
    }

    // 1.2 Pontes internas de condutância zero de componentes (ex: Protoboards virtuais)
    for (const comp of circuit.components) {
      if (comp.type.includes('BREADBOARD') || comp.type === 'BOARD_BREADBOARD_HALF') {
        const bridges = generateBreadboardInternalBridges(comp.id);
        for (const bridge of bridges) {
          const fromKey = pinToKey(comp.id, bridge.fromPin);
          const toKey = pinToKey(comp.id, bridge.toPin);
          addEdge(fromKey, toKey, bridge.bridgeId);
        }
      } else if (comp.parameters?.internalBridges && Array.isArray(comp.parameters.internalBridges)) {
        for (const bridge of comp.parameters.internalBridges) {
          const fromKey = pinToKey(comp.id, bridge[0]);
          const toKey = pinToKey(comp.id, bridge[1]);
          addEdge(fromKey, toKey, `bridge:${comp.id}:${bridge[0]}_${bridge[1]}`);
        }
      }
    }

    // 2. Agrupamento em Nós Equipotenciais (BFS)
    const visited = new Set<string>();
    const nets: NetNode[] = [];
    const pinToNetMap = new Map<string, NetNode>();
    let netCounter = 0;

    for (const pinKey of allPinKeys) {
      if (visited.has(pinKey)) continue;

      const currentNetPins: NetPinRef[] = [];
      const currentNetWires = new Set<string>();
      const queue: string[] = [pinKey];
      visited.add(pinKey);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const [comp, pin] = current.split(':');
        currentNetPins.push({
          componentId: comp,
          pinId: pin,
          pinKey: current,
        });

        const neighbors = adjacency.get(current) || [];
        for (const edge of neighbors) {
          currentNetWires.add(edge.wireId);
          if (!visited.has(edge.targetKey)) {
            visited.add(edge.targetKey);
            queue.push(edge.targetKey);
          }
        }
      }

      // Propriedades do nó
      let isGround = false;
      let isPower = false;
      let nodeVoltage: number | undefined = undefined;

      for (const p of currentNetPins) {
        const info = resolver(p.componentId, p.pinId);
        if (info?.type === 'POWER_GND') {
          isGround = true;
          nodeVoltage = 0.0;
        } else if (info?.type === 'POWER_VCC') {
          isPower = true;
          nodeVoltage = info.voltage ?? 5.0;
        }
      }

      const netNode: NetNode = {
        id: `net_${netCounter++}`,
        pins: currentNetPins,
        wireIds: Array.from(currentNetWires),
        voltage: nodeVoltage,
        isGround,
        isPower,
      };

      nets.push(netNode);
      for (const p of currentNetPins) {
        pinToNetMap.set(p.pinKey, netNode);
      }
    }

    // 3. Verificação de Curto-Circuito / Colisão Direta (RN-BNC-04)
    let fault: WorkbenchFaultPayload | undefined = undefined;

    for (const net of nets) {
      const activeDrivers: Array<{
        pinRef: NetPinRef;
        info: PinDriverInfo;
      }> = [];

      for (const p of net.pins) {
        const info = resolver(p.componentId, p.pinId);
        if (!info) continue;

        // É um driver ativo de tensão se for POWER_VCC, POWER_GND ou OUTPUT ativo
        const isVcc = info.type === 'POWER_VCC';
        const isGnd = info.type === 'POWER_GND';
        const isOutput =
          info.direction === 'OUTPUT' &&
          (info.digitalLevel === 'HIGH' || info.digitalLevel === 'LOW');

        if (isVcc || isGnd || isOutput) {
          activeDrivers.push({ pinRef: p, info });
        }
      }

      // Checar conflitos par a par dentro do mesmo nó
      for (let i = 0; i < activeDrivers.length; i++) {
        for (let j = i + 1; j < activeDrivers.length; j++) {
          const d1 = activeDrivers[i];
          const d2 = activeDrivers[j];

          const isConflict =
            // VCC vs GND direto
            (d1.info.type === 'POWER_VCC' && d2.info.type === 'POWER_GND') ||
            (d1.info.type === 'POWER_GND' && d2.info.type === 'POWER_VCC') ||
            // VCC vs OUTPUT LOW
            (d1.info.type === 'POWER_VCC' && d2.info.digitalLevel === 'LOW') ||
            (d2.info.type === 'POWER_VCC' && d1.info.digitalLevel === 'LOW') ||
            // GND vs OUTPUT HIGH
            (d1.info.type === 'POWER_GND' && d2.info.digitalLevel === 'HIGH') ||
            (d2.info.type === 'POWER_GND' && d1.info.digitalLevel === 'HIGH') ||
            // OUTPUT HIGH vs OUTPUT LOW
            (d1.info.direction === 'OUTPUT' &&
              d2.info.direction === 'OUTPUT' &&
              d1.info.digitalLevel !== d2.info.digitalLevel &&
              d1.info.digitalLevel !== 'HIGH_Z' &&
              d2.info.digitalLevel !== 'HIGH_Z');

          if (isConflict) {
            const connectingWireId = NetlistSolver.findConnectingWire(
              d1.pinRef.pinKey,
              d2.pinRef.pinKey,
              adjacency
            );

            const pinoOrigem = `${d1.pinRef.componentId}:${d1.pinRef.pinId}`;
            const pinoDestino = `${d2.pinRef.componentId}:${d2.pinRef.pinId}`;

            fault = {
              type: 'SHORT_CIRCUIT',
              message: `[FALHA ELÉTRICA] Curto-circuito detectado: Conflito de condução direta no condutor ${connectingWireId} entre ${pinoOrigem} e ${pinoDestino}.`,
              failedWireId: connectingWireId,
              failedComponentId: d1.pinRef.componentId,
            };
            break;
          }
        }
        if (fault) break;
      }
      if (fault) break;
    }

    return {
      nets,
      pinToNetMap,
      fault,
      hasFault: fault !== undefined,
      getNetForPin: (compId: string, pId: string) =>
        pinToNetMap.get(pinToKey(compId, pId)),
    };
  }

  /**
   * Encontra o identificador do fio ou ponte que conecta dois pinos em um nó.
   */
  private static findConnectingWire(
    startKey: string,
    targetKey: string,
    adjacency: Map<
      string,
      Array<{ targetKey: string; wireId: string; wire?: WireDefinition }>
    >
  ): string {
    const queue: Array<{ currentKey: string; pathWires: string[] }> = [
      { currentKey: startKey, pathWires: [] },
    ];
    const visited = new Set<string>([startKey]);

    while (queue.length > 0) {
      const { currentKey, pathWires } = queue.shift()!;
      if (currentKey === targetKey && pathWires.length > 0) {
        return pathWires[0];
      }

      const neighbors = adjacency.get(currentKey) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.targetKey)) {
          visited.add(edge.targetKey);
          queue.push({
            currentKey: edge.targetKey,
            pathWires: [...pathWires, edge.wireId],
          });
        }
      }
    }

    return 'unknown_wire';
  }
}

