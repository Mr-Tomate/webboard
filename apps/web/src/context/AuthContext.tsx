import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  UserProfile,
  ClassroomSummary,
  LoginPayload,
  RegisterPayload,
  AuthResponse
} from '@webboard/contracts';
import { WebboardApiClient } from '../api/client.js';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  classrooms: ClassroomSummary[];
  activeClassroom: ClassroomSummary | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  apiClient: WebboardApiClient;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  quickJoinClassroom: (name: string, classroomCode: string) => Promise<void>;
  joinClassroom: (classroomCode: string) => Promise<void>;
  createClassroom: (name: string) => Promise<ClassroomSummary>;
  selectClassroom: (classroom: ClassroomSummary) => void;
  logout: () => void;
}

const STORAGE_KEY = 'webboard_auth_session';

const AuthContext = createContext<AuthContextValue | null>(null);

export const apiClient = new WebboardApiClient();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.token && parsed.user) {
          apiClient.setToken(parsed.token);
          return {
            user: parsed.user,
            token: parsed.token,
            classrooms: parsed.classrooms || [],
            activeClassroom: parsed.activeClassroom || null,
            isAuthenticated: true,
            isLoading: false
          };
        }
      }
    } catch {
      // Ignora erro de parsing do localStorage
    }
    return {
      user: null,
      token: null,
      classrooms: [],
      activeClassroom: null,
      isAuthenticated: false,
      isLoading: false
    };
  });

  // Salva no localStorage quando o estado de autenticação mudar
  const persistSession = useCallback((
    token: string | null,
    user: UserProfile | null,
    classrooms: ClassroomSummary[] = [],
    activeClassroom: ClassroomSummary | null = null
  ) => {
    if (token && user) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, user, classrooms, activeClassroom })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await apiClient.login(payload);
      apiClient.setToken(res.token);

      // Busca perfil completo com lista de turmas
      const profile = await apiClient.getMe();
      const active = res.activeClassroom || profile.activeClassroom || profile.classrooms[0] || null;

      persistSession(res.token, res.user, profile.classrooms, active);
      setState({
        user: res.user,
        token: res.token,
        classrooms: profile.classrooms,
        activeClassroom: active,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, [persistSession]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await apiClient.register(payload);
      apiClient.setToken(res.token);

      const profile = await apiClient.getMe();
      const active = res.activeClassroom || profile.activeClassroom || null;

      persistSession(res.token, res.user, profile.classrooms, active);
      setState({
        user: res.user,
        token: res.token,
        classrooms: profile.classrooms,
        activeClassroom: active,
        isAuthenticated: true,
        isLoading: false
      });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, [persistSession]);

  /**
   * Entrada rápida e sem atrito para estudantes em aula de robótica.
   * Gera um email temporário automático baseado no código da turma e nome.
   */
  const quickJoinClassroom = useCallback(async (name: string, classroomCode: string) => {
    const cleanName = name.trim();
    const cleanCode = classroomCode.trim().toUpperCase();
    const tempSlug = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'aluno';
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const guestEmail = `${tempSlug}_${cleanCode.toLowerCase()}_${randomSuffix}@escola.webboard`;
    const defaultPassword = `WebboardStudent_${Date.now()}`;

    await register({
      name: cleanName,
      email: guestEmail,
      password: defaultPassword,
      role: 'STUDENT',
      classroomCode: cleanCode,
      institutionName: `Turma ${cleanCode}`
    });
  }, [register]);

  const joinClassroom = useCallback(async (classroomCode: string) => {
    const res = await apiClient.joinClassroom({ classroomCode });
    setState((s) => {
      const updatedClassrooms = [...s.classrooms.filter((c) => c.id !== res.classroom.id), res.classroom];
      persistSession(s.token, s.user, updatedClassrooms, res.classroom);
      return {
        ...s,
        classrooms: updatedClassrooms,
        activeClassroom: res.classroom
      };
    });
  }, [persistSession]);

  const createClassroom = useCallback(async (name: string) => {
    const res = await apiClient.createClassroom({ name });
    setState((s) => {
      const updatedClassrooms = [...s.classrooms, res.classroom];
      persistSession(s.token, s.user, updatedClassrooms, res.classroom);
      return {
        ...s,
        classrooms: updatedClassrooms,
        activeClassroom: res.classroom
      };
    });
    return res.classroom;
  }, [persistSession]);

  const selectClassroom = useCallback((classroom: ClassroomSummary) => {
    setState((s) => {
      persistSession(s.token, s.user, s.classrooms, classroom);
      return {
        ...s,
        activeClassroom: classroom
      };
    });
  }, [persistSession]);

  const logout = useCallback(() => {
    apiClient.setToken(null);
    persistSession(null, null, [], null);
    setState({
      user: null,
      token: null,
      classrooms: [],
      activeClassroom: null,
      isAuthenticated: false,
      isLoading: false
    });
  }, [persistSession]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        apiClient,
        login,
        register,
        quickJoinClassroom,
        joinClassroom,
        createClassroom,
        selectClassroom,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider>');
  }
  return context;
}
