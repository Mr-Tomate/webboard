import type {
  CircuitDefinition,
  WorkbenchMode,
  WorkbenchFaultPayload
} from '@webboard/contracts';
import {
  CircuitSolver,
  NetlistSolver,
  type NetlistResult,
  type ComponentElectricalState
} from '@webboard/core';
import { AVRBoard } from '../emulator/avr-board.ts';

export type EngineStateChangeCallback = (mode: WorkbenchMode, fault: WorkbenchFaultPayload | null) => void;
export type EngineDirtyCallback = (dirtyComponentIds: Set<string>) => void;
export type EngineSerialCallback = (text: string) => void;

export interface WorkbenchEngineOptions {
  autoLoop?: boolean;
  batchIntervalMs?: number;
  instructionsPerBatch?: number;
}

/**
 * WorkbenchEngine - Motor Headless de Simulação e Física da Bancada Virtual.
 *
 * Desacopla estritamente o loop da CPU (16MHz) e a resolução do CircuitSolver
 * da árvore de componentes React, garantindo taxa de quadros estável (60 FPS)
 * através de acumulação de tempo discreto e Dirty Flags pontuais.
 *
 * Conforme: docs/spec/12_arquitetura_de_renderizacao_e_workbench_engine.md
 */
export class WorkbenchEngine {
  private circuit: CircuitDefinition | null = null;
  private solver: CircuitSolver | null = null;
  private avrBoard: AVRBoard | null = null;

  private mode: WorkbenchMode = 'MODO_EDICAO';
  private fault: WorkbenchFaultPayload | null = null;

  private electricalStates = new Map<string, ComponentElectricalState>();
  private dirtyComponents = new Set<string>();

  private stateChangeListeners: EngineStateChangeCallback[] = [];
  private dirtyListeners: EngineDirtyCallback[] = [];
  private serialListeners: EngineSerialCallback[] = [];

  private isRunning = false;
  private loopHandle: any = null;
  private batchIntervalMs: number;
  private instructionsPerBatch: number;

  constructor(options: WorkbenchEngineOptions = {}) {
    this.batchIntervalMs = options.batchIntervalMs ?? 10;
    this.instructionsPerBatch = options.instructionsPerBatch ?? 10000;
  }

  /**
   * Carrega uma nova topologia de circuito na bancada.
   */
  public loadCircuit(circuit: CircuitDefinition): void {
    if (this.mode === 'MODO_SIMULACAO') {
      throw new Error('RN-BNC-01: Não é permitido carregar novo circuito durante a simulação.');
    }
    this.circuit = circuit;
    this.electricalStates.clear();
    this.dirtyComponents.clear();
  }

  /**
   * Retorna a topologia do circuito carregado atualmente.
   */
  public getCircuit(): CircuitDefinition | null {
    return this.circuit;
  }

  /**
   * Avalia a topologia estática em busca de curtos-circuitos imediatos em T=0 (RN-BNC-04).
   */
  public validateNetlist(): NetlistResult {
    const target = this.circuit ?? {
      schemaVersion: '1.0.0',
      circuitId: 'empty',
      components: [],
      wires: []
    };
    return NetlistSolver.solve(target);
  }

  /**
   * Inicia o ciclo de simulação energizada.
   */
  public startSimulation(): boolean {
    if (!this.circuit) return false;

    // 1. Validação estática de topologia (RN-BNC-04)
    const netlistCheck = this.validateNetlist();
    if (netlistCheck.hasFault && netlistCheck.fault) {
      this.transitionToFault(netlistCheck.fault);
      return false;
    }

    // 2. Instanciação do solver físico
    this.solver = new CircuitSolver(this.circuit);

    // 3. Resolução física inicial em T=0
    const initialStep = this.solver.step(0.0);
    this.applySolverStep(initialStep.componentStates, initialStep.hasFault, initialStep.fault);

    if (initialStep.hasFault && initialStep.fault) {
      return false;
    }

    // 4. Inicialização da CPU ATmega328P virtual
    this.avrBoard = new AVRBoard();
    this.avrBoard.onSerialOutput((text) => {
      this.notifySerial(text);
    });

    this.avrBoard.onPinChange((pinName, level) => {
      this.handlePinOutputChange('mcu_uno_01', pinName, level);
    });

    // 5. Transição de estado para MODO_SIMULACAO
    this.mode = 'MODO_SIMULACAO';
    this.fault = null;
    this.isRunning = true;
    this.notifyStateChange();

    // 6. Inicia o loop de ticks em lote desacoplado
    this.startBatchLoop();

    return true;
  }

  /**
   * Interrompe a simulação e desenergiza a bancada.
   */
  public stopSimulation(): void {
    this.stopBatchLoop();

    if (this.avrBoard) {
      this.avrBoard.stop();
      this.avrBoard = null;
    }

    this.solver = null;
    this.isRunning = false;
    this.mode = 'MODO_EDICAO';
    this.fault = null;

    // Limpa estados e notifica dirty nos que estavam ativos
    const previouslyActive = new Set(this.electricalStates.keys());
    this.electricalStates.clear();
    this.notifyDirty(previouslyActive);
    this.notifyStateChange();
  }

  /**
   * Avança um lote de simulação discreto (step batch) de forma determinística.
   * Executa as instruções da CPU para o intervalo e resolve a malha elétrica correspondente.
   */
  public stepBatch(deltaTimeMs: number = 10, instructionCount: number = 10000): void {
    if (!this.isRunning || this.mode !== 'MODO_SIMULACAO') return;

    // 1. Executa instruções de clock da CPU AVR8js
    if (this.avrBoard) {
      this.avrBoard.step(instructionCount);
    }

    // 2. Resolve a física no solver
    if (this.solver) {
      const stepResult = this.solver.step(deltaTimeMs / 1000);
      this.applySolverStep(stepResult.componentStates, stepResult.hasFault, stepResult.fault);
    }
  }

  /**
   * Notificado quando um pino do microcontrolador altera seu nível lógico (HIGH/LOW).
   */
  public handlePinOutputChange(componentId: string, pinName: string, level: 'HIGH' | 'LOW'): void {
    if (!this.solver || this.mode !== 'MODO_SIMULACAO') return;

    this.solver.setPinOutput(componentId, pinName, level);
    const stepResult = this.solver.step(0.001);
    this.applySolverStep(stepResult.componentStates, stepResult.hasFault, stepResult.fault);
  }

  /**
   * Aplica o resultado de um passo do solver elétrico, comparando estados e registrando Dirty Flags.
   */
  private applySolverStep(
    newStates: Map<string, ComponentElectricalState>,
    hasFault: boolean,
    faultPayload?: WorkbenchFaultPayload | null
  ): void {
    const dirty = new Set<string>();

    for (const [compId, newState] of newStates.entries()) {
      const oldState = this.electricalStates.get(compId);
      if (
        !oldState ||
        oldState.visualState !== newState.visualState ||
        oldState.isDestroyed !== newState.isDestroyed ||
        Math.abs(oldState.currentAmperes - newState.currentAmperes) > 0.001
      ) {
        dirty.add(compId);
      }
      this.electricalStates.set(compId, newState);
    }

    if (dirty.size > 0) {
      this.notifyDirty(dirty);
    }

    // Se houver falha crítica (curto-circuito ou sobrecorrente RN-BNC-05)
    if (hasFault && faultPayload) {
      this.transitionToFault(faultPayload);
    }
  }

  /**
   * Transita a bancada para ESTADO_FALHA_ENG, congelando a simulação e desativando a CPU.
   */
  private transitionToFault(faultPayload: WorkbenchFaultPayload): void {
    this.stopBatchLoop();
    if (this.avrBoard) {
      this.avrBoard.stop();
    }
    this.isRunning = false;
    this.mode = 'ESTADO_FALHA_ENG';
    this.fault = faultPayload;
    this.notifyStateChange();
  }

  private startBatchLoop(): void {
    this.stopBatchLoop();
    this.loopHandle = setInterval(() => {
      this.stepBatch(this.batchIntervalMs, this.instructionsPerBatch);
    }, this.batchIntervalMs);
  }

  private stopBatchLoop(): void {
    if (this.loopHandle) {
      clearInterval(this.loopHandle);
      this.loopHandle = null;
    }
  }

  public sendSerialInput(text: string): void {
    if (this.avrBoard) {
      this.avrBoard.sendSerialString(text.endsWith('\n') ? text : text + '\n');
    }
  }

  public getMode(): WorkbenchMode {
    return this.mode;
  }

  public getFault(): WorkbenchFaultPayload | null {
    return this.fault;
  }

  public isSimulating(): boolean {
    return this.mode === 'MODO_SIMULACAO';
  }

  public getElectricalState(componentId: string): ComponentElectricalState | undefined {
    return this.electricalStates.get(componentId);
  }

  public getAllElectricalStates(): Map<string, ComponentElectricalState> {
    return new Map(this.electricalStates);
  }

  // --- Sistema de Eventos Desacoplado ---

  public onStateChange(listener: EngineStateChangeCallback): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter((l) => l !== listener);
    };
  }

  public onDirty(listener: EngineDirtyCallback): () => void {
    this.dirtyListeners.push(listener);
    return () => {
      this.dirtyListeners = this.dirtyListeners.filter((l) => l !== listener);
    };
  }

  public onSerialOutput(listener: EngineSerialCallback): () => void {
    this.serialListeners.push(listener);
    return () => {
      this.serialListeners = this.serialListeners.filter((l) => l !== listener);
    };
  }

  private notifyStateChange(): void {
    for (const listener of this.stateChangeListeners) {
      listener(this.mode, this.fault);
    }
  }

  private notifyDirty(dirtyIds: Set<string>): void {
    for (const listener of this.dirtyListeners) {
      listener(dirtyIds);
    }
  }

  private notifySerial(text: string): void {
    for (const listener of this.serialListeners) {
      listener(text);
    }
  }

  public destroy(): void {
    this.stopSimulation();
    this.stateChangeListeners = [];
    this.dirtyListeners = [];
    this.serialListeners = [];
  }
}
