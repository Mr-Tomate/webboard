# GEMINI.md — Instruções para Gemini / Google Code Assist

Este projeto segue as diretrizes canônicas para agentes de inteligência artificial documentadas no arquivo [AGENTS.md](AGENTS.md).

## Resumo Rápido para a Sessão
1. **Documentação Oficial:** Toda a arquitetura e regras de negócio estão em [`docs/spec/README.md`](docs/spec/README.md).
2. **Escopo de Memória:** O projeto utiliza o MCP `ai-memory` sob o escopo definido em [`.ai-memory.toml`](.ai-memory.toml) (`workspace = "default"`, `project = "webboard"`).
3. **Diários de Trabalho:** Antes de codificar, consulte sempre `workstreams/backend.md` ou `workstreams/frontend.md` via `memory_read_page`.
4. **Execução Incremental:** Construa sempre tijolo a tijolo conforme o plano em [`docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md`](docs/spec/11_plano_de_execucao_tijolo_a_tijolo.md).

Para a especificação completa de comportamento, limites e comunicação, leia [AGENTS.md](AGENTS.md).
