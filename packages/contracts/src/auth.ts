export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName?: string;
  createdAt?: string;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  code: string;
  tenantId: string;
  memberCount?: number;
  role?: 'TEACHER' | 'STUDENT';
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  activeClassroom?: ClassroomSummary | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  institutionName?: string;
  classroomCode?: string;
}

export interface CreateClassroomPayload {
  name: string;
}

export interface JoinClassroomPayload {
  classroomCode: string;
}
