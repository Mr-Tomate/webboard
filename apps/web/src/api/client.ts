import type {
  CircuitDefinition,
  SubmissionSnapshot,
  EvaluationResult,
  EvaluationStatus
} from '@webboard/contracts';

export interface WorkspaceResponse {
  id: string;
  name: string;
  type: 'SOLO' | 'GROUP';
  classroomId?: string | null;
  language: 'CPP' | 'PYTHON';
  codeText: string;
  circuit: CircuitDefinition;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    isOwner: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionResponse {
  id: string;
  workspaceId: string;
  challengeId: string;
  versionNumber: number;
  status: EvaluationStatus;
  snapshot: SubmissionSnapshot;
  createdAt: string;
}

export class WebboardApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3333') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`);
    if (!res.ok) {
      throw new Error(`Erro ao buscar workspace: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async saveWorkspace(
    workspaceId: string,
    data: {
      circuit?: CircuitDefinition;
      codeText?: string;
      language?: 'CPP' | 'PYTHON';
      name?: string;
    }
  ): Promise<WorkspaceResponse> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      throw new Error(`Erro ao salvar workspace: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async submitChallenge(
    workspaceId: string,
    payload: {
      challengeId: string;
      userId: string;
      circuit: CircuitDefinition;
      codeText: string;
      language?: 'CPP' | 'PYTHON';
      status?: EvaluationStatus;
      evaluation?: EvaluationResult;
    }
  ): Promise<SubmissionResponse> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Erro ao enviar submissão: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getSubmissions(workspaceId: string): Promise<SubmissionResponse[]> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/submissions`);
    if (!res.ok) {
      throw new Error(`Erro ao listar submissões: HTTP ${res.status}`);
    }
    return res.json();
  }
}
