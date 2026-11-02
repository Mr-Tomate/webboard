import type {
  CircuitDefinition,
  SubmissionSnapshot,
  EvaluationResult,
  EvaluationStatus,
  ChallengeDefinition,
  LoginPayload,
  RegisterPayload,
  JoinClassroomPayload,
  CreateClassroomPayload,
  AuthResponse,
  UserProfile,
  ClassroomSummary,
} from '@webboard/contracts';

export interface WorkspaceResponse {
  id: string;
  name: string;
  type: 'SOLO' | 'GROUP';
  classroomId?: string | null;
  classroomName?: string;
  language: 'CPP' | 'PYTHON';
  codeText: string;
  circuit: CircuitDefinition;
  members: Array<{
    userId: string;
    name: string;
    email?: string;
    isOwner: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface UserWorkspaceSummary {
  id: string;
  name: string;
  type: 'SOLO' | 'GROUP';
  language: string;
  classroomId?: string | null;
  classroomName?: string;
  updatedAt: string;
  memberCount: number;
}

export interface SubmissionHistoryItem {
  submissionId: string;
  workspaceId: string;
  challengeId: string;
  versionNumber: number;
  status: EvaluationStatus;
  submittedBy: {
    userId: string;
    name: string;
  };
  submittedAt: string;
  evaluation: EvaluationResult;
}

export interface ChallengeListItem {
  id: string;
  title: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  createdAt: string;
}

export class WebboardApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '');
    } else if (typeof window !== 'undefined') {
      this.baseUrl = window.location.origin;
    } else {
      this.baseUrl = 'http://localhost:3333';
    }
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // --- AUTENTICAÇÃO E TURMAS ---

  public async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro no login: HTTP ${res.status}`);
    }
    const data: AuthResponse = await res.json();
    this.setToken(data.token);
    return data;
  }

  public async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro no cadastro: HTTP ${res.status}`);
    }
    const data: AuthResponse = await res.json();
    this.setToken(data.token);
    return data;
  }

  public async getMe(): Promise<{
    user: UserProfile;
    classrooms: ClassroomSummary[];
    activeClassroom: ClassroomSummary | null;
  }> {
    const res = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Sessão inválida: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async joinClassroom(
    payload: JoinClassroomPayload
  ): Promise<{ success: boolean; classroom: ClassroomSummary }> {
    const res = await fetch(`${this.baseUrl}/api/auth/join-classroom`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro ao entrar na turma: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async createClassroom(
    payload: CreateClassroomPayload
  ): Promise<{ classroom: ClassroomSummary }> {
    const res = await fetch(`${this.baseUrl}/api/classrooms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Erro ao criar turma: HTTP ${res.status}`);
    }
    return res.json();
  }

  // --- WORKSPACES E BANCADAS ---

  public async createWorkspace(data: {
    name: string;
    type: 'SOLO' | 'GROUP';
    ownerId: string;
    classroomId?: string;
    circuit?: CircuitDefinition;
    codeText?: string;
    language?: 'CPP' | 'PYTHON';
  }): Promise<WorkspaceResponse> {
    const res = await fetch(`${this.baseUrl}/api/workspaces`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Erro ao criar workspace: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Erro ao buscar workspace: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getMyWorkspaces(): Promise<UserWorkspaceSummary[]> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/my`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Erro ao listar bancadas: HTTP ${res.status}`);
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
      headers: this.getHeaders(),
      body: JSON.stringify(data),
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
  ): Promise<SubmissionSnapshot> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/submissions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Erro ao enviar submissão: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getSubmissions(workspaceId: string): Promise<SubmissionHistoryItem[]> {
    const res = await fetch(`${this.baseUrl}/api/workspaces/${workspaceId}/submissions`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Erro ao listar submissões: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getChallenges(): Promise<ChallengeListItem[]> {
    const res = await fetch(`${this.baseUrl}/api/challenges`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Erro ao listar desafios: HTTP ${res.status}`);
    }
    return res.json();
  }

  public async getChallenge(challengeId: string): Promise<ChallengeDefinition> {
    const res = await fetch(`${this.baseUrl}/api/challenges/${challengeId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`Erro ao buscar desafio: HTTP ${res.status}`);
    }
    return res.json();
  }
}
