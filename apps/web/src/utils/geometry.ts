import type { Position2D, WireWaypoint } from '@webboard/contracts';

export const GRID_SIZE = 20;
export const MAJOR_GRID_FACTOR = 5; // 5 * 20 = 100px
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3.0;

/**
 * Interface mínima de contexto gráfico para traçar caminhos 2D,
 * compatível tanto com CanvasRenderingContext2D nativo quanto com Konva.Context.
 */
export interface PathDrawingContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  lineTo(x: number, y: number): void;
}

/**
 * Arredonda um valor escalar para o ponto mais próximo da grade (snap).
 */
export function snapToGrid(val: number, gridSize: number = GRID_SIZE): number {
  return Math.round(val / gridSize) * gridSize;
}

/**
 * Aplica o snap magnético em um ponto 2D.
 */
export function snapPointToGrid(point: Position2D, gridSize: number = GRID_SIZE): Position2D {
  return {
    x: snapToGrid(point.x, gridSize),
    y: snapToGrid(point.y, gridSize)
  };
}

/**
 * Converte coordenadas de tela (viewport do mouse em pixels do browser)
 * para coordenadas do mundo virtual da bancada.
 */
export function screenToWorld(
  screenPos: Position2D,
  stageOffset: Position2D,
  scale: number
): Position2D {
  return {
    x: (screenPos.x - stageOffset.x) / scale,
    y: (screenPos.y - stageOffset.y) / scale
  };
}

/**
 * Converte coordenadas do mundo virtual da bancada para coordenadas de tela.
 */
export function worldToScreen(
  worldPos: Position2D,
  stageOffset: Position2D,
  scale: number
): Position2D {
  return {
    x: worldPos.x * scale + stageOffset.x,
    y: worldPos.y * scale + stageOffset.y
  };
}

/**
 * Garante que o fator de zoom esteja dentro dos limites operacionais permitidos.
 */
export function clampZoom(
  scale: number,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM
): number {
  return Math.min(Math.max(scale, minZoom), maxZoom);
}

/**
 * Calcula o novo deslocamento (stage offset) para que o zoom ocorra
 * ancorado exatamente no ponto onde o cursor do mouse está apontando.
 */
export function calculateZoomAtPointer(
  pointerScreenPos: Position2D,
  currentStageOffset: Position2D,
  currentScale: number,
  newScale: number
): Position2D {
  const mouseWorldPos = screenToWorld(pointerScreenPos, currentStageOffset, currentScale);

  return {
    x: pointerScreenPos.x - mouseWorldPos.x * newScale,
    y: pointerScreenPos.y - mouseWorldPos.y * newScale
  };
}

/**
 * Calcula a posição absoluta de um pino na bancada com base na posição
 * do componente e no offset relativo da âncora do pino.
 * Suporta rotação em incrementos ortogonais (0, 90, 180, 270 graus).
 */
export function getPinAbsolutePosition(
  componentPos: Position2D,
  anchorPos: Position2D,
  rotationDegrees: number = 0
): Position2D {
  const rad = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rotatedX = anchorPos.x * cos - anchorPos.y * sin;
  const rotatedY = anchorPos.x * sin + anchorPos.y * cos;

  return {
    x: componentPos.x + rotatedX,
    y: componentPos.y + rotatedY
  };
}

/**
 * Gera pontos de controle Bézier adaptativos e flexíveis para cabos elétricos.
 *
 * Elimina o comportamento anterior de base rígida voltada para baixo:
 * - O vetor tangente acompanha dinamicamente a direção angular da conexão.
 * - Caimento gravitacional (sag) proporcional à projeção horizontal.
 * - Evita o mergulho indesejado (U-turn) que atravessava o corpo dos componentes.
 */
export function calculateWireBezierControlPoints(
  from: Position2D,
  to: Position2D
): [Position2D, Position2D] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 1) {
    return [{ ...from }, { ...to }];
  }

  // Fator de orientação horizontal (1.0 = puramente horizontal, 0.0 = puramente vertical)
  const horizontalFactor = Math.abs(dx) / dist;
  
  // Caimento natural suave no vão livre do fio (catenária adaptativa)
  const sag = horizontalFactor * Math.min(dist * 0.22, 45);

  // Ponto de controle de saída (avança na direção do vetor com caimento suave)
  const cp1: Position2D = {
    x: from.x + dx * 0.35,
    y: from.y + dy * 0.35 + sag
  };

  // Ponto de controle de chegada (recua suavemente a partir do destino)
  let cp2Y = to.y - dy * 0.35 + sag;

  // Garante que o cabo nunca faça laço ou U-turn invadindo o corpo da placa
  if (dy > 0 && cp2Y > to.y) {
    // Fio descendo: deve entrar suavemente por cima do pino
    cp2Y = to.y - Math.min(dy * 0.2, 20);
  } else if (dy < 0 && cp2Y < to.y) {
    // Fio subindo: deve entrar suavemente por baixo do pino
    cp2Y = to.y + Math.min(Math.abs(dy) * 0.2, 20);
  }

  const cp2: Position2D = {
    x: to.x - dx * 0.35,
    y: cp2Y
  };

  return [cp1, cp2];
}

/**
 * Gera a sequência de pontos ordenados de um fio elétrico,
 * intercalando os waypoints intermediários entre o ponto inicial e final.
 */
export function getWirePathPoints(
  startPos: Position2D,
  endPos: Position2D,
  waypoints?: WireWaypoint[]
): Position2D[] {
  if (!waypoints || waypoints.length === 0) {
    return [startPos, endPos];
  }
  return [startPos, ...waypoints, endPos];
}

/**
 * Traça o caminho do fio no contexto 2D (HTML5 Canvas ou Konva.Context).
 * Se houver waypoints, conecta através dos waypoints com curvas suaves ou retas.
 * Se não houver waypoints, usa a curva Bézier natural com caimento gravitacional.
 */
export function drawWirePath(
  ctx: PathDrawingContext,
  startPos: Position2D,
  endPos: Position2D,
  waypoints?: WireWaypoint[]
): void {
  const points = getWirePathPoints(startPos, endPos, waypoints);

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    // Curva Bézier flexível adaptada à geometria da conexão
    const [cp1, cp2] = calculateWireBezierControlPoints(points[0], points[1]);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, points[1].x, points[1].y);
  } else {
    // Caminho com waypoints: traça curvas suaves interpoladas entre cada vértice
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);
  }
}
