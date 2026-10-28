import type { ComponentDefinition, WireDefinition } from './circuit.js';
import type { ProgrammingLanguage } from './challenge.js';

export interface SubmissionCode {
  language: ProgrammingLanguage;
  sourceText: string;
}

export interface SubmissionCircuitPayload {
  circuitId?: string;
  components: ComponentDefinition[];
  wires: WireDefinition[];
}

export interface SubmissionPayload {
  code: SubmissionCode;
  circuit: SubmissionCircuitPayload;
}

export type EvaluationStatus =
  | 'APPROVED'
  | 'FAILED'
  | 'REJECTED_CIRCUIT'
  | 'COMPILATION_ERROR'
  | 'RUNNING';

export interface TestCaseResult {
  testCaseId: string;
  passed: boolean;
  executionTimeVirtualSeconds: number;
  message: string;
  errorDetails?: string;
}

export interface EvaluationSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
}

export interface EvaluationResult {
  status: EvaluationStatus;
  totalExecutionVirtualSeconds: number;
  summary: EvaluationSummary;
  testResults: TestCaseResult[];
}

export interface SubmittedBy {
  userId: string;
  collaboratorUserIds?: string[];
}

export interface SubmissionSnapshot {
  schemaVersion: string;
  submissionId: string;
  workspaceId: string;
  challengeId: string;
  versionNumber: number;
  submittedAt: string;
  submittedBy: SubmittedBy;
  payload: SubmissionPayload;
  evaluation?: EvaluationResult;
}
