export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string, code = 'DADOS_INVALIDOS') {
    super(400, code, message);
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Não autorizado.', code = 'NAO_AUTORIZADO') {
    super(401, code, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Acesso negado.', code = 'ACESSO_NEGADO') {
    super(403, code, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Recurso não encontrado.', code = 'NAO_ENCONTRADO') {
    super(404, code, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, code = 'CONFLITO') {
    super(409, code, message);
  }
}
