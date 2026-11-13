// Vanis Service v2.1 — API de replays + mini-bot de escuta num só processo.
// v2.1: watchdog anti-startup_failure — vigia cada run e avisa o Discord se o
// GitHub morrer no arranque (antes ficava tudo calado).
// Corre 24/7 no Render free (512MB chega: sem Electron, sem ffmpeg aqui).
// O render pesado corre no GitHub Actions — este serviço só:
//   1) recebe replays do Roblox (POST /api/replays)
//   2) serve replays (GET /api/replays/:code)  <- o workflow do Actions vai buscá-los aqui
//   3) ouve !render no Discord e dispara o workflow no GitHub

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActivityType,
} from "discord.js";
import { fileURLToPath } from "url";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== v2.13: rede de seguranca — nenhum erro assincrono derruba o processo =====
// (o crash "DiscordAPIError[10008]: Unknown Message" vinha daqui: uma mensagem
//  temporaria ja apagada fazia o .delete() rejeitar e o Node 20 matava o processo
//  inteiro — por isso o bot ficava "desligado do nada")
process.on("unhandledRejection", (e) => {
  try { pushAlert(`unhandledRejection ignorado: ${e && (e.message || e)}`); } catch {}
  console.error("[Svc] unhandledRejection ignorado:", e && (e.stack || e));
});
process.on("uncaughtException", (e) => {
  try { pushAlert(`uncaughtException ignorado: ${e && (e.message || e)}`); } catch {}
  console.error("[Svc] uncaughtException ignorado:", e && (e.stack || e));
});

const PORT = parseInt(process.env.PORT || "10000", 10);
const DATA_DIR = path.join(__dirname, "data");
const FILES_DIR = path.join(DATA_DIR, "files");
const DB_FILE = path.join(DATA_DIR, "db.json");

// ============================================================
// v3: armazenamento no Backblaze B2 (API compatível com S3).
// O disco do Render free é efémero — a cada reinício/sleep os clips
// desapareciam. Com o B2 o ficheiro fica lá e a chave do objecto é o
// próprio código (clips/<code>.vanis), por isso não há mapa para perder.
// Sem as 4 variáveis preenchidas, o serviço volta ao disco local (dev).
// ============================================================
const B2_KEY_ID = process.env.B2_KEY_ID || "";
const B2_APP_KEY = process.env.B2_APP_KEY || "";
const B2_BUCKET = process.env.B2_BUCKET || "";
const B2_ENDPOINT = (process.env.B2_ENDPOINT || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
const B2_REGION = process.env.B2_REGION || (B2_ENDPOINT.match(/^s3\.([^.]+)\./i) || [])[1] || "us-west-004";
const B2_PREFIX = (process.env.B2_PREFIX || "clips").replace(/^\/+|\/+$/g, "");

const b2 = (B2_KEY_ID && B2_APP_KEY && B2_BUCKET && B2_ENDPOINT)
  ? new S3Client({
      region: B2_REGION,
      endpoint: "https://" + B2_ENDPOINT,
      forcePathStyle: true,          // o B2 só suporta path-style
      credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APP_KEY },
    })
  : null;

const b2Key = code => `${B2_PREFIX}/${code}.vanis`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

console.log(b2
  ? `[B2] storage ativo: bucket=${B2_BUCKET} endpoint=${B2_ENDPOINT} prefixo=${B2_PREFIX}/`
  : "[B2] sem credenciais (B2_KEY_ID/B2_APP_KEY/B2_BUCKET/B2_ENDPOINT) — a usar disco local, que se perde em cada reinício");

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch { return {}; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function genCode(len = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// ============================================================
// API (igual à VanisAPI original, mais robusta)
// ============================================================
const app = express();
app.use(cors());
app.use("/api/replays", express.raw({ type: "*/*", limit: "5mb" }));

app.get("/api/replays", (req, res) => {
  res.json({ count: Object.keys(loadDB()).length });
});

app.get("/api/replays/:code", async (req, res) => {
  const code = String(req.params.code || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) return res.status(404).send("invalid code");

  // v3: com B2 o clip vive no bucket; a chave é o próprio código
  if (b2) {
    try {
      const obj = await b2.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: b2Key(code) }));
      const bytes = await obj.Body.transformToByteArray();
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.send(Buffer.from(bytes));
    } catch (e) {
      const st = e && e.$metadata && e.$metadata.httpStatusCode;
      if (st === 404 || e.name === "NoSuchKey" || e.name === "NotFound")
        return res.status(404).send("file not found");
      console.error(`[B2] GET ${code} falhou:`, e && e.message);
      return res.status(502).send("storage error");
    }
  }

  const db = loadDB();
  if (!db[code]) return res.status(404).send("invalid code");
  const filePath = path.join(FILES_DIR, code + ".vanis");
  if (!fs.existsSync(filePath)) return res.status(404).send("file not found");
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(filePath);
});

app.post("/api/replays", async (req, res) => {
  let buf = req.body;
  if (!buf || buf.length === 0) return res.status(400).json({ error: "empty body" });

  // aceita também {"data": "REPLAY|..."} de builds antigas do jogo
  if (buf[0] === 0x7b) {
    try {
      const j = JSON.parse(buf.toString("utf8"));
      if (j && typeof j.data === "string") buf = Buffer.from(j.data, "utf8");
    } catch {}
  }
  if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: "too big, max 5MB" });

  const text = buf.toString("utf8", 0, Math.min(buf.length, 1000));
  if (!text.startsWith("REPLAY|")) {
    return res.status(400).json({ error: "invalid header, must start with REPLAY|" });
  }
  const proto = text.split("|")[1];
  if (!["2", "3", "4"].includes(proto)) {
    console.log("Warning: protocol not 2/3/4, got", proto);
  }

  const code = genCode(16);

  // v3: upload para o B2. O objecto fica em clips/<code>.vanis.
  if (b2) {
    try {
      await b2.send(new PutObjectCommand({
        Bucket: B2_BUCKET,
        Key: b2Key(code),
        Body: buf,
        ContentType: "text/plain; charset=utf-8",
      }));
    } catch (e) {
      console.error(`[B2] PUT ${code} falhou:`, e && e.message);
      return res.status(502).json({ error: "storage upload failed" });
    }
  } else {
    fs.writeFileSync(path.join(FILES_DIR, code + ".vanis"), buf);
  }

  // db.json é só um índice local (best-effort): com B2 o GET não depende dele
  try {
    const db = loadDB();
    db[code] = { createdAt: new Date().toISOString(), size: buf.length };
    saveDB(db);
  } catch {}

  console.log(`Saved replay ${code} (${buf.length} bytes)${b2 ? " → B2" : " → disco"}`);
  res.json({ code });
});

app.get("/", (req, res) => {
  res.send("Vanis service v2 online. POST/GET /api/replays, bot listening on Discord.");
});

app.listen(PORT, () => {
  console.log(`Vanis API a correr na porta ${PORT}`);
});

// ============================================================
// Mini-bot: só escuta !render e dispara o workflow no GitHub
// ============================================================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const OWNER_ID = process.env.DISCORD_OWNER || "";
const CHANNELS = (process.env.DISCORD_CHANNELS || "")
  .split(",").map(s => s.trim()).filter(Boolean);

const GH_TOKEN = process.env.GH_TOKEN || "";
const GH_REPO = process.env.GH_REPO || "";            // ex.: "teuuser/vanis-render"
const GH_WORKFLOW = process.env.GH_WORKFLOW || "render.yml";
const GH_REF = process.env.GH_REF || "main";

const DEFAULT_CONFIG = {
  fps: "60", res: "1080", skin: "all",
  name: "all", mass: "short", quality: "medium",
};

function replyTemp(channel, payload, ms = 10000) {
  return channel.send(payload).then(m => {
    // v2.13: try/catch nao apanha erros assincronos — usar .catch()
    setTimeout(() => { if (m && typeof m.delete === "function") m.delete().catch(() => {}); }, ms);
    return m;
  }).catch(() => null);
}

function parseConfig(raw) {
  const config = { ...DEFAULT_CONFIG };
  let args = raw.toLowerCase().split(/ /g);
  const bad = (msg) => ({ error: msg });
  while (args.length) {
    const arg = args.shift();
    let next = args.shift();
    if (!arg) { if (next) args.unshift(next); continue; }
    const check = (valid, label) => {
      if (valid.includes(next)) { config[label] = next; return true; }
      return false;
    };
    switch (arg) {
      case "--fps":
        if (!check(["60", "30", "25", "1"], "fps")) return bad(`Input FPS **${next}** is not a valid option (**60**|**30**|**25**)`);
        break;
      case "--res":
        if (!check(["1080", "720", "480", "360", "240", "144"], "res")) return bad(`Input resolution **${next}** is not a valid option (**1080**|**720**|**480**|**360**|**240**|**144**)`);
        break;
      case "--skin":
        if (!check(["all", "tag", "me", "none"], "skin")) return bad(`Input skin option **${next}** is not a valid option (**all**|**tag**|**me**|**none**)`);
        break;
      case "--name":
        if (!check(["all", "hideme", "none"], "name")) return bad(`Input name option **${next}** is not a valid option (**all**|**hideme**|**none**)`);
        break;
      case "--mass":
        if (!check(["short", "long", "none"], "mass")) return bad(`Input mass option **${next}** is not a valid option (**short**|**long**|**none**)`);
        break;
      case "--quality":
        if (!check(["high", "medium", "low"], "quality")) return bad(`Input quality option **${next}** is not a valid option (**high**|**medium**|**low**)`);
        break;
      default:
        if (arg.startsWith("--")) return bad(`Unknown argument: **${arg}** (note: --dm doesn't exist in v2)`);
        if (next) args.unshift(next);
    }
  }
  return { config };
}

async function dispatchWorkflow(inputs) {
  if (!GH_TOKEN || !GH_REPO) throw new Error("GH_TOKEN/GH_REPO not configured in the service (Render env).");
  const url = `https://api.github.com/repos/${GH_REPO}/actions/workflows/${GH_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "vanis-service",
    },
    body: JSON.stringify({ ref: GH_REF, inputs }),
  });
  if (res.status === 204) return;
  let detail = "";
  try { detail = (await res.text()).slice(0, 300); } catch {}
  throw new Error(`GitHub responded ${res.status}: ${detail}`);
}

// v2.1 watchdog: o GitHub às vezes mata um run com "startup_failure" (erro
// interno do GitHub) ANTES de qualquer job correr — nenhum passo corre, logo o
// aviso do render.yml também nunca corre e o utilizador fica sem saber nada.
// Este watchdog vigia o run durante 12 min e:
//   • startup_failure (1a vez) -> avisa no canal e volta a disparar sozinho
//   • startup_failure (2a vez) -> avisa que é erro do GitHub e para
//   • >12 min sem terminar    -> avisa que está preso na fila (com link)
// success/failure não geram mensagens aqui: o worker já entrega o clip e o
// render.yml já tem o aviso de falha — não duplicamos nada.
let watchSeq = 0;
// runs já "reclamados" por um watchdog — evita que dois watchRun peguem no
// mesmo run quando há dois !render quase ao mesmo tempo (a API de dispatch do
// GitHub não devolve o id do run, por isso temos de o adivinhar pela janela)
const claimedRuns = new Set();
function watchRun(channel, inputs, attempt, excludeIds) {
  const startedAt = Date.now();
  const deadline = startedAt + 12 * 60 * 1000;
  const stagger = (watchSeq++ % 3) * 6000;
  let runId = null;
  const tick = async () => {
    try {
      const res = await ghApi("/actions/runs?event=workflow_dispatch&per_page=30");
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const j = await res.json();
      // ordem ASCENDENTE: o watchdog reclama o run mais antigo livre — assim,
      // com dois !render quase seguidos, cada watchdog fica com o seu run
      const runs = (j.workflow_runs || [])
        .slice()
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      let run = runs.find(r => !excludeIds.includes(r.id) && !claimedRuns.has(r.id) &&
        new Date(r.created_at).getTime() >= startedAt - 60 * 1000);
      if (runId) run = runs.find(r => r.id === runId) || run;
      if (!run) {
        if (Date.now() < deadline) { setTimeout(tick, 25000); }
        return;
      }
      if (!runId) {
        claimedRuns.add(run.id);
        while (claimedRuns.size > 100) claimedRuns.delete(claimedRuns.values().next().value);
      }
      runId = run.id;
      if (run.status !== "completed") {
        if (Date.now() < deadline) { setTimeout(tick, 25000); return; }
        // aviso de "preso" SÓ se nunca arrancou (queued). in_progress é o render
        // a correr — a barra de progresso já informa e o timeout de 45 min do
        // render.yml + aviso de falha cobrem o resto.
        if (run.status === "queued") {
          pushAlert(`Run ${run.id} stuck in queue >12min (never started)`);
          if (channel && typeof channel.send === "function")
            await channel.send(`⏳ The render of \`${inputs.code}\` has been stuck in the queue for over **12 minutes** without starting. Check: ${run.html_url}`).catch(() => {});
        }
        return;
      }
      if (run.conclusion === "startup_failure") {
        pushAlert(`Run ${run.id} startup_failure (GitHub internal error) — attempt ${attempt}`);
        if (attempt < 2) {
          if (channel && typeof channel.send === "function")
            await channel.send("⚠️ GitHub failed to start the render (**startup_failure** — an internal GitHub error, not a problem with your render). Retrying automatically in 20s…").catch(() => {});
          setTimeout(async () => {
            try {
              await dispatchWorkflow(inputs);
              watchRun(channel, inputs, attempt + 1, excludeIds.concat(run.id));
            } catch (e) {
              pushAlert(`Auto-retry dispatch failed: ${e.message}`);
              if (channel && typeof channel.send === "function")
                await channel.send(`❌ The automatic retry failed: ${e.message}\nPlease try \`!render\` again in a few minutes.`).catch(() => {});
            }
          }, 20000);
        } else {
          if (channel && typeof channel.send === "function")
            await channel.send("❌ The render failed to start **twice** (**startup_failure** — a GitHub Actions service error, not your render). Please try `!render` again in a few minutes.\nGitHub status: https://www.githubstatus.com").catch(() => {});
        }
      }
      // success/failure: o worker entrega o clip e o render.yml já avisa a falha.
    } catch (e) {
      if (Date.now() < deadline) { setTimeout(tick, 30000); return; }
      pushAlert(`Watchdog gave up: ${e.message}`);
    }
  };
  setTimeout(tick, 15000 + stagger);
}

async function uploadToOwnAPI(buffer) {
  const res = await fetch(`http://localhost:${PORT}/api/replays`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: Buffer.from(buffer),
  });
  const j = await res.json();
  if (!res.ok || !j.code) throw new Error(`Upload failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.code;
}

const state = { disabled: false, alerts: [], lastDispatch: null };

function pushAlert(msg) {
  const entry = { t: new Date(), msg: String(msg).slice(0, 300) };
  state.alerts.push(entry);
  if (state.alerts.length > 15) state.alerts.shift();
  console.log(`[Alert] ${entry.msg}`);
}

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${Math.floor(sec % 60)}s`;
}

// helper para a API REST do GitHub (listar/cancelar runs — a "fila")
async function ghApi(pathname, opts = {}) {
  if (!GH_TOKEN || !GH_REPO) throw new Error("GH_TOKEN/GH_REPO not configured in the service (Render env).");
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}${pathname}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "vanis-service",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  return res;
}

function activeRunsFilter(r) { return r.status === "queued" || r.status === "in_progress"; }

async function cmdQueue(message) {
  try {
    const res = await ghApi("/actions/runs?per_page=30");
    if (!res.ok) throw new Error(`GitHub responded ${res.status} (GH_TOKEN needs **Actions: Read and write**)`);
    const j = await res.json();
    const active = (j.workflow_runs || []).filter(activeRunsFilter);
    if (!active.length) {
      await replyTemp(message.channel, "Queue is empty — no queued or running renders. ✅", 15000);
      return;
    }
    const lines = active.map(r =>
      `• \`#${r.run_number}\` **${r.status}** — started <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R> — id \`${r.id}\``
    );
    await replyTemp(message.channel,
      `**Active renders (${active.length}):**\n${lines.join("\n")}\n\nCancel: \`!cancel all\` or \`!cancel <id>\``,
      30000);
  } catch (e) {
    await replyTemp(message.channel, `❌ Couldn't list the queue: ${e.message}`, 15000);
  }
}

async function cmdCancel(message) {
  const arg = (message.content.split(/\s+/)[1] || "").toLowerCase();
  try {
    const res = await ghApi("/actions/runs?per_page=50");
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const j = await res.json();
    let active = (j.workflow_runs || []).filter(activeRunsFilter);
    if (arg && arg !== "all") {
      const id = arg.replace(/\D/g, "");
      active = active.filter(r => String(r.id) === id);
      if (!active.length) {
        await replyTemp(message.channel, `No active run with id \`${arg}\`. Use \`!queue\` to list ids.`, 15000);
        return;
      }
    }
    if (!active.length) {
      await replyTemp(message.channel, "Queue is already empty. ✅", 15000);
      return;
    }
    let ok = 0;
    for (const r of active) {
      try {
        const c = await ghApi(`/actions/runs/${r.id}/cancel`, { method: "POST" });
        if (c.ok) ok++;
      } catch {}
    }
    if (ok) pushAlert(`Cancelled ${ok}/${active.length} render run(s) via !cancel`);
    await replyTemp(message.channel, `🛑 Cancelled **${ok}** of **${active.length}** active run(s).`, 20000);
  } catch (e) {
    await replyTemp(message.channel, `❌ Couldn't cancel: ${e.message}`, 15000);
  }
}

async function cmdDebug(message) {
  const cl = message.client;
  const lines = [];
  lines.push("**🤖 Bot (Render)**");
  lines.push(`• Logged in: ${cl && cl.user ? `✅ ${cl.user.tag}` : "❌ not logged in"}`);
  lines.push(`• Uptime: ${fmtUptime(process.uptime())} · WS ping: ${cl && cl.ws ? cl.ws.ping : "?"}ms`);
  lines.push(`• State: ${state.disabled ? "⛔ disabled (`!enable`)" : "✅ enabled"} · Channel filter: ${CHANNELS.length ? `${CHANNELS.length} channel(s)` : "all"}`);

  const db = loadDB();
  let disk = 0;
  try { for (const f of fs.readdirSync(FILES_DIR)) disk += fs.statSync(path.join(FILES_DIR, f)).size; } catch {}
  lines.push("**🗄️ Replay API (Render)**");
  lines.push(`• ✅ Online · **${Object.keys(db).length}** replay(s) stored · ${(disk / 1048576).toFixed(1)}MB on disk`);
  lines.push(`• ⚠️ Files are ephemeral — a Render restart/sleep wipes them ("No replay found")`);

  const ld = state.lastDispatch;
  lines.push("**🐙 GitHub Actions**");
  lines.push(`• Repo: \`${GH_REPO || "❌ missing"}\` · Workflow: \`${GH_WORKFLOW}\` · Ref: \`${GH_REF}\` · Token: ${GH_TOKEN ? "✅ set" : "❌ missing"}`);
  lines.push(`• Last dispatch: ${ld ? (ld.ok ? `✅ \`${ld.code}\` at ${ld.at}` : `❌ \`${ld.code}\`: ${ld.error}`) : "none yet"}`);
  try {
    const res = await ghApi("/actions/runs?per_page=30");
    if (res.ok) {
      const j = await res.json();
      const active = (j.workflow_runs || []).filter(activeRunsFilter);
      lines.push(active.length
        ? `• ⏳ Active runs: **${active.length}** — ${active.map(r => `\`#${r.run_number} ${r.status}\``).join(", ")}`
        : "• Active runs: none");
    } else {
      lines.push(`• Active runs: GitHub responded ${res.status} (GH_TOKEN needs **Actions: Read and write**)`);
    }
  } catch (e) {
    lines.push(`• Active runs: ${e.message}`);
  }

  lines.push("**⚠️ Alerts (last 15)**");
  lines.push(state.alerts.length
    ? state.alerts.slice().reverse().map(a => `• \`${a.t.toISOString().slice(11, 19)}Z\` ${a.msg}`).join("\n")
    : "• None ✅");

  const embed = new EmbedBuilder()
    .setTitle("🔧 Vanis service — debug status")
    .setColor(0x00BFFF)
    .setDescription(lines.join("\n").slice(0, 4000))
    .setTimestamp();
  await message.channel.send({ embeds: [embed] }).catch(() => {});
}

if (DISCORD_TOKEN) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.on("ready", () => {
    console.log(`[Bot] ${client.user.username} pronto a receber !render`);
    try { client.user.setActivity("Vanis Clips", { type: ActivityType.Playing }); } catch {}
  });

  client.on("error", (e) => { console.error("[Bot error]", e); pushAlert(`Discord client error: ${e.message}`); });

  client.on("messageCreate", async (message) => {
    try {
      if (message.author.bot || message.system) return;

      // comandos de admin (dono)
      if (OWNER_ID && message.author.id === OWNER_ID) {
        if (/^!disable/i.test(message.content)) {
          state.disabled = true;
          await replyTemp(message.channel, "Bot **disabled**.");
          return;
        }
        if (/^!enable/i.test(message.content)) {
          state.disabled = false;
          await replyTemp(message.channel, "Bot **enabled**.");
          return;
        }
        if (/^!queue\b/i.test(message.content)) { await cmdQueue(message); return; }
        if (/^!cancel\b/i.test(message.content)) { await cmdCancel(message); return; }
        if (/^!debug\b/i.test(message.content)) { await cmdDebug(message); return; }
      }
      if (state.disabled) return;

      const content = (message.cleanContent || message.content || "").trim();

      if (content === "!help") {
        await message.channel.send(
          "Render options: ```\n--skin [all|tag|me|none]\n--name [all|hideme|none]\n--mass [long|short|none]\n--res [1080|720|480|360|240]\n--fps [60|30|25]\n--quality [high|medium|low]```" +
          "\nUsage: `!render CODE` or attach a **.vanis** file (≤5MB) in this channel." +
          "\n💡 On the free tier, prefer `--res 720 --fps 30` for long clips." +
          "\n\n**Owner:** `!debug` (status + alerts) · `!queue` (active renders) · `!cancel all|<id>` · `!disable` / `!enable`"
        );
        return;
      }

      if (CHANNELS.length && !CHANNELS.includes(message.channel.id)) return;

      const m = content.match(/^[/!]render\s+([A-Za-z0-9_-]{6,64})(?:\s|$)/);
      const vanisAttachments = [...message.attachments.values()]
        .filter(a => (a.name || "").toLowerCase().endsWith(".vanis"));

      if (!m && vanisAttachments.length === 0) return;

      await message.channel.sendTyping().catch(() => {});

      // junta datasets: código do comando + anexos (via própria API)
      const datasets = [];
      if (m) datasets.push({ code: m[1], filename: `${m[1]}.vanis` });

      for (const att of vanisAttachments) {
        const size = att.size || 0;
        if (size > 5 * 1024 * 1024) {
          pushAlert(`Attachment rejected: ${att.name} is ${(size / 1048576).toFixed(1)}MB (>5MB)`);
          await replyTemp(message.channel, "Your replay file is too big!\nA normal replay file should be less than **5MB**");
          return;
        }
        const res = await fetch(att.url);
        if (!res.ok) {
          pushAlert(`Attachment download failed (${att.name}): HTTP ${res.status}`);
          await replyTemp(message.channel, `Failed to fetch the attachment (status ${res.status})`);
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        if (!buf.toString("utf8", 0, 7).startsWith("REPLAY|")) {
          pushAlert(`Invalid replay format: ${att.name}`);
          await replyTemp(message.channel, "Invalid replay format");
          return;
        }
        try {
          const code = await uploadToOwnAPI(buf);
          datasets.push({ code, filename: att.name });
        } catch (e) {
          console.error("[Bot] upload próprio falhou:", e.message);
          pushAlert(`Failed to save replay ${att.name}: ${e.message}`);
          await replyTemp(message.channel, `Failed to save the replay: ${e.message}`);
          return;
        }
      }

      const parsed = parseConfig(content);
      if (parsed.error) {
        await replyTemp(message.channel, parsed.error);
        return;
      }

      for (const ds of datasets) {
        try {
          await dispatchWorkflow({
            code: ds.code,
            config: JSON.stringify(parsed.config),
            user_id: message.author.id,
            filename: ds.filename.replace(/\.vanis$/i, ""),
          });
          state.lastDispatch = { ok: true, code: ds.code, at: new Date().toISOString().slice(0, 19) + "Z" };
          const embed = new EmbedBuilder()
            .setTitle(`${ds.filename.replace(/\.vanis$/i, "")}.mp4 (queued)`)
            .setColor(0x00FFFF)
            .setDescription(`🎬 Render request from <@${message.author.id}> is in the queue.\nThe video will appear here when it's ready (it can take **several minutes**).`)
            .setTimestamp();
          await message.channel.send({ embeds: [embed] });
          // v2.1: vigiar este run — se o GitHub morrer no arranque, avisar/retry
          watchRun(message.channel, {
            code: ds.code,
            config: JSON.stringify(parsed.config),
            user_id: message.author.id,
            filename: ds.filename.replace(/\.vanis$/i, ""),
          }, 1, []);
        } catch (e) {
          console.error("[Bot] dispatch falhou:", e.message);
          state.lastDispatch = { ok: false, code: ds.code, at: new Date().toISOString().slice(0, 19) + "Z", error: e.message };
          pushAlert(`Dispatch failed for \`${ds.code}\`: ${e.message}`);
          await replyTemp(message.channel, `❌ Couldn't queue the render: ${e.message}`);
        }
      }
    } catch (e) {
      console.error("[Bot] messageCreate error:", e);
    }
  });

  client.login(DISCORD_TOKEN).catch((e) => {
    console.error("[Bot] login falhou (a API continua de pé):", e.message);
    pushAlert(`Discord login failed: ${e.message}`);
  });
} else {
  console.log("[Bot] DISCORD_TOKEN não definido — só a API está ativa.");
}
