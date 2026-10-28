export type StudentWorkspaceStatus =
  | 'NORMAL'
  | 'DIFICULDADE'
  | 'FALHA_CRÍTICA'
  | 'INATIVO';

export interface PedagogicalNote {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  targetComponentId?: string;
}

export interface StudentWorkspacePulse {
  workspaceId: string;
  teamName: string;
  students: string[];
  status: StudentWorkspaceStatus;
  lastActivitySecondsAgo: number;
  currentChallengeTitle: string;
  circuitMetrics: {
    componentCount: number;
    wireCount: number;
    hasShortCircuit: boolean;
    hasThermalDestruction: boolean;
  };
  codeLanguage: 'CPP' | 'PYTHON';
  compilationAttempts: number;
  testSummary: {
    passed: number;
    total: number;
  };
  pedagogicalNotes: PedagogicalNote[];
}

export interface ClassroomTelemetrySummary {
  totalWorkspaces: number;
  activeWorkspaces: number;
  statusCounts: {
    normal: number;
    difficulty: number;
    critical: number;
    inactive: number;
  };
  averageProgressPercent: number;
}
