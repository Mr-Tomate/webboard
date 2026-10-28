export type WorkbenchMode =
  | 'MODO_EDICAO'
  | 'MODO_SIMULACAO'
  | 'ESTADO_FALHA_ENG';

export interface WorkbenchFaultPayload {
  type: 'SHORT_CIRCUIT' | 'OVERCURRENT';
  message: string;
  failedWireId?: string;
  failedComponentId?: string;
}
