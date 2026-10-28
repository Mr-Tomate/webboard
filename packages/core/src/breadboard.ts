export interface InternalBridge {
  fromPin: string;
  toPin: string;
  bridgeId: string;
}

/**
 * Gera as 64 pontes de condutância zero da Protoboard Half-Size (400/420 furos, 30 colunas)
 * conforme a especificação da Fase 2 (Eixo A).
 *
 * Estrutura das 64 pontes equipotenciais:
 * - 4 Barramentos horizontais contínuos de energia:
 *   1. Superior Positivo (+) : TOP_PLUS_1 a TOP_PLUS_30
 *   2. Superior Negativo (-) : TOP_MINUS_1 a TOP_MINUS_30
 *   3. Inferior Positivo (+) : BOTTOM_PLUS_1 a BOTTOM_PLUS_30
 *   4. Inferior Negativo (-) : BOTTOM_MINUS_1 a BOTTOM_MINUS_30
 *
 * - 60 Trilhas verticais de 5 furos:
 *   - 30 Trilhas na seção superior: Colunas 1 a 30, furos A, B, C, D, E.
 *   - 30 Trilhas na seção inferior: Colunas 1 a 30, furos F, G, H, I, J.
 *   - Fenda central isolante: Garante separação galvânica entre E e F (compatível com encapsulamentos DIP).
 */
export function generateBreadboardInternalBridges(componentId: string): InternalBridge[] {
  const bridges: InternalBridge[] = [];

  // 1. Barramentos de Alimentação (4 barramentos de 30 pontos)
  const rails = ['TOP_PLUS', 'TOP_MINUS', 'BOTTOM_PLUS', 'BOTTOM_MINUS'];
  for (const rail of rails) {
    for (let col = 1; col < 30; col++) {
      bridges.push({
        fromPin: `${rail}_${col}`,
        toPin: `${rail}_${col + 1}`,
        bridgeId: `bridge:${componentId}:${rail}`,
      });
    }
  }

  // 2. Trilhas de Terminais (60 trilhas verticais de 5 pinos)
  const topRows = ['A', 'B', 'C', 'D', 'E'];
  const bottomRows = ['F', 'G', 'H', 'I', 'J'];

  for (let col = 1; col <= 30; col++) {
    // Seção Superior (A-E)
    for (let r = 0; r < topRows.length - 1; r++) {
      bridges.push({
        fromPin: `${col}_${topRows[r]}`,
        toPin: `${col}_${topRows[r + 1]}`,
        bridgeId: `bridge:${componentId}:col_${col}_top`,
      });
    }

    // Seção Inferior (F-J)
    for (let r = 0; r < bottomRows.length - 1; r++) {
      bridges.push({
        fromPin: `${col}_${bottomRows[r]}`,
        toPin: `${col}_${bottomRows[r + 1]}`,
        bridgeId: `bridge:${componentId}:col_${col}_bottom`,
      });
    }
  }

  return bridges;
}
