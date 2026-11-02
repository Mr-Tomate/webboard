import crypto from 'node:crypto';

const AUTH_SECRET = process.env.JWT_SECRET || 'webboard_dev_secret_key_educational_simulation_2026';

/**
 * Gera hash seguro de senha utilizando scrypt nativo do Node.js com salt aleatório.
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Valida a senha contra o hash armazenado no banco.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!storedHash || !storedHash.includes(':')) {
      return resolve(false);
    }
    const [salt, key] = storedHash.split(':');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return resolve(false);
      resolve(crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey));
    });
  });
}

export interface TokenPayload {
  userId: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  tenantId: string;
  classroomId?: string;
  iat: number;
  exp: number;
}

/**
 * Cria token assinado com HMAC-SHA256 (Stateless JWT didático).
 */
export function signAuthToken(data: {
  userId: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  tenantId: string;
  classroomId?: string;
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    ...data,
    iat: now,
    exp: now + 60 * 60 * 24 * 7 // Validade de 7 dias
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${encodedPayload}`)
    .digest('base64url');

  return `${header}.${encodedPayload}.${signature}`;
}

/**
 * Valida o token e retorna o payload caso a assinatura e expiração sejam válidas.
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
