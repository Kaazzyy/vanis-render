# Vanis 24/7 v2 — grátis sem cartão (Render + GitHub Actions)

> ⚠️ Esta versão **substitui** o plano do Hugging Face: em 2026 o HF fechou o free tier
> de Spaces Docker/Gradio para contas novas. Esta arquitetura usa só serviços que
> continuam **100% grátis e sem método de pagamento**.

## Como funciona

```
        Roblox (grava clip)                        Discord
             │ POST /api/replays                      ▲
             ▼                                        │ mp4 via webhook
┌────────────────────────────────┐        ┌─────────────────────────────┐
│ RENDER.COM free (24/7, 512MB)  │        │ GITHUB ACTIONS (por pedido) │
│  • VanisAPI (Express)          │◀───────│  • baixa o replay da API    │
│  • mini-bot que ouve !render ──┼─dispatch─▶ • Electron + Xvfb + ffmpeg │
│    (URL fixo .onrender.com)    │        │    renderizam o clip        │
└────────────────────────────────┘        └─────────────────────────────┘
             ▲                                        │
             └──── UptimeRobot pinga cada 5 min ──────┘ (mantém o Render acordado)
```

- **Render free**: URL fixo (`https://teu-nome.onrender.com`), sem cartão, 750 h/mês.
  Dorme após 15 min sem tráfego → o UptimeRobot resolve.
- **GitHub Actions**: em **repositório público** os minutos são **grátis** (runners
  Ubuntu 4 vCPU). Em repo privado são 2 000 min/mês (~40–80 renders).

---

## ⚠️ PASSO 0 — Revoga o token que vazou
O zip original tinha o token do bot dentro do `config.json`.
discord.com/developers/applications → tua app → **Bot → Reset Token**.
Guarda o token NOVO só nos Secrets (nunca em ficheiros).

---

## Parte 1 — GitHub (repo do render)

1. Cria um **repositório público** novo (ex.: `vanis-render`) em github.com/new
2. Envia para ele **todo o conteúdo desta pasta** (a estrutura tem de ficar:
   `.github/workflows/render.yml`, `render/`, `service/`, `README.md`)
   - Web: *uploading an existing file* (arrasta tudo) — ou por git
3. No repo: **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `VANIS_API_BASE` | (preenche DEPOIS da parte 2, ex.: `https://vanis-xyz.onrender.com`) |
| `DISCORD_WEBHOOK_URL` | (passo seguinte) |

4. **Webhook do Discord**: no teu servidor → canal de renders → ⚙️ *Editar canal* →
   **Integrações → Webhooks → Novo Webhook** → copia o URL → cola no secret
   `DISCORD_WEBHOOK_URL` (é por este webhook que o vídeo chega ao canal)
5. **PAT para o mini-bot**: github.com → Settings → Developer settings →
   **Personal access tokens → Fine-grained → Generate**:
   - Repository access: só o repo `vanis-render`
   - Permissions → **Actions: Read and write**
   - Copia o token (começa por `github_pat_…`) — vais usá-lo na parte 2

## Parte 2 — Render.com (API + mini-bot 24/7)

1. Cria conta em render.com (podes entrar com GitHub) — **sem cartão**
2. **New → Web Service** → liga o repo `vanis-render`:
   - Runtime: **Docker** · Region: qualquer
   - **Root Directory**: `service` · **Dockerfile Path**: `service/Dockerfile`
   - Instance Type: **Free**
3. **Environment** → adiciona:

| Key | Value |
|---|---|
| `DISCORD_TOKEN` | token NOVO do bot (passo 0) |
| `DISCORD_OWNER` | o teu ID de utilizador do Discord |
| `DISCORD_CHANNELS` | IDs dos canais de render, separados por vírgula |
| `GH_TOKEN` | o PAT fine-grained da parte 1 |
| `GH_REPO` | `teuuser/vanis-render` |
| `GH_WORKFLOW` | `render.yml` |
| `GH_REF` | `main` |

4. **Deploy**. No *Logs* deve aparecer:
   `Vanis API a correr na porta 10000` e `[Bot] NomeDoBot pronto a receber !render`
5. Volta ao GitHub e completa o secret `VANIS_API_BASE` com o URL do serviço
   (`https://teu-nome.onrender.com` — sem barra no fim)

> 💡 Ativa também **Message Content Intent** no painel do bot
> (discord.com/developers → Bot → Privileged Gateway Intents → Message Content Intent = ON)

## Parte 3 — Roblox Studio (só uma vez)

1. Game Settings → Security → **Allow HTTP Requests = ON**
2. `ReplicatedStorage → PlaceConfig`:
   `PlaceConfig.REPLAY_API_BASE = "https://teu-nome.onrender.com"`
3. Publica o jogo.

## Parte 4 — Manter 24/7 (UptimeRobot)

1. Conta grátis em uptimerobot.com (sem cartão)
2. *Add New Monitor* → HTTP(s) → `https://teu-nome.onrender.com/api/replays` → 5 min

---

## Usar

```
!render CODIGO
!render CODIGO --res 720 --fps 30 --quality medium
!render CODIGO --mass short --name all --skin all --res 480
!help
```
Ou anexa um ficheiro **.vanis** (≤5MB) diretamente no canal configurado.
Admin (dono): `!disable` / `!enable`. *(O `--dm` da versão antiga não existe na v2 —
o vídeo vai sempre para o canal do webhook.)*

## Limitações honestas

| Limitação | Detalhe | Mitigação |
|---|---|---|
| Render dorme sem tráfego | 15 min sem requests | UptimeRobot (parte 4); acordar demora ~1 min |
| Render free = 512MB | Sem margem para renderizar aí | O render corre no Actions, não no Render |
| Repo público = código visível | Tokens ficam nos Secrets, nunca no código | Normal em open source |
| Clips muito longos | Job tem máx. 50 min | `--res 720 --fps 30` ou `--res 480` |
| Vídeo > ~8MB não passa no webhook | Raro (gameplay comprime bem) | O worker re-comprime sozinho (CRF 33); se falhar, usa resolução menor |
| Ficheiros do Render são efémeros | Reinício perde replays antigos (códigos dão 404) | Volta a gravar o clip no jogo |

## Custos

**0 €** — Render free (750 h/mês ≥ 1 serviço sempre ligado) + GitHub Actions público
(minutos grátis ilimitados) + UptimeRobot free (50 monitores).
