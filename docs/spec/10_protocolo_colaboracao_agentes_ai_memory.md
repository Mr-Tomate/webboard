# 10 - Protocolo de Comunicação e Colaboração entre Agentes via ai-memory

## 1. Propósito
Definir a convenção de comunicação assíncrona, alinhamento técnico e histórico de decisões entre agentes de IA operando em diferentes camadas do projeto Webboard (ex: Agente Core/Backend e Agente Frontend).

---

## 2. Estrutura de Namespaces no ai-memory

Todo agente deve interagir com a memória compartilhada utilizando os seguintes caminhos (`path`):

| Namespace | Formato do Caminho | Finalidade | Responsável |
| :--- | :--- | :--- | :--- |
| **Workstreams** | `workstreams/{papel}.md` | Diário de status diário/por tarefa: o que foi concluído, o que está em progresso, bloqueios atuais e pendências. | Cada agente mantém o seu (`backend.md` ou `frontend.md`). |
| **Discussões** | `discussions/{topico}.md` | Thread de alinhamento: propostas de endpoints, dúvidas de modelagem e debates sobre comportamento. | Iniciado pelo agente proponente; respondido pelo par. |
| **Contratos** | `contracts/{modulo}.md` | Especificação detalhada de endpoints REST, eventos de WebSocket e DTOs acordados antes do código. | Coautoria entre Backend e Frontend. |
| **Decisões** | `decisions/{decisao}.md` | Registro imutável de decisões arquiteturais consolidadas após debate. | O agente que fechou o consenso. |

---

## 3. Formato Canônico de uma Discussão (`discussions/{topico}.md`)

Quando um agente precisar propor um novo comportamento ou requisição para a outra camada, deve criar a página com a seguinte estrutura:

```markdown
# Discussão: [Título Claro do Tópico]

## Status: EM_DEBATE | APROVADO | REJEITADO
- **Data de Abertura:** AAAA-MM-DD
- **Proponente:** Agente Frontend | Agente Backend
- **Destinatário:** Agente Backend | Agente Frontend

---

### 1. Contexto e Motivação
Por que essa necessidade surgiu? Qual é a restrição de tela ou de banco de dados?

### 2. Proposta Técnica
- Formato sugerido (Payload JSON, URL, Evento WebSocket, etc.)
- Exemplo prático de entrada e saída.

### 3. Impacto e Dúvidas para o Outro Agente
- Pergunta objetiva 1?
- Pergunta objetiva 2?

---

## Réplicas e Alinhamento
### Resposta do [Agente Destinatário] - AAAA-MM-DD
- Parecer técnico sobre a proposta.
- Ajustes necessários ou aprovação direta.
```

---

## 4. Regras Rígidas para os Agentes

1. **Regra de Consulta Obrigatória Pré-Tarefa:**  
   Antes de iniciar qualquer código, todo agente deve executar `memory_read_page` em `workstreams/` do outro agente e nas páginas de `contracts/` e `decisions/` para garantir que está sincronizado com as últimas decisões.
2. **Proibição de Modificação Unilateral de Contratos:**  
   Nenhum agente pode alterar um DTO existente em `@webboard/contracts` ou criar um novo endpoint sem antes registrar a proposta em `discussions/` e obter confirmação do outro agente.
3. **Registro de Conclusão de Tijolo:**  
   Ao finalizar um tijolo (brick) com testes passando, o agente deve atualizar seu `workstreams/{papel}.md` informando:
   - Os arquivos criados/modificados.
   - O comando para rodar os testes daquela entrega e o resultado observado.
   - O próximo tijolo que iniciará.
