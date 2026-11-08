// Vanis Render Worker v2 — corre DENTRO do Electron, no GitHub Actions.
// Recebe um pedido (code + config), vai buscar o replay à API, renderiza com o
// renderer original (src/App.js + browser/) e entrega o mp4 no Discord via webhook.
// Não faz login no Discord (o mini-bot no Render é que está online 24/7).

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const uid = require("uid-safe");

const RendererApp = require("./src/App");

const API_BASE = (process.env.API_BASE || "").replace(/\/+$/, "");
const WEBHOOK = (process.env.WEBHOOK_URL || "").replace(/\/+$/, "");
const INPUT_CODE = process.env.INPUT_CODE || "";
const INPUT_USER = process.env.INPUT_USER_ID || "";
const INPUT_FILENAME = (process.env.INPUT_FILENAME || INPUT_CODE || "clip").replace(/[^\w.-]/g, "_");
const INPUT_CONFIG = JSON.parse(process.env.INPUT_CONFIG || "{}");

const OUTPUT_PATH = path.resolve(__dirname, "output");
const QUEUE_PATH = path.resolve(__dirname, "queue");

function log(...a) { console.log("[Worker]", ...a); }

// ---------- helpers de webhook ----------
async function whPost(payload) {
  const res = await fetch(`${WEBHOOK}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`webhook POST ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
async function whPatch(id, payload) {
  try {
    const res = await fetch(`${WEBHOOK}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) log(`webhook PATCH ${res.status}`);
  } catch (e) { log("PATCH falhou:", e.message); }
}
function barEmbed(pct, title) {
  const p = Math.max(0, Math.min(1, pct));
  const filled = Math.round(p * 19);
  const bar = "`[" + "=".repeat(filled) + ">" + " ".repeat(19 - filled) + "]`";
  return new (require("discord.js").EmbedBuilder)()
    .setTitle(title || `${INPUT_FILENAME}.mp4 (rendering)`)
    .setColor(0x00FFFF)
    .setDescription(`${bar} **${Math.round(p * 100)}%**`)
    .setTimestamp();
}

async function sendVideo(filePath, seconds) {
  const MAX = 7.8 * 1024 * 1024;
  let sendPath = filePath;
  let size = fs.statSync(sendPath).size;

  // se o mp4 for grande demais para o webhook, re-comprime uma vez
  if (size > MAX) {
    log(`mp4 tem ${(size / 1048576).toFixed(1)}MB — a re-comprimir (CRF 33)`);
    const heavy = path.join(OUTPUT_PATH, INPUT_FILENAME + "_small.mp4");
    const { spawnSync } = require("child_process");
    const r = spawnSync("ffmpeg", [
      "-y", "-i", filePath, "-c:v", "libx264", "-crf", "33",
      "-preset", "fast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", heavy,
    ], { stdio: "ignore" });
    if (r.status === 0 && fs.existsSync(heavy)) sendPath = heavy;
    size = fs.statSync(sendPath).size;
  }

  if (size > 8 * 1024 * 1024) {
    await whPost({
      content: `${INPUT_USER ? `<@${INPUT_USER}> ` : ""}⚠️ The final video is **${(size / 1048576).toFixed(1)}MB** (webhook limit is ~8MB) and couldn't be sent. Try: \`--res 720 --fps 30\` or \`--quality low\`.`,
    });
    return;
  }

  const fd = new FormData();
  fd.append("payload_json", JSON.stringify({
    content: `${INPUT_USER ? `<@${INPUT_USER}> ` : ""}Done rendering **${INPUT_FILENAME}.mp4** (time elapsed: **${seconds}** seconds)`,
  }));
  fd.append("files[0]", new Blob([fs.readFileSync(sendPath)], { type: "video/mp4" }), `${INPUT_FILENAME}.mp4`);
  const res = await fetch(`${WEBHOOK}?wait=true`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(`video upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------- main ----------
(async () => {
  let exitCode = 1;
  let progressMessageId = null;
  let lastPct = -1;

  try {
    if (!API_BASE || !WEBHOOK || !INPUT_CODE) {
      throw new Error("Missing env: API_BASE, WEBHOOK_URL and INPUT_CODE are required.");
    }

    log("A buscar replay", INPUT_CODE, "de", API_BASE);
    const res = await fetch(`${API_BASE}/api/replays/${encodeURIComponent(INPUT_CODE)}`);
    if (res.status === 404) throw new Error(`No replay found for code **${INPUT_CODE}** (the service may have restarted and lost files).`);
    if (!res.ok) throw new Error(`API respondeu HTTP ${res.status}`);
    const data = await res.text();
    log(`Replay OK (${data.length} bytes)`);

    const renderer = new RendererApp();
    // v2.1: app.on("ready") can silently hang if ready already fired (race on fast runners)
    // — whenReady() always resolves. This was the cause of renders hanging until the job timeout.
    log("Waiting for Electron to be ready…");
    await app.whenReady();
    log("Electron ready");

    // mesmos handlers IPC do App.init (sem login de bot!)
    ipcMain.on("render-error", (_, hash, msg) => renderer.abortTask(hash, msg));
    ipcMain.on("buffer", (_, hash, base64) => {
      const tab = renderer.tabs[hash];
      if (!tab) return;
      tab.lastBuffer = Date.now();
      const shell = tab.shell;
      if (!shell) return;
      const buffer = base64 && Buffer.from(base64, "base64");
      if (shell.stdin.writable) {
        if (buffer) shell.stdin.write(buffer);
        else {
          log("A fechar stdin do ffmpeg");
          shell.stdin.end();
          try { tab.window && tab.window.destroy(); } catch {}
          delete renderer.tabs[hash];
        }
      }
    });

    // mensagem inicial de progresso
    log("Posting initial progress message to the webhook…");
    const msg = await whPost({ embeds: [barEmbed(0)] });
    progressMessageId = msg && msg.id;

    const task = {
      user: INPUT_USER || "worker",
      channel: "webhook",
      hash: await uid(16),
      filename: `${INPUT_FILENAME}.mp4`,
      config: INPUT_CONFIG,
    };

    fs.writeFileSync(path.join(QUEUE_PATH, `${task.hash}.vanis`), data);

    const startTime = Date.now();
    const done = new Promise((resolve, reject) => {
      renderer.addTask(task, {
        onBegin: async () => { log("Render a começar"); },
        onProgress: async (p) => {
          const pct = Math.round(p * 100);
          if (pct >= lastPct + 10 || (pct === 100 && lastPct !== 100)) {
            lastPct = pct;
            if (progressMessageId) whPatch(progressMessageId, { embeds: [barEmbed(p)] });
          }
        },
        onError: async (err) => reject(new Error(String(err))),
        onFinish: async () => resolve(),
      });
    });

    renderer.exec();
    await done;

    const outPath = path.join(renderer.OUTPUT_PATH, `${task.hash}.mp4`);
    if (!fs.existsSync(outPath)) throw new Error("ffmpeg finished but the mp4 file doesn't exist");
    const seconds = Math.round((Date.now() - startTime) / 1000);
    log("A enviar vídeo:", outPath, `${(fs.statSync(outPath).size / 1048576).toFixed(1)}MB`);

    await sendVideo(outPath, seconds);
    if (progressMessageId) whPatch(progressMessageId, { embeds: [barEmbed(1)] });
    exitCode = 0;
  } catch (e) {
    console.error("[Worker] FALHOU:", e);
    try {
      if (WEBHOOK) {
        const payload = {
          embeds: [new (require("discord.js").EmbedBuilder)()
            .setTitle(`${INPUT_FILENAME}.mp4 (error)`)
            .setColor(0xFF0000)
            .setDescription(String(e.message || e).slice(0, 3900))
            .setTimestamp()],
        };
        if (progressMessageId) await whPatch(progressMessageId, payload);
        else await whPost(payload);
      }
    } catch {}
  } finally {
    // mata processos pendentes e sai com código limpo
    setTimeout(() => app.exit(exitCode), 1500);
  }
})();
