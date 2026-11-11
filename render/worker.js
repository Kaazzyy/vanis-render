// Vanis Render Worker v2 — corre DENTRO do Electron, no GitHub Actions.
// Recebe um pedido (code + config), vai buscar o replay à API, renderiza com o
// renderer original (src/App.js + browser/) e entrega o mp4 no Discord via webhook.
// Não faz login no Discord (o mini-bot no Render é que está online 24/7).

const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("fs");
const path = require("path");
const uid = require("uid-safe");

// v2.2: se o src/App.js commitado estiver corrompido (upload truncado no
// GitHub, ficheiro trocado), este require MORRIA AQUI EM SILÉNCIO — fora do
// try principal — e o Discord ficava eternamente no "(queued)" sem nenhuma
// mensagem de erro. Agora o erro é guardado e posto no Discord mais abaixo.
let RendererApp = null;
let APP_LOAD_ERROR = null;
try { RendererApp = require("./src/App"); }
catch (e) { APP_LOAD_ERROR = e; }

const API_BASE = (process.env.API_BASE || "").replace(/\/+$/, "");
const WEBHOOK = (process.env.WEBHOOK_URL || "").replace(/\/+$/, "");
const INPUT_CODE = process.env.INPUT_CODE || "";
const INPUT_USER = process.env.INPUT_USER_ID || "";
const INPUT_FILENAME = (process.env.INPUT_FILENAME || INPUT_CODE || "clip").replace(/[^\w.-]/g, "_");
let INPUT_CONFIG = {};
try { INPUT_CONFIG = JSON.parse(process.env.INPUT_CONFIG || "{}"); }
catch (e) { console.error("[Worker] INPUT_CONFIG invalido, a usar {}:", e.message); }

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
    return res.ok;
  } catch (e) { log("PATCH falhou:", e.message); return false; }
}
function barEmbed(pct, title, stats) {
  const p = Math.max(0, Math.min(1, pct));
  const filled = Math.round(p * 19);
  const bar = "`[" + "=".repeat(filled) + ">" + " ".repeat(19 - filled) + "]`";
  return new (require("discord.js").EmbedBuilder)()
    .setTitle(title || `${INPUT_FILENAME}.mp4 (rendering)`)
    .setColor(0x00FFFF)
    .setDescription(`${bar} **${Math.round(p * 100)}%**` + (stats ? `\n\n\`${stats}\`` : ""))
    .setTimestamp();
}

// ---------- diagnóstico ----------
// O Actions só mostra console.log — por isso o worker regista ele próprio o estado do
// render (progresso real, frames recebidos, backlog do ffmpeg, RAM). Sem isto, um render
// que "congela" é impossível de diagnosticar pelos logs.
let renderer = null;
let TASK_HASH = null;
const STATS = { buffers: 0, dropped: 0, bytes: 0, lastPct: 0, startedAt: Date.now(),
  lastBufferAt: Date.now(), lastProgressAt: Date.now(), stdinEnded: false };

function renderStats() {
  let backlog = 0;
  try {
    const tab = renderer && TASK_HASH ? renderer.tabs[TASK_HASH] : null;
    if (tab && tab.shell && tab.shell.stdin) backlog = tab.shell.stdin.writableLength;
  } catch {}
  return [
    `progress ${STATS.lastPct}%`,
    `${STATS.buffers} frames received (${(STATS.bytes / 1048576).toFixed(1)}MB)`,
    STATS.dropped ? `${STATS.dropped} DROPPED (ffmpeg stdin closed)` : null,
    `ffmpeg stdin backlog ${(backlog / 1048576).toFixed(1)}MB`,
    `RAM ${(process.memoryUsage().rss / 1048576).toFixed(0)}MB`,
    `elapsed ${Math.round((Date.now() - STATS.startedAt) / 1000)}s`,
  ].filter(Boolean).join(" | ");
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

// v2.5: se o worker crashar FORA do try principal (ex.: erro num callback do IPC,
// falha do Electron), o MOTIVO chega ao Discord — antes o job falhava calado e
// ficávamos só com a mensagem genérica do render.yml ("worker crash").
function guardCrash(kind, e) {
  console.error(`[Worker] ${kind}:`, e);
  if (WEBHOOK) {
    const detail = String((e && (e.stack || e.message)) || e).slice(0, 1500);
    whPost({ content: `❌ Worker crash (${kind}): \`${detail}\`` }).catch(() => {});
  }
  setTimeout(() => app.exit(1), 2000);
}
process.on("uncaughtException", (e) => guardCrash("uncaughtException", e));
process.on("unhandledRejection", (e) => guardCrash("unhandledRejection", e));

// ---------- main ----------
(async () => {
  let exitCode = 1;
  let progressMessageId = null;

  try {
    // v2.2: se o require("./src/App") falhou lá em cima, é AQUI que o erro
    // chega ao Discord — antes ficávamos só com a mensagem "(queued)".
    if (APP_LOAD_ERROR)
      throw new Error("render/src/App.js failed to load: " + APP_LOAD_ERROR.message +
        "\nThe file is probably corrupted/truncated from the GitHub upload — re-upload it whole.");
    if (!API_BASE || !WEBHOOK || !INPUT_CODE) {
      throw new Error("Missing env: API_BASE, WEBHOOK_URL and INPUT_CODE are required.");
    }

    log("A buscar replay", INPUT_CODE, "de", API_BASE);
    const res = await fetch(`${API_BASE}/api/replays/${encodeURIComponent(INPUT_CODE)}`);
    if (res.status === 404) throw new Error(`No replay found for code **${INPUT_CODE}** (the service may have restarted and lost files).`);
    if (!res.ok) throw new Error(`API respondeu HTTP ${res.status}`);
    const data = await res.text();
    log(`Replay OK (${data.length} bytes)`);

    renderer = new RendererApp();
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
      STATS.lastBufferAt = Date.now();
      const shell = tab.shell;
      if (!shell) return;
      const buffer = base64 && Buffer.from(base64, "base64");
      if (shell.stdin.writable) {
        if (buffer) {
          STATS.buffers++;
          STATS.bytes += buffer.length;
          shell.stdin.write(buffer);
        } else {
          log("A fechar stdin do ffmpeg");
          STATS.stdinEnded = true;
          shell.stdin.end();
          try { tab.window && tab.window.destroy(); } catch {}
          delete renderer.tabs[hash];
          // v2.8: avisa logo no Discord que o jogo acabou e o ffmpeg esta a finalizar
          if (progressMessageId)
            whPatch(progressMessageId, { embeds: [barEmbed(STATS.lastPct / 100,
              `${INPUT_FILENAME}.mp4 (finalizing)`, renderStats())] }).catch(() => {});
        }
      } else if (buffer) {
        STATS.dropped++; // ffmpeg morreu — sem isto o render continuava a "andar" às cegas
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

    TASK_HASH = task.hash;
    fs.writeFileSync(path.join(QUEUE_PATH, `${task.hash}.vanis`), data);

    const startTime = Date.now();
    let shownPct = 0;
    let lastPatchAt = 0;
    let lastLogAt = 0;
    const done = new Promise((resolve, reject) => {
      renderer.addTask(task, {
        onBegin: async () => { log("Render a começar"); },
        onProgress: async (p) => {
          STATS.lastProgressAt = Date.now();
          const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
          STATS.lastPct = pct;
          const now = Date.now();
          if (now - lastLogAt >= 15000) {
            lastLogAt = now;
            log(`progress: ${renderStats()}`);
          }
          // atualiza a barra a cada +5% ou a cada 45 s — o padrão antigo (+10% só quando
          // crescia) fazia a barra parecer "presa" (ex.: nos 88%) durante o encode final
          if (progressMessageId && pct > shownPct && (pct - shownPct >= 5 || now - lastPatchAt >= 45000)) {
            shownPct = pct;
            lastPatchAt = now;
            whPatch(progressMessageId, { embeds: [barEmbed(pct / 100)] });
          }
        },
        onError: async (err) => reject(new Error(String(err))),
        onFinish: async () => resolve(),
      });
    });
    // se o deadline abortar, o `done` rejeita depois — sem isto o Node podia crashar
    // antes de a mensagem de erro chegar ao Discord (unhandled rejection)
    done.catch(() => {});

    renderer.exec();

    // v2.8: heartbeat — além do log, atualiza o Discord quando a barra está parada
    // (drain final do encode) e aborta deadlocks reais: 3 min sem frames do jogo
    // E sem progresso do ffmpeg = nada avança; o render seria eterno sem disto.
    let _hbLastPct = -1;
    let _hbLastPatch = 0;
    const heartbeat = setInterval(() => {
      const stats = renderStats();
      log(`heartbeat: ${stats}`);
      const now = Date.now();
      const tabAlive = renderer && TASK_HASH && renderer.tabs[TASK_HASH];
      if (tabAlive && now - STATS.lastBufferAt > 180000 && now - STATS.lastProgressAt > 180000) {
        clearInterval(heartbeat);
        const msg = `Render stopped: no new frames from the game AND no ffmpeg progress for **3 minutes** (last progress **${STATS.lastPct}%**) — a pipeline estava bloqueada.`;
        try { renderer.abortTask(TASK_HASH, msg); } catch {}
        return;
      }
      if (progressMessageId && now - _hbLastPatch >= 60000 && (STATS.stdinEnded || STATS.lastPct === _hbLastPct)) {
        _hbLastPatch = now;
        _hbLastPct = STATS.lastPct;
        const title = STATS.stdinEnded
          ? `${INPUT_FILENAME}.mp4 (finalizing — encoding the backlog)`
          : `${INPUT_FILENAME}.mp4 (rendering)`;
        whPatch(progressMessageId, { embeds: [barEmbed(STATS.lastPct / 100, title, stats)] });
      } else if (STATS.lastPct !== _hbLastPct) {
        _hbLastPct = STATS.lastPct;
      }
    }, 30000);

    // limite duro: se o render passar disto, aborta E AVISA no Discord — sem isto o
    // GitHub matava o job no timeout (2 h) e nenhuma mensagem de erro chegava ao canal
    // v2.9: 40 min de render + setup do job (apt/npm, ~5 min) = 45 min = timeout do
    // job — o GitHub chegava a matar o worker ANTES deste limite disparar e a
    // mensagem de erro nunca chegava. 35 min garante que o erro detalhado do
    // worker (com o ultimo progresso e conselhos) ganha a corrida ao corte de 45.
    const HARD_LIMIT_MIN = 35;
    let deadlineTimer;
    const deadline = new Promise((_, rej) => {
      deadlineTimer = setTimeout(() => {
        const msg = `Render stopped: it exceeded the **${HARD_LIMIT_MIN} min** hard limit (last progress **${STATS.lastPct}%**).\nTry a shorter clip or \`--res 720 --fps 30 --quality low\`.`;
        try { renderer.abortTask(TASK_HASH, msg); } catch {}
        rej(new Error(msg));
      }, HARD_LIMIT_MIN * 60 * 1000);
    });

    try {
      await Promise.race([done, deadline]);
    } finally {
      clearTimeout(deadlineTimer);
      clearInterval(heartbeat);
    }

    const outPath = path.join(renderer.OUTPUT_PATH, `${task.hash}.mp4`);
    if (!fs.existsSync(outPath)) throw new Error("ffmpeg finished but the mp4 file doesn't exist");
    const seconds = Math.round((Date.now() - startTime) / 1000);
    log("A enviar vídeo:", outPath, `${(fs.statSync(outPath).size / 1048576).toFixed(1)}MB`);

    await sendVideo(outPath, seconds);
    // estado final da barra — e se o PATCH falhar (a causa das barras "congeladas"
    // nos 87/88/93%), envia uma mensagem nova a confirmar, para o canal nunca ficar
    // com uma barra parada sem explicação
    const patched = progressMessageId
      ? await whPatch(progressMessageId, { embeds: [barEmbed(1, `${INPUT_FILENAME}.mp4 (done)`)] })
      : false;
    if (!patched) {
      await whPost({ content: `✅ **${INPUT_FILENAME}.mp4** finished — the video is in the message above. (The progress bar message couldn't be updated.)` }).catch(() => {});
    }
    exitCode = 0;
  } catch (e) {
    console.error("[Worker] FALHOU:", e);
    try {
      if (WEBHOOK) {
        const payload = {
          embeds: [new (require("discord.js").EmbedBuilder)()
            .setTitle(`${INPUT_FILENAME}.mp4 (error)`)
            .setColor(0xFF0000)
            .setDescription((String(e.message || e) + "\n\n" + renderStats()).slice(0, 3900))
            .setTimestamp()],
        };
        const patchedErr = progressMessageId ? await whPatch(progressMessageId, payload) : false;
        if (!patchedErr) await whPost(payload);
      }
    } catch {}
  } finally {
    // mata processos pendentes e sai com código limpo
    setTimeout(() => app.exit(exitCode), 1500);
  }
})();
