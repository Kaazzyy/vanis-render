// Vanis Service v2 — API de replays + mini-bot de escuta num só processo.
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "10000", 10);
const DATA_DIR = path.join(__dirname, "data");
const FILES_DIR = path.join(DATA_DIR, "files");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({}));

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

app.get("/api/replays/:code", (req, res) => {
  const code = req.params.code;
  const db = loadDB();
  if (!db[code]) return res.status(404).send("invalid code");
  const filePath = path.join(FILES_DIR, code + ".vanis");
  if (!fs.existsSync(filePath)) return res.status(404).send("file not found");
  res.setHeader("Content-Type", "text/plain");
  res.sendFile(filePath);
});

app.post("/api/replays", (req, res) => {
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
  const db = loadDB();
  db[code] = { createdAt: new Date().toISOString(), size: buf.length };
  saveDB(db);
  fs.writeFileSync(path.join(FILES_DIR, code + ".vanis"), buf);
  console.log(`Saved replay ${code} (${buf.length} bytes)`);
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
    setTimeout(() => { try { m.delete(); } catch {} }, ms);
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
    client.user.setActivity("Vanis Clips", { type: ActivityType.Playing });
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
