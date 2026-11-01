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

// -------------------------------------------------------------
// EIXO D: COLABORAÇÃO CONCORRENTE NO WORKSPACE DE GRUPO
// -------------------------------------------------------------
export const CIRCUIT_MUTATION_ACTIONS = [
  'ADD_COMPONENT',
  'UPDATE_COMPONENT',
  'REMOVE_COMPONENT',
  'ADD_WIRE',
  'REMOVE_WIRE',
] as const;

export type CircuitMutationAction = (typeof CIRCUIT_MUTATION_ACTIONS)[number];

export interface ComponentLock {
  workspaceId: string;
  componentId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

export interface RemoteCursor {
  workspaceId: string;
  userId: string;
  userName: string;
  position: { x: number; y: number };
}

export interface PresenceMember {
  userId: string;
  userName: string;
  /** Quantidade de conexões/abas abertas pelo mesmo usuário no workspace. */
  connections: number;
}

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
    }
  | {
      type: 'LOCK_COMPONENT';
      payload: {
        componentId: string;
        workspaceId?: string;
        userId?: string;
        userName?: string;
      };
    }
  | {
      type: 'UNLOCK_COMPONENT';
      payload: {
        componentId: string;
        workspaceId?: string;
        userId?: string;
      };
    }
  | {
      type: 'CURSOR_MOVE';
      payload: {
        position: { x: number; y: number };
        workspaceId?: string;
        userId?: string;
        userName?: string;
      };
    }
  | {
      type: 'CIRCUIT_MUTATION';
      payload: {
        action: CircuitMutationAction;
        data: unknown;
        workspaceId?: string;
        userId?: string;
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
      type: 'COMPONENT_LOCKED';
      payload: ComponentLock;
    }
  | {
      type: 'COMPONENT_UNLOCKED';
      payload: {
        workspaceId: string;
        componentId: string;
      };
    }
  | {
      type: 'LOCK_REJECTED';
      payload: {
        workspaceId: string;
        componentId: string;
        reason: string;
      };
    }
  | {
      type: 'CURSOR_MOVED';
      payload: RemoteCursor;
    }
  | {
      type: 'CIRCUIT_MUTATED';
      payload: {
        workspaceId: string;
        userId: string;
        userName: string;
        action: CircuitMutationAction;
        data: unknown;
      };
    }
  | {
      type: 'WORKSPACE_LOCKS_SNAPSHOT';
      payload: {
        workspaceId: string;
        locks: ComponentLock[];
      };
    }
  | {
      type: 'PRESENCE_SNAPSHOT';
      payload: {
        workspaceId: string;
        members: PresenceMember[];
      };
    }
  | {
      type: 'MEMBER_JOINED';
      payload: {
        workspaceId: string;
        member: PresenceMember;
      };
    }
  | {
      type: 'MEMBER_LEFT';
      payload: {
        workspaceId: string;
        userId: string;
      };
    }
  | {
      type: 'ERROR';
      message: string;
    };
