# 04 - Domínio Pedagógico, Gestão de Sala e Workspaces

## 1. Responsabilidade
Modelar a estrutura escolar multi-tenant, as permissões de acesso, a colaboração em bancadas e a visibilidade de telemetria em tempo real para os educadores.

---

## 2. A Hierarquia Institucional

```
[ Instituição de Ensino (School Tenant) ]
   └── [ Turma (Classroom) ]
         ├── [ Educador (Professor) ]
         ├── [ Estudantes (Alunos) ]
         ├── [ Trilha Curricular (Desafios Atribuídos) ]
         └── [ Workspaces de Trabalho ]
```

### Papéis de Acesso (RBAC)
* **Gestor / Coordenador:** Gerencia contratos, turmas, limites de licenças e relatórios executivos.
* **Professor:** Publica desafios, acompanha o painel de telemetria ao vivo e insere feedbacks contextuais.
* **Aluno:** Realiza desafios na bancada, utiliza o sandbox pessoal e participa de workspaces solo ou em grupo.

---

## 3. O Modelo de Workspace (Solo e Grupo)

A bancada não pertence a um usuário isolado, mas a um **Workspace**:
* **Workspace Solo:** Contém 1 membro proprietário.
* **Workspace Grupo:** Contém 2 ou mais membros vinculados à mesma turma escolar.
  - Todos os membros do grupo possuem permissão de edição do circuito e do código.
  - A submissão oficial é associada a todos os membros do Workspace, garantindo nota e registro de autoria compartilhados.
  - O histórico de alterações mantém o registro de quem executou cada ação.

---

## 4. O Painel do Professor e Regras de Intervenção

### 4.1. Telemetria em Tempo Real (Visão Panóptica)
Durante a aula, a bancada dos alunos emite pulsos periódicos de status para o painel do professor:
* **VERDE (`NORMAL`):** Circuito funcional, código compilando, progredindo nos testes.
* **AMARELO (`DIFICULDADE`):** Erros de compilação consecutivos (3+) ou falha contínua no mesmo teste.
* **VERMELHO (`FALHA_CRÍTICA`):** Curto-circuito ou componente destruído na bancada.
* **CINZA (`INATIVO`):** Sem interação física ou digitação por mais de $X$ minutos.

### 4.2. Filosofia de Intervenção (Professor Mentor)
* **RN-PED-01 (Proibição de Edição Remota Direta):** O professor **não manipula os fios nem edita o código** do aluno diretamente. O controle da bancada permanece nas mãos do estudante para preservar a autonomia cognitiva.
* **RN-PED-02 (Feedback Contextual Anotado):** O professor entra em modo espelho (*view-only*) e pode marcar componentes ou linhas de código para enviar notas de orientação pedagógica (ex: *"Verifique se `res_01` está no caminho correto para o terra"*).
