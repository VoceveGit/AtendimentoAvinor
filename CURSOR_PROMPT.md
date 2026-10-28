# Avinor — Painel de Atendimento (prompt operacional)

Sistema de gestão de atendimento da Avinor (Vitória da Conquista, BA), substituto do Btrix.

## Regras que não podem quebrar

1. Login sem senha: dois botões (Administrador / Colaborador). Role no localStorage.
2. MySQL EXTRACTOR é **somente leitura**. Nunca INSERT/UPDATE/DELETE. Tabelas usadas: `base_clientes_avinor` e `faturamento_avinor`.
3. Escrita (status, histórico, configs) no Neon PostgreSQL; fallback SQLite local.
4. **Clientes do Dia** nascem da coluna **Enviar cards** da planilha `ROTAS AVINOR.xlsx` — era o dia em que os cards iam para o Btrix para a equipe entrar em contato. **Não** usar Saída da Carga para montar a fila do dia.
5. Vitória da Conquista: bairro → VDC Leste ou VDC Oeste (aba Divisão VDC).
6. Recuperação: última compra em `faturamento_avinor` > 90 dias. Badge muda após 120. Alto valor sobe na lista. Status `em_recuperacao` é derivado, não setado à mão.
7. Streak = semanas seguidas com compra; foguinho (ícone Flame) e ordenação no topo da fila do dia.
8. Colaborador não vê Config Status, Conexão de Banco, Importar, Script Cursor.
9. Import .xlsx com detecção dinâmica da linha de títulos (≥ 3 células string) e mapeamento persistido.

## Stack

React 19 + Tailwind 3 + lucide-react + sonner + react-router.
Python FastAPI + SQLAlchemy 2 + aiomysql + asyncpg + openpyxl.

## Visual

Primária `#C83818`, alerta `#E67E22`, sidebar `#0F172A`, fundo `#F8FAFC`.
Fontes Outfit / Plus Jakarta Sans / JetBrains Mono.
