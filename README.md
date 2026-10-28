# Avinor · Painel de Atendimento

Painel interno da Avinor (Vitória da Conquista, BA) para organizar a fila comercial do dia, recuperar clientes parados e acompanhar as rotas da semana.

## O que o sistema faz

- **Login sem senha**: Administrador ou Colaborador.
- **Clientes do Dia**: montados pela coluna **Enviar cards** da planilha `ROTAS AVINOR.xlsx`.
- **Em Recuperação**: última compra há mais de 90 dias, com destaque para quem faturou alto e sumiu.
- **MySQL EXTRACTOR**: somente consulta. Nada é gravado lá.
- **Neon PostgreSQL**: status, histórico e configurações (em produção). Localmente cai no SQLite.

---

## Subir no Render (produção)

O projeto sobe **num serviço só**: API + painel no mesmo endereço.

1. Crie um projeto no [Neon](https://neon.tech) e copie a connection string (`sslmode=require`).
2. Suba o código para um repositório Git (GitHub/GitLab). **Não commite o `.env`.**
3. No Render: **New → Blueprint** e aponte para o repo (usa o `render.yaml`).
   - Ou **New → Web Service** → Docker → este repositório.
4. Preencha no dashboard:
   - `MYSQL_PASSWORD` — senha do EXTRACTOR
   - `NEON_DATABASE_URL` — string do Neon
   - `AVINOR_SECRET_KEY` — o blueprint já gera; não troque depois sem necessidade
5. Deploy. Health check: `/api/health`.
6. Abra a URL do serviço (ex.: `https://avinor-atendimento.onrender.com`).

A primeira carga após o sleep do plano free pode levar ~30s (o MySQL agrega o faturamento).

---

## Como subir local

1. Copie `.env.example` para `.env` e preencha `MYSQL_PASSWORD`.
2. Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

3. Frontend (outro terminal):

```powershell
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173

## Docker local (igual ao Render)

```powershell
docker compose up --build
```

Painel em http://localhost:8080

## Testes

```powershell
cd backend
.\.venv\Scripts\pytest -q
```

## Importante

O MySQL do EXTRACTOR é **somente leitura**. O backend recusa qualquer SQL que não seja SELECT/SHOW.
