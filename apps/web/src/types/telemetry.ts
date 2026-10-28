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
  classroomId?: string;
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

export type WebSocketRole = 'student' | 'teacher';

export type ClientToServerMessage =
  | { type: 'PULSE'; payload: StudentWorkspacePulse }
  | {
      type: 'FAULT_ALERT';
      payload: {
        workspaceId: string;
        faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
        message: string;
        failedWireId?: string;
        failedComponentId?: string;
      };
    }
  | {
      type: 'SEND_NOTE';
      payload: {
        workspaceId: string;
        author: string;
        text: string;
        targetComponentId?: string;
      };
    };

export type ServerToClientMessage =
  | {
      type: 'CLASSROOM_SNAPSHOT';
      payload: {
        classroomId: string;
        workspaces: StudentWorkspacePulse[];
        summary: ClassroomTelemetrySummary;
      };
    }
  | {
      type: 'WORKSPACE_PULSE_UPDATED';
      payload: {
        classroomId: string;
        pulse: StudentWorkspacePulse;
        summary: ClassroomTelemetrySummary;
      };
    }
  | {
      type: 'WORKSPACE_FAULT_ALERT';
      payload: {
        classroomId: string;
        workspaceId: string;
        teamName: string;
        faultType: 'SHORT_CIRCUIT' | 'OVERCURRENT';
        message: string;
        timestamp: string;
      };
    }
  | {
      type: 'PEDAGOGICAL_NOTE_RECEIVED';
      payload: {
        workspaceId: string;
        note: PedagogicalNote;
      };
    }
  | {
      type: 'ERROR';
      message: string;
    };
