# BR Events Web

Frontend da plataforma BR Events, construído com Next.js 16, React 19 e TypeScript.

O sistema visual segue uma linguagem suave de régua de transmissão: Baloo 2 nos títulos, Archivo no conteúdo, IBM Plex Mono nos dados ao vivo e a paleta Estúdio/Papel/Tally/Sinal/Régua.

## Executar localmente

Pré-requisitos: Node.js 20.9 ou superior e a API BR Events disponível em `http://127.0.0.1:8000`.

```bash
copy .env.example .env.local
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Experiências disponíveis

- `/entrar` e `/criar-conta` — autenticação com sessão em cookies HTTP-only
- `/eventos/[slug]` — página pública alimentada pela API
- `/eventos/[slug]/inscricao` — cadastro de conta e inscrição no evento
- `/eventos/[slug]/agenda` — programação publicada
- `/eventos/[slug]/ao-vivo` — transmissão, presença, chat, Q&A e enquetes em tempo real
- `/eventos/[slug]/gravacoes` — catálogo on-demand
- `/painel` — operação completa de eventos, participantes, agenda, salas, interações, gravações e analytics
- `/painel/eventos/novo` — criação guiada de evento

## Usuários locais

Depois de executar `python manage.py seed_demo` na API:

- organizador: `organizador` / `Brevents#2026`
- participante: `participante` / `Brevents#2026`

Os tokens JWT não ficam expostos ao JavaScript do navegador: o Next atua como BFF e mantém acesso e renovação em cookies HTTP-only.

## Verificação

```bash
npm run lint
npm run build
```
