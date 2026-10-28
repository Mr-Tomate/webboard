import type {
  StudentWorkspacePulse,
  StudentWorkspaceStatus,
  ClassroomTelemetrySummary,
  PedagogicalNote
} from '../types/telemetry.js';

/**
 * Calcula o status semafórico do workspace de acordo com a spec 04:
 * - VERMELHO (FALHA_CRÍTICA): Curto-circuito ou componente destruído.
 * - CINZA (INATIVO): Sem interação há mais de 300 segundos (5 minutos).
 * - AMARELO (DIFICULDADE): Mais de 3 erros de compilação ou testes falhando continuamente.
 * - VERDE (NORMAL): Circuito íntegro e em progresso normal.
 */
export function determineWorkspaceStatus(params: {
  hasShortCircuit: boolean;
  hasThermalDestruction: boolean;
  lastActivitySecondsAgo: number;
  compilationAttempts: number;
  testsPassed: number;
  testsTotal: number;
}): StudentWorkspaceStatus {
  if (params.hasShortCircuit || params.hasThermalDestruction) {
    return 'FALHA_CRÍTICA';
  }
  if (params.lastActivitySecondsAgo >= 300) {
    return 'INATIVO';
  }
  if (
    params.compilationAttempts >= 3 ||
    (params.testsTotal > 0 && params.testsPassed < params.testsTotal && params.compilationAttempts >= 2)
  ) {
    return 'DIFICULDADE';
  }
  return 'NORMAL';
}

/**
 * Agrega a telemetria da sala para a visão macro do docente.
 */
export function computeClassroomSummary(
  workspaces: StudentWorkspacePulse[]
): ClassroomTelemetrySummary {
  const summary: ClassroomTelemetrySummary = {
    totalWorkspaces: workspaces.length,
    activeWorkspaces: 0,
    statusCounts: {
      normal: 0,
      difficulty: 0,
      critical: 0,
      inactive: 0
    },
    averageProgressPercent: 0
  };

  if (workspaces.length === 0) return summary;

  let totalProgress = 0;

  for (const ws of workspaces) {
    switch (ws.status) {
      case 'NORMAL':
        summary.statusCounts.normal++;
        summary.activeWorkspaces++;
        break;
      case 'DIFICULDADE':
        summary.statusCounts.difficulty++;
        summary.activeWorkspaces++;
        break;
      case 'FALHA_CRÍTICA':
        summary.statusCounts.critical++;
        summary.activeWorkspaces++;
        break;
      case 'INATIVO':
        summary.statusCounts.inactive++;
        break;
    }

    const wsProgress =
      ws.testSummary.total > 0
        ? (ws.testSummary.passed / ws.testSummary.total) * 100
        : 0;
    totalProgress += wsProgress;
  }

  summary.averageProgressPercent = Math.round(totalProgress / workspaces.length);
  return summary;
}

/**
 * Adiciona uma nota pedagógica (RN-PED-02) sem modificar os condutores nem o código do aluno (RN-PED-01).
 */
export function addPedagogicalNote(
  workspace: StudentWorkspacePulse,
  author: string,
  text: string,
  targetComponentId?: string
): StudentWorkspacePulse {
  const note: PedagogicalNote = {
    id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    author,
    text: text.trim(),
    createdAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    targetComponentId
  };

  return {
    ...workspace,
    pedagogicalNotes: [...workspace.pedagogicalNotes, note]
  };
}

export const SAMPLE_CLASSROOM_WORKSPACES: StudentWorkspacePulse[] = [
  {
    workspaceId: 'ws_team_01',
    teamName: 'Equipe Alpha (Bancada 01)',
    students: ['Lucas Silva', 'Gabriel Santos'],
    status: 'NORMAL',
    lastActivitySecondsAgo: 12,
    currentChallengeTitle: 'Alarme de Proximidade Ultrassônico',
    circuitMetrics: {
      componentCount: 5,
      wireCount: 6,
      hasShortCircuit: false,
      hasThermalDestruction: false
    },
    codeLanguage: 'CPP',
    compilationAttempts: 1,
    testSummary: { passed: 3, total: 3 },
    pedagogicalNotes: []
  },
  {
    workspaceId: 'ws_team_02',
    teamName: 'Equipe Beta (Bancada 02)',
    students: ['Mariana Costa', 'Beatriz Lima'],
    status: 'DIFICULDADE',
    lastActivitySecondsAgo: 35,
    currentChallengeTitle: 'Alarme de Proximidade Ultrassônico',
    circuitMetrics: {
      componentCount: 4,
      wireCount: 5,
      hasShortCircuit: false,
      hasThermalDestruction: false
    },
    codeLanguage: 'CPP',
    compilationAttempts: 4,
    testSummary: { passed: 1, total: 3 },
    pedagogicalNotes: [
      {
        id: 'note_01',
        author: 'Prof. Renato',
        text: 'Atenção aos pinos TRIG e ECHO no HC-SR04; confira se estão mapeados em D11 e D12 no sketch.',
        createdAt: '10:15'
      }
    ]
  },
  {
    workspaceId: 'ws_team_03',
    teamName: 'Equipe Gamma (Bancada 03)',
    students: ['Rafael Oliveira', 'Tiago Mendes'],
    status: 'FALHA_CRÍTICA',
    lastActivitySecondsAgo: 5,
    currentChallengeTitle: 'Pisca LED com Resistor de Proteção',
    circuitMetrics: {
      componentCount: 3,
      wireCount: 3,
      hasShortCircuit: false,
      hasThermalDestruction: true
    },
    codeLanguage: 'PYTHON',
    compilationAttempts: 2,
    testSummary: { passed: 0, total: 2 },
    pedagogicalNotes: [
      {
        id: 'note_02',
        author: 'Prof. Renato',
        text: 'O LED queimou por sobrecorrente! Você esqueceu de colocar o resistor de 220Ω em série.',
        createdAt: '10:22',
        targetComponentId: 'led_01'
      }
    ]
  },
  {
    workspaceId: 'ws_team_04',
    teamName: 'Equipe Delta (Bancada 04)',
    students: ['Carla Souza'],
    status: 'INATIVO',
    lastActivitySecondsAgo: 420,
    currentChallengeTitle: 'Leitura Analógica de Potenciômetro',
    circuitMetrics: {
      componentCount: 2,
      wireCount: 2,
      hasShortCircuit: false,
      hasThermalDestruction: false
    },
    codeLanguage: 'CPP',
    compilationAttempts: 0,
    testSummary: { passed: 0, total: 2 },
    pedagogicalNotes: []
  },
  {
    workspaceId: 'ws_team_05',
    teamName: 'Equipe Épsilon (Bancada 05)',
    students: ['Felipe Rocha', 'Pedro Albuquerque'],
    status: 'NORMAL',
    lastActivitySecondsAgo: 18,
    currentChallengeTitle: 'Sinalizador com Buzzer e LED',
    circuitMetrics: {
      componentCount: 4,
      wireCount: 5,
      hasShortCircuit: false,
      hasThermalDestruction: false
    },
    codeLanguage: 'CPP',
    compilationAttempts: 1,
    testSummary: { passed: 2, total: 2 },
    pedagogicalNotes: []
  }
];
