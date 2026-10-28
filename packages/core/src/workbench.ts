import type {
  CircuitDefinition,
  ComponentDefinition,
  WireDefinition,
  Position2D,
  WorkbenchMode,
  WorkbenchFaultPayload,
  PinDigitalLevel,
} from '@webboard/contracts';
import { CircuitSolver, type CircuitSolverResult, type CircuitSolverOptions } from './circuit-solver.js';

export class TopologyLockedError extends Error {
  public readonly rule: 'RN-BNC-01' | 'RN-BNC-02';

  constructor(message: string, rule: 'RN-BNC-01' | 'RN-BNC-02' = 'RN-BNC-01') {
    super(message);
    this.name = 'TopologyLockedError';
    this.rule = rule;
  }
}

export type ModeChangeCallback = (
  newMode: WorkbenchMode,
  previousMode: WorkbenchMode
) => void;

export type FaultCallback = (fault: WorkbenchFaultPayload) => void;

export class WorkbenchStateMachine {
  private circuit: CircuitDefinition;
  private mode: WorkbenchMode = 'MODO_EDICAO';
  private fault?: WorkbenchFaultPayload;
  private solver?: CircuitSolver;
  private solverOptions?: CircuitSolverOptions;
  private modeListeners: Set<ModeChangeCallback> = new Set();
  private faultListeners: Set<FaultCallback> = new Set();

  constructor(
    initialCircuit: CircuitDefinition,
    solverOptions?: CircuitSolverOptions
  ) {
    // Clonar profundamente o circuito para isolar mutações
    this.circuit = JSON.parse(JSON.stringify(initialCircuit));
    this.solverOptions = solverOptions;
  }

  public getMode(): WorkbenchMode {
    return this.mode;
  }

  public getCircuit(): CircuitDefinition {
    return JSON.parse(JSON.stringify(this.circuit));
  }

  public getFault(): WorkbenchFaultPayload | undefined {
    return this.fault;
  }

  public getSolver(): CircuitSolver | undefined {
    return this.solver;
  }

  public onModeChange(cb: ModeChangeCallback): () => void {
    this.modeListeners.add(cb);
    return () => this.modeListeners.delete(cb);
  }

  public onFault(cb: FaultCallback): () => void {
    this.faultListeners.add(cb);
    return () => this.faultListeners.delete(cb);
  }

  private setMode(newMode: WorkbenchMode): void {
    if (this.mode === newMode) return;
    const prev = this.mode;
    this.mode = newMode;
    for (const listener of this.modeListeners) {
      listener(newMode, prev);
    }
  }

  private emitFault(fault: WorkbenchFaultPayload): void {
    this.fault = fault;
    this.setMode('ESTADO_FALHA_ENG');
    for (const listener of this.faultListeners) {
      listener(fault);
    }
  }

  /**
   * Inicia a simulação da bancada (Energização).
   * Valida a integridade topológica inicial em T=0.
   */
  public startSimulation(): {
    success: boolean;
    mode: WorkbenchMode;
    fault?: WorkbenchFaultPayload;
  } {
    if (this.mode === 'MODO_SIMULACAO') {
      return { success: true, mode: this.mode };
    }

    // Instanciar um novo CircuitSolver para a sessão de simulação
    this.fault = undefined;
    this.solver = new CircuitSolver(this.circuit, this.solverOptions);

    // Passo T=0 para detecção de curto inicial (TC-CORE-03)
    const initialResult = this.solver.step(0.0);

    if (initialResult.hasFault && initialResult.fault) {
      this.emitFault(initialResult.fault);
      return {
        success: false,
        mode: this.mode,
        fault: initialResult.fault,
      };
    }

    this.setMode('MODO_SIMULACAO');
    return {
      success: true,
      mode: this.mode,
    };
  }

  /**
   * Interrompe a simulação (Desenergização), retornando para MODO_EDICAO.
   */
  public stopSimulation(): void {
    this.solver = undefined;
    this.fault = undefined;
    this.setMode('MODO_EDICAO');
  }

  /**
   * Executa um passo da simulação avançando o tempo virtual em dtSeconds.
   */
  public step(dtSeconds: number): CircuitSolverResult {
    if (this.mode === 'ESTADO_FALHA_ENG') {
      throw new Error(
        `[FALHA DE ENGENHARIA] Não é possível avançar a simulação enquanto a bancada estiver congelada por falha: ${this.fault?.message}`
      );
    }

    if (this.mode !== 'MODO_SIMULACAO' || !this.solver) {
      throw new Error(
        'A bancada deve estar em MODO_SIMULACAO para avançar o tempo virtual.'
      );
    }

    const result = this.solver.step(dtSeconds);

    if (result.hasFault && result.fault) {
      this.emitFault(result.fault);
    }

    return result;
  }

  // --- REGRAS DE TRAVA FÍSICA E HOT-PLUGGING (RN-BNC-01 e RN-BNC-02) ---

  private assertCanModifyTopology(): void {
    if (this.mode === 'MODO_SIMULACAO') {
      throw new TopologyLockedError(
        '[RN-BNC-01] Modificação estrutural rejeitada: A topologia está travada durante a simulação (proibido hot-plugging).',
        'RN-BNC-01'
      );
    }
    if (this.mode === 'ESTADO_FALHA_ENG') {
      throw new TopologyLockedError(
        '[RN-BNC-02] Modificação estrutural rejeitada: A bancada está em estado de falha. Desligue a simulação para editar.',
        'RN-BNC-02'
      );
    }
  }

  public addComponent(component: ComponentDefinition): void {
    this.assertCanModifyTopology();
    if (this.circuit.components.some((c) => c.id === component.id)) {
      throw new Error(`Componente com id "${component.id}" já existe.`);
    }
    this.circuit.components.push(JSON.parse(JSON.stringify(component)));
  }

  public removeComponent(componentId: string): void {
    this.assertCanModifyTopology();
    this.circuit.components = this.circuit.components.filter(
      (c) => c.id !== componentId
    );
    // Remove fios conectados ao componente removido
    this.circuit.wires = this.circuit.wires.filter(
      (w) =>
        w.from.componentId !== componentId && w.to.componentId !== componentId
    );
  }

  public addWire(wire: WireDefinition): void {
    this.assertCanModifyTopology();
    if (this.circuit.wires.some((w) => w.id === wire.id)) {
      throw new Error(`Fio com id "${wire.id}" já existe.`);
    }
    this.circuit.wires.push(JSON.parse(JSON.stringify(wire)));
  }

  public removeWire(wireId: string): void {
    this.assertCanModifyTopology();
    this.circuit.wires = this.circuit.wires.filter((w) => w.id !== wireId);
  }

  public updateComponentPosition(
    componentId: string,
    position: Position2D
  ): void {
    this.assertCanModifyTopology();
    const comp = this.circuit.components.find((c) => c.id === componentId);
    if (!comp) throw new Error(`Componente "${componentId}" não encontrado.`);
    comp.position = { ...position };
  }

  public updateComponentParameters(
    componentId: string,
    parameters: Record<string, any>
  ): void {
    this.assertCanModifyTopology();
    const comp = this.circuit.components.find((c) => c.id === componentId);
    if (!comp) throw new Error(`Componente "${componentId}" não encontrado.`);
    comp.parameters = { ...comp.parameters, ...parameters };
  }

  // --- INTERATIVIDADE PERMITIDA EM SIMULAÇÃO (RN-BNC-03) ---

  public setPinOutput(
    componentId: string,
    pinId: string,
    level: PinDigitalLevel,
    voltage?: number
  ): void {
    if (this.solver) {
      this.solver.setPinOutput(componentId, pinId, level, voltage);
    }
  }

  public setEnvironmentObstacleDistance(
    obstacleId: string,
    distanceCm: number
  ): void {
    if (!this.circuit.environment) {
      this.circuit.environment = {};
    }
    if (!this.circuit.environment.obstacles) {
      this.circuit.environment.obstacles = [];
    }
    const obs = this.circuit.environment.obstacles.find(
      (o) => o.id === obstacleId
    );
    if (obs) {
      obs.distanceCm = distanceCm;
    } else {
      this.circuit.environment.obstacles.push({
        id: obstacleId,
        targetSensorId: 'sensor_sonar_01',
        distanceCm,
      });
    }
  }

  public setEnvironmentAmbientLightLux(lux: number): void {
    if (!this.circuit.environment) {
      this.circuit.environment = {};
    }
    this.circuit.environment.ambientLightLux = lux;
  }
}
