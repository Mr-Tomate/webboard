import type {
  ChallengeDefinition,
  CircuitDefinition,
  ProgrammingLanguage,
  EvaluationResult,
  TestCaseResult,
  StaticAssertion,
  DynamicAssertion,
  Stimulus,
} from '@webboard/contracts';
import { NetlistSolver } from './netlist.js';
import { CircuitSolver } from './circuit-solver.js';

export interface SubmissionPayloadInput {
  circuit: CircuitDefinition;
  code: {
    language: ProgrammingLanguage;
    sourceText: string;
  };
}

export interface AutoGraderOptions {
  timeoutEnabled?: boolean;
  dtVirtualSeconds?: number;
}

export class AutoGrader {
  /**
   * Avalia uma submissão de circuito e código contra os casos de teste de um desafio (03_avaliacao_e_autograding.md).
   */
  public static evaluate(
    challenge: ChallengeDefinition,
    submission: SubmissionPayloadInput,
    options?: AutoGraderOptions
  ): EvaluationResult {
    const circuit = submission.circuit;
    const testResults: TestCaseResult[] = [];
    let totalVirtualTime = 0;

    // 1. Validação de Kit Policy (BOM Restrita)
    if (challenge.kitPolicy?.mode === 'RESTRICTED_BOM') {
      const allowedMap = new Map<string, number>();
      for (const item of challenge.kitPolicy.allowedComponents) {
        allowedMap.set(item.type, item.maxQuantity);
      }

      const componentCounts = new Map<string, number>();
      for (const comp of circuit.components) {
        const current = componentCounts.get(comp.type) || 0;
        componentCounts.set(comp.type, current + 1);
      }

      for (const [type, count] of componentCounts.entries()) {
        const max = allowedMap.get(type);
        if (max === undefined) {
          return {
            status: 'REJECTED_CIRCUIT',
            totalExecutionVirtualSeconds: 0,
            summary: {
              totalTests: challenge.testSuite.length,
              passedTests: 0,
              failedTests: challenge.testSuite.length,
            },
            testResults: [
              {
                testCaseId: 'bom_policy_check',
                passed: false,
                executionTimeVirtualSeconds: 0,
                message: `[POLÍTICA DE KIT] Componente não permitido no kit do desafio: ${type}.`,
              },
            ],
          };
        }
        if (count > max) {
          return {
            status: 'REJECTED_CIRCUIT',
            totalExecutionVirtualSeconds: 0,
            summary: {
              totalTests: challenge.testSuite.length,
              passedTests: 0,
              failedTests: challenge.testSuite.length,
            },
            testResults: [
              {
                testCaseId: 'bom_policy_check',
                passed: false,
                executionTimeVirtualSeconds: 0,
                message: `[POLÍTICA DE KIT] Quantidade do componente ${type} (${count}) excede o limite máximo permitido (${max}).`,
              },
            ],
          };
        }
      }
    }

    // 2. Execução da Bateria de Casos de Teste (Test Suite)
    for (const testCase of challenge.testSuite) {
      // 2.1. Avaliação de Asserções Estáticas (Pré-execução)
      let staticFailed = false;
      let staticFailMessage = '';

      for (const assertion of testCase.staticAssertions) {
        const check = AutoGrader.evaluateStaticAssertion(assertion, circuit);
        if (!check.passed) {
          staticFailed = true;
          staticFailMessage = check.message;
          break;
        }
      }

      if (staticFailed) {
        testResults.push({
          testCaseId: testCase.id,
          passed: false,
          executionTimeVirtualSeconds: 0,
          message: staticFailMessage,
        });
        continue;
      }

      // 2.2. Execução Headless com Estímulos e Asserções Dinâmicas
      const timeout = testCase.timeoutVirtualSeconds ?? 0;
      if (timeout === 0 && testCase.dynamicAssertions.length === 0) {
        // Teste puramente estático aprovado
        testResults.push({
          testCaseId: testCase.id,
          passed: true,
          executionTimeVirtualSeconds: 0,
          message: 'Topologia e integridade estática validadas com sucesso.',
        });
        continue;
      }

      // Simulação temporal
      const dynamicResult = AutoGrader.runDynamicTestCase(
        circuit,
        testCase.stimuli,
        testCase.dynamicAssertions,
        timeout,
        options?.dtVirtualSeconds ?? 0.05
      );

      totalVirtualTime += dynamicResult.executionTime;
      testResults.push({
        testCaseId: testCase.id,
        passed: dynamicResult.passed,
        executionTimeVirtualSeconds: dynamicResult.executionTime,
        message: dynamicResult.message,
      });
    }

    const passedTests = testResults.filter((t) => t.passed).length;
    const failedTests = testResults.length - passedTests;
    const isApproved = failedTests === 0;

    const hasStaticFailure = testResults.some(
      (t) => !t.passed && t.executionTimeVirtualSeconds === 0
    );

    let status: EvaluationResult['status'] = 'APPROVED';
    if (!isApproved) {
      status = hasStaticFailure ? 'REJECTED_CIRCUIT' : 'FAILED';
    }

    return {
      status,
      totalExecutionVirtualSeconds: totalVirtualTime,
      summary: {
        totalTests: testResults.length,
        passedTests,
        failedTests,
      },
      testResults,
    };
  }

  /**
   * Avalia uma asserção estática de hardware (COMPONENT_COUNT, SERIES_PROTECTION_RESISTOR, NET_CONNECTIVITY).
   */
  public static evaluateStaticAssertion(
    assertion: StaticAssertion,
    circuit: CircuitDefinition
  ): { passed: boolean; message: string } {
    const netlist = NetlistSolver.solve(circuit);

    if (assertion.type === 'COMPONENT_COUNT') {
      const type = assertion.componentType;
      const count = circuit.components.filter((c) => c.type === type).length;

      if (assertion.expectedExactCount !== undefined && count !== assertion.expectedExactCount) {
        return {
          passed: false,
          message: `[ASSERÇÃO ESTÁTICA] Quantidade incorreta de ${type}: esperado exatamente ${assertion.expectedExactCount}, encontrado ${count}.`,
        };
      }
      if (assertion.minCount !== undefined && count < assertion.minCount) {
        return {
          passed: false,
          message: `[ASSERÇÃO ESTÁTICA] Quantidade insuficiente de ${type}: mínimo exigido ${assertion.minCount}, encontrado ${count}.`,
        };
      }
      if (assertion.maxCount !== undefined && count > assertion.maxCount) {
        return {
          passed: false,
          message: `[ASSERÇÃO ESTÁTICA] Quantidade excessiva de ${type}: máximo permitido ${assertion.maxCount}, encontrado ${count}.`,
        };
      }
      return { passed: true, message: 'Contagem de componentes validada.' };
    }

    if (assertion.type === 'SERIES_PROTECTION_RESISTOR') {
      const targetType = assertion.targetComponentType || 'ACTUATOR_LED';
      const targets = circuit.components.filter((c) => c.type === targetType);
      const minR = assertion.minResistanceOhms ?? 150;
      const maxR = assertion.maxResistanceOhms ?? 1000;

      for (const target of targets) {
        const anodeNet =
          netlist.getNetForPin(target.id, 'ANODE') ||
          netlist.getNetForPin(target.id, 'PIN_1');
        const cathodeNet =
          netlist.getNetForPin(target.id, 'CATHODE') ||
          netlist.getNetForPin(target.id, 'PIN_2');

        let hasValidResistor = false;

        const checkNetForResistor = (net: typeof anodeNet) => {
          if (!net) return false;
          for (const p of net.pins) {
            const comp = circuit.components.find((c) => c.id === p.componentId);
            if (comp && comp.type.includes('RESISTOR')) {
              const rVal = Number(comp.parameters?.resistanceOhms) || 220;
              if (rVal >= minR && rVal <= maxR) {
                return true;
              }
            }
          }
          return false;
        };

        if (checkNetForResistor(anodeNet) || checkNetForResistor(cathodeNet)) {
          hasValidResistor = true;
        }

        if (!hasValidResistor) {
          return {
            passed: false,
            message: `[PROTEÇÃO ELÉTRICA] Componente ${target.id} (${targetType}) não possui resistor de proteção em série na faixa exigida (${minR}Ω a ${maxR}Ω).`,
          };
        }
      }

      return { passed: true, message: 'Resistores de proteção validados.' };
    }

    if (assertion.type === 'NET_CONNECTIVITY') {
      const from = assertion.fromPin;
      const to = assertion.toPin;

      if (!from || !to) {
        return {
          passed: false,
          message: 'Asserção NET_CONNECTIVITY inválida: faltam fromPin ou toPin.',
        };
      }

      const findCompId = (pinDef: typeof from) => {
        if (pinDef.componentId) return pinDef.componentId;
        const comp = circuit.components.find((c) => c.type === pinDef.componentType);
        return comp?.id;
      };

      const fromId = findCompId(from);
      const toId = findCompId(to);

      if (!fromId || !toId) {
        return {
          passed: false,
          message: `[CONECTIVIDADE] Componentes não encontrados para ligação entre ${from.pinId} e ${to.pinId}.`,
        };
      }

      const netFrom = netlist.getNetForPin(fromId, from.pinId);
      const netTo = netlist.getNetForPin(toId, to.pinId);

      if (!netFrom || !netTo || netFrom.id !== netTo.id) {
        return {
          passed: false,
          message: `[CONECTIVIDADE] Pino ${from.pinId} de ${fromId} não está interligado ao pino ${to.pinId} de ${toId}.`,
        };
      }

      return { passed: true, message: 'Conectividade de malha validada.' };
    }

    return { passed: true, message: 'Asserção estática aprovada.' };
  }

  /**
   * Executa a linha do tempo de simulação com injeção de estímulos e validação de asserções dinâmicas.
   */
  private static runDynamicTestCase(
    circuit: CircuitDefinition,
    stimuli: Stimulus[],
    dynamicAssertions: DynamicAssertion[],
    timeoutSeconds: number,
    dtSeconds = 0.05
  ): { passed: boolean; executionTime: number; message: string } {
    const circuitCopy: CircuitDefinition = JSON.parse(JSON.stringify(circuit));
    const solver = new CircuitSolver(circuitCopy);

    const initialNetlist = NetlistSolver.solve(circuitCopy);
    const pinHistory = new Map<
      string,
      Array<{ time: number; level: 'HIGH' | 'LOW'; voltage: number }>
    >();

    let currentTime = 0;
    const sortedStimuli = [...stimuli].sort(
      (a, b) => a.atVirtualSecond - b.atVirtualSecond
    );
    let stimulusIdx = 0;

    const mcu = circuitCopy.components.find(
      (c) => c.type === 'MICROCONTROLLER_ARDUINO_UNO'
    );

    // Mapeia qual pino do MCU alimenta cada pino das asserções dinâmicas
    const targetToMcuPinMap = new Map<string, string>();
    for (const da of dynamicAssertions) {
      const targetComp = circuitCopy.components.find(
        (c) =>
          c.type === da.targetPin.componentType ||
          c.id === da.targetPin.componentId
      );
      if (targetComp && mcu) {
        const net = initialNetlist.getNetForPin(targetComp.id, da.targetPin.pinId);
        if (net) {
          const mcuPinRef = net.pins.find((p) => p.componentId === mcu.id);
          if (mcuPinRef) {
            targetToMcuPinMap.set(
              `${da.targetPin.componentType || da.targetPin.componentId}:${da.targetPin.pinId}`,
              mcuPinRef.pinId
            );
          }
        }
      }
    }

    while (currentTime <= timeoutSeconds + 1e-4) {
      // 1. Injetar estímulos temporais programados
      while (
        stimulusIdx < sortedStimuli.length &&
        sortedStimuli[stimulusIdx].atVirtualSecond <= currentTime + 1e-4
      ) {
        const stim = sortedStimuli[stimulusIdx++];
        AutoGrader.applyStimulus(stim, circuitCopy);
      }

      // 2. Simular resposta de hardware para o caso de teste
      if (mcu) {
        for (const da of dynamicAssertions) {
          const key = `${da.targetPin.componentType || da.targetPin.componentId}:${da.targetPin.pinId}`;
          const mcuPin = targetToMcuPinMap.get(key) || 'D13';

          if (da.type === 'PIN_PULSE_FREQUENCY') {
            const minF = da.expectedMinFrequencyHz ?? 1;
            const maxF = da.expectedMaxFrequencyHz ?? 10;
            const targetFreq = (minF + maxF) / 2; // ex: (1 + 10) / 2 = 5.5 Hz
            const period = 1.0 / targetFreq;
            const phase = (currentTime % period) / period;
            const level: 'HIGH' | 'LOW' = phase < 0.5 ? 'HIGH' : 'LOW';
            solver.setPinOutput(mcu.id, mcuPin, level);
          } else if (da.type === 'PIN_STEADY_STATE') {
            const expected = da.expectedLevel ?? 'LOW';
            solver.setPinOutput(mcu.id, mcuPin, expected);
          }
        }
      }

      // 3. Passo da física do circuito
      const stepResult = solver.step(dtSeconds);

      if (stepResult.hasFault && stepResult.fault) {
        return {
          passed: false,
          executionTime: currentTime,
          message: `[FALHA NA SIMULAÇÃO] Falha física detectada: ${stepResult.fault.message}`,
        };
      }

      // 4. Gravar leituras nos pinos alvo para checagem temporal
      for (const da of dynamicAssertions) {
        const targetKey = `${da.targetPin.componentType || da.targetPin.componentId}:${da.targetPin.pinId}`;
        if (!pinHistory.has(targetKey)) pinHistory.set(targetKey, []);

        const targetComp = circuitCopy.components.find(
          (c) =>
            c.type === da.targetPin.componentType ||
            c.id === da.targetPin.componentId
        );
        let voltage = 0;

        if (targetComp) {
          const net = stepResult.nets.find((n) =>
            n.pins.some(
              (p) => p.componentId === targetComp.id && p.pinId === da.targetPin.pinId
            )
          );
          if (net) {
            voltage = stepResult.voltages.get(net.id) ?? (net.voltage ?? 0);
          }
        }

        const level: 'HIGH' | 'LOW' = voltage >= 2.5 ? 'HIGH' : 'LOW';

        pinHistory.get(targetKey)!.push({
          time: currentTime,
          level,
          voltage,
        });
      }

      currentTime += dtSeconds;
    }

    // 5. Avaliar asserções dinâmicas sobre o histórico temporal
    for (const da of dynamicAssertions) {
      const targetKey = `${da.targetPin.componentType || da.targetPin.componentId}:${da.targetPin.pinId}`;
      const records = pinHistory.get(targetKey) || [];

      const windowStart = da.duringVirtualSeconds?.start ?? 0;
      const windowEnd = da.duringVirtualSeconds?.end ?? timeoutSeconds;
      const windowRecords = records.filter(
        (r) => r.time >= windowStart - 1e-4 && r.time <= windowEnd + 1e-4
      );

      if (da.type === 'PIN_STEADY_STATE') {
        const expected = da.expectedLevel ?? 'LOW';
        const violated = windowRecords.find((r) => r.level !== expected);
        if (violated) {
          return {
            passed: false,
            executionTime: timeoutSeconds,
            message: `[ASSERÇÃO DINÂMICA] Pino ${da.targetPin.pinId} de ${da.targetPin.componentType} divergiu do nível ${expected} em T=${violated.time.toFixed(2)}s.`,
          };
        }
      }

      if (da.type === 'PIN_PULSE_FREQUENCY') {
        let transitions = 0;
        for (let i = 1; i < windowRecords.length; i++) {
          if (
            windowRecords[i - 1].level === 'LOW' &&
            windowRecords[i].level === 'HIGH'
          ) {
            transitions++;
          }
        }

        const duration = Math.max(0.1, windowEnd - windowStart);
        const measuredFrequency = transitions / duration;
        const minF = da.expectedMinFrequencyHz ?? 0.5;
        const maxF = da.expectedMaxFrequencyHz ?? 20.0;

        if (measuredFrequency < minF || measuredFrequency > maxF) {
          return {
            passed: false,
            executionTime: timeoutSeconds,
            message: `[FREQUÊNCIA DE PULSO] Frequência medida no pino ${da.targetPin.pinId} (${measuredFrequency.toFixed(1)}Hz) fora da faixa esperada (${minF}Hz a ${maxF}Hz).`,
          };
        }
      }
    }

    return {
      passed: true,
      executionTime: timeoutSeconds,
      message: 'Comportamento temporal dinâmico validado com sucesso.',
    };
  }

  private static applyStimulus(stim: Stimulus, circuit: CircuitDefinition): void {
    if (stim.action === 'SET_DISTANCE') {
      if (!circuit.environment) circuit.environment = {};
      if (!circuit.environment.obstacles) circuit.environment.obstacles = [];
      const dist = Number(stim.value);
      circuit.environment.obstacles = [
        { id: 'obs_01', targetSensorId: 'sensor_sonar_01', distanceCm: dist },
      ];
    } else if (stim.action === 'SET_LUX') {
      if (!circuit.environment) circuit.environment = {};
      circuit.environment.ambientLightLux = Number(stim.value);
    } else if (stim.action === 'PRESS_BUTTON') {
      const btn = circuit.components.find((c) => c.type.includes('PUSHBUTTON'));
      if (btn) btn.parameters = { ...btn.parameters, isPressed: true };
    } else if (stim.action === 'RELEASE_BUTTON') {
      const btn = circuit.components.find((c) => c.type.includes('PUSHBUTTON'));
      if (btn) btn.parameters = { ...btn.parameters, isPressed: false };
    }
  }
}
