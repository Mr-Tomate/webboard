import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../dist/app.js';
import type { AuthResponse } from '@webboard/contracts';

const prisma = new PrismaClient();

test('API Auth & Multi-Tenant RBAC: Registro, DTOs sem passwordHash, Login e Gestão de Turmas', async (t) => {
  const app = await buildApp(prisma);
  const runId = Math.random().toString(36).substring(2, 8);

  const teacherEmail = `prof_${runId}@escola.com`;
  const studentEmail = `aluno_${runId}@escola.com`;
  const password = 'SenhaSuperSegura123!';

  let teacherToken = '';
  let studentToken = '';
  let classroomCode = '';

  await t.test('1. Registro de Professor com Instituição cria conta e sanitiza passwordHash', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: `Prof. Roberto ${runId}`,
        email: teacherEmail,
        password,
        role: 'TEACHER',
        institutionName: `Instituto Tech ${runId}`
      }
    });

    assert.equal(res.statusCode, 201, `Deveria registrar professor com 201: ${res.body}`);
    const data = res.json() as AuthResponse;
    assert.ok(data.token, 'Deve retornar token JWT');
    assert.equal(data.user.email, teacherEmail);
    assert.equal(data.user.role, 'TEACHER');
    assert.ok(data.user.tenantId, 'Deve associar a um tenant');
    // Verificação estrita de segurança do DTO
    assert.equal((data.user as any).passwordHash, undefined, 'passwordHash NUNCA deve ser exposto no DTO público');
    assert.equal((data.user as any).password, undefined, 'password NUNCA deve ser exposto no DTO público');

    teacherToken = data.token;
  });

  await t.test('2. Registro com email duplicado deve retornar 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Tentativa Duplicada',
        email: teacherEmail,
        password: 'OutraSenha456!',
        role: 'TEACHER'
      }
    });

    assert.equal(res.statusCode, 409);
    const data = res.json();
    assert.equal(data.error, 'EMAIL_JA_CADASTRADO');
  });

  await t.test('3. Login com senha errada deve retornar 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: teacherEmail,
        password: 'SenhaIncorretaErrada'
      }
    });

    assert.equal(res.statusCode, 401);
    const data = res.json();
    assert.equal(data.error, 'CREDENCIAIS_INVALIDAS');
  });

  await t.test('4. Login com credenciais válidas retorna sessão e DTO sanitizado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        email: teacherEmail,
        password
      }
    });

    assert.equal(res.statusCode, 200);
    const data = res.json() as AuthResponse;
    assert.ok(data.token);
    assert.equal(data.user.email, teacherEmail);
    assert.equal((data.user as any).passwordHash, undefined, 'passwordHash não deve existir no login response');
  });

  await t.test('5. GET /api/auth/me valida token Bearer e retorna perfil', async () => {
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me'
    });
    assert.equal(unauthRes.statusCode, 401);

    const authRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        authorization: `Bearer ${teacherToken}`
      }
    });
    assert.equal(authRes.statusCode, 200);
    const data = authRes.json();
    assert.equal(data.user.email, teacherEmail);
    assert.equal(data.user.role, 'TEACHER');
    assert.equal((data.user as any).passwordHash, undefined);
  });

  await t.test('6. Registro de Aluno', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: `Aluno Carlos ${runId}`,
        email: studentEmail,
        password,
        role: 'STUDENT',
        institutionName: `Instituto Tech ${runId}`
      }
    });

    assert.equal(res.statusCode, 201);
    const data = res.json() as AuthResponse;
    studentToken = data.token;
    assert.equal(data.user.role, 'STUDENT');
  });

  await t.test('7. RBAC: Aluno NÃO pode criar turma (retorna 403 Forbidden)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        name: 'Turma Ilegal do Aluno'
      }
    });

    assert.equal(res.statusCode, 403);
    const data = res.json();
    assert.equal(data.error, 'ACESSO_NEGADO');
  });

  await t.test('8. RBAC: Professor pode criar nova turma com código gerado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/classrooms',
      headers: {
        authorization: `Bearer ${teacherToken}`
      },
      payload: {
        name: `Robótica Avançada 8º Ano ${runId}`
      }
    });

    assert.equal(res.statusCode, 201);
    const data = res.json();
    assert.ok(data.classroom.code.startsWith('ROB-'), 'Código deve iniciar com prefixo ROB-');
    classroomCode = data.classroom.code;
  });

  await t.test('9. Aluno ingressa na turma via código convite e inicializa bancada solo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/join-classroom',
      headers: {
        authorization: `Bearer ${studentToken}`
      },
      payload: {
        classroomCode
      }
    });

    assert.equal(res.statusCode, 200);
    const data = res.json();
    assert.equal(data.success, true);
    assert.equal(data.classroom.code, classroomCode);
  });

  await t.test('10. GET /api/workspaces/my lista a bancada criada para o aluno', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/workspaces/my',
      headers: {
        authorization: `Bearer ${studentToken}`
      }
    });

    assert.equal(res.statusCode, 200);
    const list = res.json() as any[];
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 1, 'Deve conter ao menos 1 workspace');
    assert.ok(list[0].name.includes('Carlos'));
  });

  await app.close();
});
