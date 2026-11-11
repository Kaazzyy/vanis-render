const { app, BrowserWindow, ipcMain } = require("electron");
// v2: ffmpeg do PATH do sistema no Actions (sem download de binario do npm)
let ffmpegPath = "ffmpeg";
try { ffmpegPath = require("@ffmpeg-installer/ffmpeg").path; } catch {}
const { spawn }  = require("child_process");

// v27-hf: no ultimo frame o ipc "buffer" faz window.destroy(). Com uma unica
// janela, o Electron dispara "window-all-closed" e por omissao faz app.quit():
// o processo morria com codigo 0 antes do ffmpeg acabar de codificar e antes do
// onFinish enviar o mp4 — a barra congelava (~97%) e o video nunca aparecia.
app.on("window-all-closed", () => {});

const logger = require("./Logger");
const Bot = require("./Bot");
const Pool = require("./Pool");

let configJson = {};
try { configJson = require("../config.json"); } catch {}
// config.json e opcional — no Hugging Face usamos Secrets (env); valores por omissao:
let concurrency = configJson.concurrency ?? 1;
let dump = configJson.dump ?? 0;

const Path = require("path");
const OUTPUT_PATH = Path.resolve(__dirname, "..", "output");
const QUEUE_PATH  = Path.resolve(__dirname, "..", "queue");
const DUMP_PATH   = Path.resolve(__dirname, "..", "dump");

const fs = require("fs");

if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH);
if (!fs.existsSync(QUEUE_PATH))  fs.mkdirSync(QUEUE_PATH);
if (!fs.existsSync(DUMP_PATH))   fs.mkdirSync(DUMP_PATH);

app.commandLine.appendSwitch("ignore-gpu-blacklist");
// v2.6 FIX: "disable-gpu" REMOVIDO — sem GPU o WebGL nunca arranca e o render cai
// para Canvas 2D: sem imagem de fundo, sem borda do mapa, cor escura #121212.
app.commandLine.appendSwitch("use-angle", "swiftshader");
app.commandLine.appendSwitch("enable-unsafe-swiftshader");
// v2.6 FIX: deixa o WebGL usar o bg.png e os assets locais (file://) sem o canvas
// ficar "tainted" — sem isto o toDataURL dos frames falhava com SecurityError.
app.commandLine.appendSwitch("allow-file-access-from-files");
// v27-hf: no Linux (Xvfb) a janela nunca e mostrada — sem isto o Chromium engasga os
// requestAnimationFrame do renderer e os frames nunca chegam ao ffmpeg.
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");

// v2.11: Roblox skin assets ("rbxassetid://<id>") exported by the Roblox client.
// The render page cannot load them (unknown scheme; and rbxcdn sends no CORS
// headers for its crossOrigin=anonymous <img>). Node HERE has no CORS: resolve
// the id to a PNG via thumbnails.roblox.com and hand the renderer a data URI.
// The thumbnails API only allows ~1 request/second per IP (x-ratelimit
// "1,1;w=1") and a clip creates several players at once, so the lookups run
// through a SERIALIZED queue with a minimum gap and are retried on 429/5xx.
// Successes are cached for the whole session; failures only for 60 s, so a
// later clip may retry an asset that transiently failed.
const SKIN_FETCH_TIMEOUT = 8000;
const SKIN_MIN_GAP = 1100;        // ms between thumbnails API calls (429 guard)
const SKIN_RETRIES = 3;           // extra attempts on 429/5xx/network errors
const SKIN_FAIL_TTL = 60000;      // negative-cache lifetime (ms)
const _skinCache = new Map();     // assetId -> { uri: string|null, at: ms }
let _skinQueue = Promise.resolve();   // serializes the rate-limited API calls
let _lastSkinApiAt = 0;           // when the last thumbnails API call started

// v2.11d: pasta local de skins (browser/skins/<id>.png). O render procura
// AQUI primeiro — zero rede, zero 429. Se nao existir, vai a API como
// antes e GUARDA o PNG nesta pasta para os proximos renders serem locais.
const SKIN_DIR = Path.resolve(__dirname, "..", "browser", "skins");

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// v2.11d: le a skin do disco (browser/skins/<id>.png) sem tocar na rede.
function _localSkinUri(assetId) {
    try {
        const f = Path.join(SKIN_DIR, assetId + ".png");
        if (fs.existsSync(f)) {
            const buf = fs.readFileSync(f);
            if (buf.length > 0 && buf.length < 3 * 1024 * 1024) {
                console.log("[vanis-skin] asset " + assetId + " -> carregada do ficheiro local (browser/skins/" + assetId + ".png)");
                return "data:image/png;base64," + buf.toString("base64");
            }
        }
    } catch (_r) {}
    return null;
}

async function fetchRobloxSkin(assetId) {
    if (!/^\d+$/.test(assetId)) return null;
    // v2.11d: o ficheiro local ganha sempre (zero rede, zero 429 da API)
    const _loc = _localSkinUri(assetId);
    if (_loc) { _skinCache.set(assetId, { uri: _loc, at: Date.now() }); return _loc; }
    const now = Date.now();
    const hit = _skinCache.get(assetId);
    if (hit && (hit.uri || now - hit.at < SKIN_FAIL_TTL)) return hit.uri;
    // queue the job so concurrent players never race the 1 req/s API budget
    const job = _skinQueue.then(() => _resolveSkin(assetId));
    _skinQueue = job.catch(() => {});
    const uri = await job;
    _skinCache.set(assetId, { uri: uri, at: Date.now() });
    return uri;
}

async function _resolveSkin(assetId) {
    let fetchFn = global.fetch;
    if (!fetchFn) { try { fetchFn = require("node-fetch"); } catch (e) { fetchFn = null; } }
    if (!fetchFn) { console.error("[vanis-skin] no fetch implementation available"); return null; }
    let imageUrl = null;
    // thumbnails.roblox.com lookup — paced + retried (429 = rate limited)
    for (let attempt = 0; attempt <= SKIN_RETRIES && !imageUrl; attempt++) {
        const wait = _lastSkinApiAt + SKIN_MIN_GAP - Date.now();
        if (wait > 0) await _sleep(wait);
        _lastSkinApiAt = Date.now();
        try {
            const res = await fetchFn(
                "https://thumbnails.roblox.com/v1/assets?assetIds=" + assetId +
                "&size=420x420&format=Png&isCircular=false",
                { timeout: SKIN_FETCH_TIMEOUT });
            if (res.status === 429 || res.status >= 500) throw new Error("API HTTP " + res.status);
            if (!res.ok) { console.error("[vanis-skin] API HTTP " + res.status + " for asset " + assetId); return null; }
            const meta = await res.json();
            imageUrl = meta && meta.data && meta.data[0] && meta.data[0].imageUrl;
            if (!imageUrl) return null;   // unknown / moderated asset: permanent
        } catch (err) {
            if (attempt >= SKIN_RETRIES) {
                console.error("[vanis-skin] resolve failed for asset " + assetId + ": " + ((err && err.message) || err));
                return null;
            }
            await _sleep(1200 + attempt * 1300);   // 1.2s, 2.5s, 3.8s backoff
        }
    }
    if (!imageUrl) return null;
    try {
        const imgRes = await fetchFn(imageUrl, { timeout: SKIN_FETCH_TIMEOUT });
        if (!imgRes.ok) throw new Error("cdn HTTP " + imgRes.status);
        const buf = Buffer.from(await (imgRes.arrayBuffer ? imgRes.arrayBuffer() : imgRes.buffer()));
        const type = ((imgRes.headers && imgRes.headers.get && imgRes.headers.get("content-type")) || "image/png").split(";")[0].toLowerCase();
        if (buf.length > 0 && buf.length < 3 * 1024 * 1024) {
            // v2.11d: write-back local — guarda o PNG em browser/skins/<id>.png.
            // O render seguinte le ESSE ficheiro (zero rede) e os runners deixam
            // de depender da thumbnails.roblox.com, que 429-a IPs partilhados.
            // Best effort: um disco so-de-leitura nunca pode partir o render.
            try {
                if (!fs.existsSync(SKIN_DIR)) fs.mkdirSync(SKIN_DIR, { recursive: true });
                fs.writeFileSync(Path.join(SKIN_DIR, assetId + ".png"), buf);
                console.log("[vanis-skin] asset " + assetId + " guardado em browser/skins (proximos renders leem do local)");
            } catch (_w) {}
            return "data:" + type + ";base64," + buf.toString("base64");
        }
    } catch (err) {
        console.error("[vanis-skin] download failed for asset " + assetId + ": " + ((err && err.message) || err));
    }
    return null;
}

module.exports = class RendererApp {

    constructor() {
        this.ensureSingleInstance();
        this.concurrency = Math.max(~~concurrency, 1);
        this.bot = new Bot(this);
        this.pool = new Pool(this);
        this.tasks = {};
        this.rendering = [];
        this.tabs = {};
        this.rendered = [];
        this._skips = {};   // v2.12: tentativas de arranque falhadas por tarefa
    }

    get defaultRenderConfig() {
        return  {
            fps:     "60",
            res:     "1080",
            skin:    "all",
            name:    "all",
            mass:    "short",
            quality: "high", // v2.9: high por omissao — o crf 23 esbatia as linas do bg (padrao subtil de 4 niveis)
        }
    }

    get QUEUE_PATH()  { return QUEUE_PATH  }
    get OUTPUT_PATH() { return OUTPUT_PATH }

    ensureSingleInstance() {
        const lock = app.requestSingleInstanceLock();
        if (!lock) {
            logger.error("Second instance, quiting");
            app.quit();
            return;
        }
    }

    async init() {
        // v2.12: linha de identidade — se esta linha NAO aparecer nos logs do Space
        // depois do rebuild, o Space esta a correr codigo antigo (rebuild falhou ou
        // nao aconteceu). Mostra tambem quantas skins locais chegaram pelo repo.
        let _skins = 0;
        try { _skins = fs.readdirSync(SKIN_DIR).filter(f => f.endsWith(".png")).length; } catch (_e) {}
        console.log(`[App] v2.12 arrancado — concorrencia=${this.concurrency} | skins locais em browser/skins: ${_skins} ficheiro(s)`);
        console.log("");
        logger.verbose(`Concurrency: ${this.concurrency}`);
        await app.whenReady(); // v2.1: same race fix as worker.js
        logger.verbose("Electron app ready");
        await this.bot.init();

        // v2.12: limpeza de tarefas zombie no arranque. Se o processo morreu a meio
        // (crash/restart do Space), o pool.json pode ter tarefas cujo .vanis ja nao
        // existe — essas tarefas travavam a fila PARA SEMPRE (o offer() devolvia
        // sempre a mesma, o execTask saia calado e nada mais era renderizado: ficava
        // eternamente "pending" no Discord, sem erro nenhum). Remover aqui desbloqueia.
        let _zombie = 0;
        for (const hash of Object.keys(this.pool.queue)) {
            if (!fs.existsSync(Path.resolve(QUEUE_PATH, `${hash}.vanis`))) {
                this.pool.done(hash);
                _zombie++;
            }
        }
        if (_zombie) console.log(`[App] Fila limpa no arranque: ${_zombie} tarefa(s) zombie removida(s)`);

        let frame = 0;
        ipcMain.on("render-error", (_, hash, msg) => this.abortTask(hash, msg));

        // v2.11: see fetchRobloxSkin() above. The renderer asks for a data URI of
        // every "rbxassetid://<id>" skin before trying to load it.
        ipcMain.handle("vanis-skin", async (_, assetId) => fetchRobloxSkin(String(assetId)));

        ipcMain.on("buffer", (_, hash, base64) => {
            let tab = this.tabs[hash];
            if (!tab) return;                       // late frame of a task that already ended/aborted
            tab.lastBuffer = Date.now();
            let { shell } = tab;
            if (!shell) return;
            let buffer = base64 && Buffer.from(base64, "base64");
            logger.debug(`Buffer length: ${buffer ? buffer.byteLength : "[END]"}`);
            if (shell.stdin.writable) {
                if (buffer) {
                    shell.stdin.write(buffer);
                } else {
                    logger.verbose("Ending FFMPEG stdin");
                    shell.stdin.end();
                    // v26: the render window was never closed (one leaked Chromium + WebGL context
                    // per clip until the app was restarted)
                    try { tab.window && tab.window.destroy(); } catch {}
                    delete this.tabs[hash];
                }
            }
            frame++;
            if (dump) {
                fs.writeFileSync(Path.resolve(DUMP_PATH, `frame${String(frame).padStart(4, "0")}.jpeg`), buffer);
            }
        });
        
        this.exec();
    }

    async exec() {
        try {
            this.checkStalled();
            let tries = 0;
            while (this.rendering.length < this.concurrency && tries++ < this.concurrency) {
                let task = this.pool.offer(h => this.tabs[h] || this.rendering.includes(h) || this.rendered.includes(h));
                if (!task) break;
                console.log(`[Pool] Vai renderizar ${task.hash} (${task.filename})`);
                let started = false;
                try {
                    started = await this.execTask(task);
                } catch (e) {
                    console.error("[Exec Error]", e);
                    logger.error(e);
                    started = false;
                }
                if (!started) {
                    // v2.12: a tarefa foi oferecida mas NAO arrancou (ficheiro em falta,
                    // erro no arranque, callbacks em falta). Antes disto a tarefa ficava
                    // no pool PARA SEMPRE e travava a fila inteira — os clips seguintes
                    // ficavam eternamente "pending" sem mensagem nenhuma no Discord.
                    // Agora: 3 tentativas e a tarefa sai da fila com mensagem de erro.
                    this._skips[task.hash] = (this._skips[task.hash] || 0) + 1;
                    if (this._skips[task.hash] >= 3) {
                        delete this._skips[task.hash];
                        this.evictTask(task, "nao conseguiu arrancar apos 3 tentativas (ve os logs do Space) — removida da fila");
                    } else {
                        break;
                    }
                } else {
                    delete this._skips[task.hash];
                }
            }
        } catch (e) {
            logger.error(e);
            console.error("[Exec Error]", e);
        }
        setTimeout(this.exec.bind(this), 1000);
    }

    // v26: stop a render that failed or stalled: kill ffmpeg, close the window, tell Discord, and
    // free the pool slot so the next !render runs.
    abortTask(hash, reason) {
        let tab = this.tabs[hash];
        if (!tab || tab.aborted) return;
        tab.aborted = true;
        this.aborts = this.aborts || {};
        this.aborts[hash] = reason || "render failed";
        console.error(`[App] A abortar ${hash}: ${this.aborts[hash]}`);
        try { tab.window && tab.window.destroy(); } catch {}
        try { tab.shell && tab.shell.stdin && tab.shell.stdin.destroy(); } catch {}
        try { tab.shell && tab.shell.kill(); } catch {}
    }

    checkStalled() {
        const now = Date.now();
        for (const hash of Object.keys(this.tabs)) {
            const tab = this.tabs[hash];
            if (!tab || tab.aborted) continue;
            if (now - (tab.lastBuffer || tab.started || now) > 120000)
                this.abortTask(hash, "render stalled (no frames for 120 s)");
        }
    }

    // a .vanis is "REPLAY|proto|thumb|b64|b64|..." — every packet must be valid base64
    validateVanis(data) {
        const parts = data.trim().split("|");
        if (parts[0] !== "REPLAY" || parts.length < 6) return "not a .vanis (missing header / packets)";
        for (let i = 3; i < parts.length; i++) {
            if (!/^[A-Za-z0-9+\/]*={0,2}$/.test(parts[i]) || parts[i].length % 4 === 1)
                return `corrupt packet #${i - 3} (invalid base64) — re-save the clip with the updated game`;
        }
        return null;
    }

    addTask(task, callbacks) {
        logger.verbose(`Adding task#${task.hash}`);
        console.log(`[App] Task adicionada ${task.hash}`);
        this.tasks[task.hash] = callbacks;
        this.pool.add(task);
    }

    async execTask(task) {
        if (!task || !task.hash) return false;
        if (this.tabs[task.hash] || this.rendering.includes(task.hash) || this.rendered.includes(task.hash)) return false;
        if (!this.tasks[task.hash])
            this.tasks[task.hash] = await this.bot.generateCallbacks(task);

        if (!this.tasks[task.hash]) {
            logger.warn(`Failed to generate callback for task#${task.hash}, aborting`);
            this.evictTask(task, "nao foi possivel ligar as mensagens de progresso do render");
            return false;
        }

        let inputPath = Path.resolve(this.QUEUE_PATH, `${task.hash}.vanis`);
        if (!fs.existsSync(inputPath)) {
            // v2.12: antes isto saia CALADO e a tarefa ficava no pool para sempre —
            // a fila ficava presa nela e todos os clips seguintes ficavam "pending"
            // eternamente, sem erro nenhum no Discord. Agora: sai da fila e avisa.
            console.log(`[App] Ficheiro nao existe ${inputPath} — tarefa removida da fila`);
            this.evictTask(task, "o ficheiro do clip desapareceu da fila (o Space reiniciou a meio?) — envia o clip outra vez");
            return false;
        }
        
        // v2.12: QUALQUER erro entre aqui e o arranque do ffmpeg/janela deixava a tarefa
        // presa no pool e no rendering (slot de concorrencia gasto) = fila morta e o
        // clip eternamente "pending". Agora o erro e apanhado, o slot e libertado e o
        // Discord recebe a mensagem de erro.
        try {
            let config = Object.assign({}, task.config);

            // v26: refuse a corrupt clip up-front instead of opening a window that can only crash
            const rawData = fs.readFileSync(inputPath, "utf-8");
            const bad = this.validateVanis(rawData);
            if (bad) {
                console.error(`[App] Clip invalido (${task.hash}): ${bad}`);
                this.evictTask(task, bad);
                return false;
            }

            try {
                await this.tasks[task.hash].onBegin();
            } catch(e) { console.error("[onBegin Error]", e); }

            this.rendering.push(task.hash);
            let { width, height } = this.resToDim(task.config.res);

            console.log(`[App] A criar janela ${width}x${height} para ${task.hash}`);
            console.log(`[App] FFmpeg path: ${ffmpegPath}`);

            const renderWindow = new BrowserWindow({
                width,
                height,
                frame: false,
                closable: false,
                resizable: false,
                minimizable: false,
                maximizable: false,
                show: false,
                webPreferences: { 
                    nodeIntegration: true,
                    contextIsolation: false,
                    offscreen: false,
                    backgroundThrottling: false
                },
            });

            let args = [
                '-y',
                '-f', 'image2pipe',
                '-framerate', config.fps,
                '-i', '-',
                '-profile:v', 'baseline',
                '-crf', {"high":"15","medium":"18","low":"30"}[config.quality],
                // v2.9: crf recalibrado. O antigo medium=23 esmagava o padrao hexagonal do bg
                // (juntas 16 vs celulas 12 = só 4 niveis) — depois do encode as linhas ficavam
                // em 13-14 e o video parecia "tudo da mesma cor". com crf 15/18 o padrao sobrevive.
                // nota: ficheiros ~2x maiores; clips longos vao para o DropBox (--res 720 / --fps 30 ajuda)
                // v2.2: veryfast em vez do preset por omissão (medium) — no runner de 4 vCPU o
                // medium não chegava a 60 fps em 1080p, o backlog acumulava no stdin e os
                // últimos ~12% do render demoravam uma eternidade (barra "presa" perto do fim)
                '-preset', 'veryfast',
                // v2.11: CORREÇÃO CRÍTICA DE GAMA DE COR — "fundo/borda invisíveis".
                // Os frames chegam do toDataURL('image/jpeg') como JPEG FULL-RANGE
                // (yuvj420p). Sem conversão explícita, o ffmpeg copia os valores Y para
                // o H.264 e tagga o vídeo como fullrange=1 — mas o player do Discord
                // (Chromium) e a maioria dos players ASSUMEM limited range e esmagam
                // tudo com luma <= 16 a preto puro: fundo #101010 (Y16) -> rgb(0),
                // textura (Y12) -> rgb(0), borda (Y0) -> rgb(0). As células coloridas
                // sobrevivem (luma alta) — daí o vídeo "tudo escuro sem borda nem bg".
                // Convertendo full->tv aqui, o fundo fica Y30 e TODOS os players
                // mostram os valores reais do jogo: fundo rgb(16), textura rgb(12),
                // borda rgb(0) — paridade exata com o cliente vanis.
                '-vf', 'scale=in_range=full:out_range=tv',
                '-pix_fmt', 'yuv420p',
                '-c:v', 'libx264',
                Path.resolve(OUTPUT_PATH, `${task.hash}.mp4`)];

            if (process.platform !== "win32")
                ffmpegPath = "ffmpeg";
    
            console.log(`[App] A iniciar ffmpeg: ${ffmpegPath} ${args.join(" ")}`);
            let shell = spawn(ffmpegPath, args);
            this.tabs[task.hash] = { window: renderWindow, shell, started: Date.now(), lastBuffer: Date.now() };

            shell.once("exit", code => {
                code ? logger.error(`FFMPEG exited with code ${code}`) : logger.verbose(`FFMPEG exited with code ${code}`);
                console.log(`[FFMPEG] exit code ${code} para ${task.hash}`);
                try { fs.unlinkSync(Path.resolve(this.QUEUE_PATH, `${task.hash}.vanis`)); } catch {}
                let callbacks = this.tasks[task.hash];
                const idx = this.rendering.indexOf(task.hash);
                if (idx >= 0) this.rendering.splice(idx, 1);
                this.rendered.push(task.hash);
                this.pool.done(task.hash);
                delete this.tasks[task.hash];
                const abortReason = this.aborts && this.aborts[task.hash];
                delete this.tabs[task.hash];
                if (abortReason) {
                    delete this.aborts[task.hash];
                    try { fs.unlinkSync(Path.resolve(OUTPUT_PATH, `${task.hash}.mp4`)); } catch {}
                    callbacks && callbacks.onError(abortReason);
                } else if (!code) {
                    callbacks && callbacks.onFinish();
                } else {
                    callbacks && callbacks.onError(`Error(${code})`);
                }
            });

            shell.on("error", err => {
                console.error("[FFMPEG spawn error]", err);
                logger.error(err);
            });

            shell.on("close", (code, signal) => {
                logger.debug(`FFMPEG closed with code ${code} and signal ${signal}`);
                console.log(`[FFMPEG] closed code ${code} signal ${signal}`);
            });

            let data = rawData;
            let frames = ~~config.fps * (data.split("|").length - 4) / 25;
            logger.verbose(`Total frame: ${frames}`);
            console.log(`[App] Total frames estimado: ${frames}`);

            shell.stderr.on("data", chunk => {
                let txt = chunk.toString();
                logger.debug(txt);
                // console.log("[FFMPEG]", txt);
                let args = txt.split(/ +/g);
                if (args[0] == "frame=" && /^[1-9]\d*$/.test(args[1])) {
                    let progress = parseInt(args[1]) / frames;
                    this.tasks[task.hash].onProgress(progress);
                }
            });

            config.res = `${width}x${height}`;
        
            // Captura console do browser pra debug
            renderWindow.webContents.on("console-message", (event, level, message, line, sourceId) => {
                console.log(`[Browser ${level}] ${message} (${sourceId}:${line})`);
            });
            renderWindow.webContents.on("crashed", () => {
                console.error(`[Window] CRASHED para ${task.hash}`);
            });
            renderWindow.webContents.on("render-process-gone", (e, details) => {
                console.error(`[Window] render-process-gone ${JSON.stringify(details)} para ${task.hash}`);
            });
            renderWindow.webContents.on("unresponsive", () => {
                console.error(`[Window] unresponsive para ${task.hash}`);
            });

            renderWindow.webContents.once("dom-ready", () => {
                logger.verbose(`Starting to render ${task.hash}`);
                console.log(`[App] dom-ready, a enviar render para ${task.hash}`);
                // Abre DevTools se precisar ver erro - comenta depois
                // renderWindow.webContents.openDevTools({ mode: 'detach' });
                renderWindow.webContents.send("render", task.hash, data, config);
            });

            renderWindow.webContents.on("did-fail-load", (e, code, desc) => {
                console.error(`[Window] did-fail-load ${code} ${desc}`);
            });

            renderWindow.loadFile("./browser/index.html");
        } catch (e) {
            console.error("[App] Erro ao arrancar o render:", e);
            const _idx = this.rendering.indexOf(task.hash);
            if (_idx >= 0) this.rendering.splice(_idx, 1);
            if (!this.tabs[task.hash])
                this.evictTask(task, "erro ao arrancar o render: " + (e && e.message ? e.message : e));
            return false;
        }
        return true;
    }

    // v2.12: remove uma tarefa da fila de forma SEGURA e AVISADA: tira do pool, apaga o
    // .vanis, limpa os callbacks e manda a mensagem de erro para o Discord. O caminho
    // antigo (pool.done + return calado) deixava tarefas zombie que travavam a fila
    // inteira sem mensagem nenhuma — era isto que mantinha os clips eternamente pendentes.
    evictTask(task, reason) {
        try { console.error(`[App] Tarefa ${task && task.hash} removida da fila: ${reason}`); } catch (_l) {}
        try { this.pool.done(task.hash); } catch (_p) {}
        try { fs.unlinkSync(Path.resolve(this.QUEUE_PATH, `${task.hash}.vanis`)); } catch (_u) {}
        let cbs = this.tasks[task.hash];
        delete this.tasks[task.hash];
        if (cbs && typeof cbs.onError === "function") {
            try { cbs.onError(reason); } catch (_c) {}
        }
    }

    resToDim(res) {
        return {
            1080: { width: 1920, height: 1080 },
            720: { width: 1280, height: 720 },
            480: { width: 858, height: 480 },
            360: { width: 480, height: 360 },
            240: { width: 426, height: 240 },
            144: { width: 256, height: 144 }
        }[res];
    }
}
