// FIX para canais novos - mantém compatibilidade
try {
  // Se ainda houver discord.js v11 instalado, patcha, se não ignora
  const ClientDataManager = require("discord.js/src/client/ClientDataManager");
  const Guild = require("discord.js/src/structures/Guild");
  const origNewChannel = ClientDataManager.prototype.newChannel;
  ClientDataManager.prototype.newChannel = function(data, guild) {
    try { const ch = origNewChannel.call(this, data, guild); return ch || null; } catch { return null; }
  };
  const origSetup = Guild.prototype.setup;
  Guild.prototype.setup = function(data) {
    try {
      if (data && data.channels) {
        data.channels = data.channels.filter(c => c && [0,1,2,3,4,5].includes(c.type));
      }
    } catch {}
    return origSetup.call(this, data);
  };
  console.log("[Fix] discord.js v11 patch aplicado");
} catch {}

const fs = require("fs");
const { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder, ActivityType } = require("discord.js");
const uid = require("uid-safe");
const logger = require("./Logger");
const DropBox = require("./DropBox");
const Path = require("path");

let configJson = {};
try { configJson = require("../config.json"); } catch {}

// v27-hf: fallbacks para variaveis de ambiente (Secrets do Hugging Face).
// O token NUNCA deve ficar num ficheiro dentro de um repositorio publico!
const token = process.env.DISCORD_TOKEN || configJson.token;
const owner = process.env.DISCORD_OWNER || configJson.owner;
const envChannels = {};
if (process.env.DISCORD_CHANNELS) {
    for (const id of process.env.DISCORD_CHANNELS.split(",").map(s => s.trim()).filter(Boolean))
        envChannels[id] = id;
}
const channels = { ...(configJson.channels || {}), ...envChannels };

module.exports = class RenderDiscordBot extends Client {
    constructor(app) {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [Partials.Channel, Partials.Message]
        });
        this.app = app;
        this.owner = null;
        this.disabled = false;
        this.replayOnly = false;
        this.production = process.env.NODE_ENV === "production";
        this.box = new DropBox();
        // API base para !render <code>
        this.apiBase = (configJson.api || process.env.VANIS_API || "").replace(/\/+$/, "");
    }

    async init() {
        this.on("ready", this.ready.bind(this))
            .on("messageCreate", this.onMessage.bind(this))
            .on("error", logger.error);
            
        await this.login(token).catch(() => {
            logger.error("Bot not able to login");
            process.exit(1);
        });
    }

    ready() {
        console.log(`[Info] ${this.user.username} Bot Ready (discord.js v14)`);
        logger.log(`${this.user.username} Bot Ready`);
        this.user.setActivity(this.production ? "Vanis Clips" : "Ready to Render!", { type: ActivityType.Playing });
        this.setOwner(owner);

        process.on("SIGINT", () => {
            this.destroy();
            logger.exit("SIGINT");
            process.exit(0);
        });
        process.on("uncaughtException", e => {
            console.error(e);
            // Ignora Unknown Message para não spammar DM nem desabilitar
            if(e && (e.code === 10008 || String(e).includes("10008"))) {
                console.log("[Ignorado] Unknown Message em render");
                return;
            }
            this.disable();
            this.reportToOwner(e ? (e.stack || e.message || String(e)) : "Unknown Error");
        });
        process.on("unhandledRejection", e => {
            console.error(e);
            if(e && (e.code === 10008 || String(e).includes("10008") || e.message?.includes("Unknown Message"))) {
                console.log("[Ignorado] Unknown Message rejection");
                return;
            }
            this.disable();
            this.reportToOwner(e ? (e.stack || e.message || String(e)) : "Unknown Error");
        });
    }

    async onMessage(message) {
        if (message.author.bot || message.system) return;
        if (this.owner && message.author.id == this.owner.id) this.adminMessage(message);
        if (this.disabled) return;

        const content = message.cleanContent || message.content;
        if (content == "!help") {
            this.sendHelp(message.channel);
        }

        if (!channels || Object.keys(channels).length && !channels[message.channel.id]) return;

        try {
            await this.parseMessage(message, channels[message.channel.id]);
        } catch (e) {
            logger.error(e);
            try { await message.channel.sendTyping(); } catch {}
        }
    }

    sendHelp(channel) {
        channel.send("Render options: ```\n--dm (send output to dm)\n--skin [all|tag|me|none]\n--name [all|hideme|none]\n--mass [long|short|none]\n--res [1080|720|480|360|240]\n--fps [60|30|24]\n--quality [high|medium|low]```");
    }

    async parseMessage(message, outputChannelID) {
        console.log(">>> MENSAGEM RECEBIDA no canal", message.channel.id, "conteudo:", (message.cleanContent||message.content), "ficheiros:", message.attachments.size);

        const apiBase = (this.apiBase || process.env.VANIS_API || "").replace(/\/+$/, "");
        const rawContent = (message.cleanContent || message.content || "").trim();
        const m = rawContent.match(/^[/!]render\s+([A-Za-z0-9_-]{6,64})(?:\s|$)/);

        const datasets = [];

        if (m) {
            if (!apiBase) {
                const mm = await message.reply("Render API is not configured (config.json \"api\" or env VANIS_API).");
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }
            const code = m[1];
            try { await message.channel.sendTyping(); } catch {}
            try {
                const res = await fetch(`${apiBase}/api/replays/${encodeURIComponent(code)}`);
                if (res.status === 404) {
                    const mm = await message.reply(`No replay found for code **${code}**`);
                    setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                    return;
                }
                if (res.status !== 200) {
                    const mm = await message.reply(`Failed to fetch replay **${code}** (status ${res.status})`);
                    setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                    return;
                }
                const data = await res.text();
                datasets.push({ filename: `${code}.vanis`, data });
            } catch (e) {
                logger.error(e);
                const mm = await message.reply(`Failed to reach the render API: ${e && e.message ? e.message : e}`);
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }
        }

        if (this.replayOnly && !datasets.length) {
            if (!message.attachments.size) {
                const m2 = await message.channel.send("Please only submit **.vanis** clip here");
                setTimeout(() => { try { m2.delete(); } catch {} }, 8000);
                try { await message.delete(); } catch {}
                return;
            }
            try { await message.delete(); } catch {}
        }

        for (let attachment of message.attachments.values()) {
            let filename = attachment.name || attachment.filename;
            if (!filename || !filename.endsWith(".vanis")) continue;

            logger.verbose(`Filename: ${filename}`);
            try { await message.channel.sendTyping(); } catch {}

            let size = attachment.size || attachment.filesize || 0;
            logger.verbose(`Filesize: ${(size / 1024 / 1024).toFixed(2)}MB`);

            if (size > 5 * 1024 * 1024) {
                const mm = await message.reply(`Your replay file is too big!\nA normal replay file should be less than **5MB**`);
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }

            let url = attachment.url || attachment.proxyURL;
            logger.debug(`Fetching Data from ${url}`);

            let res = await fetch(url);
            if (res.status !== 200) {
                const mm = await message.reply(`Failed to fetch vanis file from ${url}\nStatus[${res.status}]:${res.statusText}`);
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }

            logger.debug(`Reading Buffers`);
            let buffer = new Uint8Array(await res.arrayBuffer());
            // Node 18+ tem TextDecoder global
            let decoder = new (require('util').TextDecoder || global.TextDecoder)("utf-8");
            let data;
            try { data = decoder.decode(buffer); } catch { data = Buffer.from(buffer).toString("utf-8"); }

            datasets.push({ filename, data });
        }

        for (let { filename, data } of datasets) {
            logger.debug("Done Reading Buffers");

            let parts = data.split("|");
            if (parts.shift() !== "REPLAY") {
                const mm = await message.reply(`Invalid replay format`);
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }

            let protocol = ~~parts.shift();
            if (protocol != 2 && protocol != 3 && protocol != 4) {
                const mm = await message.reply(`Invalid protocol version: **${protocol}**`);
                setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                return;
            }

            let config = this.parseConfig(message);
            if (!config) return;

            if ((message.cleanContent||message.content).includes("--dm")) {
                try {
                    let dm = await message.author.createDM();
                    outputChannelID = dm.id;
                } catch (_) {
                    const mm = await message.reply("Your DM is not open, aborting.");
                    setTimeout(() => { try { mm.delete(); } catch {} }, 8000);
                    return;
                }
            }

            logger.debug(`Config: ${JSON.stringify(config, null, 4)}`);

            let task = {
                user: message.author.id,
                channel: outputChannelID,
                hash: await uid(16),
                filename: `${filename.slice(0, -6)}.mp4`,
                config
            }

            fs.writeFileSync(`${this.app.QUEUE_PATH}/${task.hash}.vanis`, data);

            let thumbnailB64 = "";
            try { thumbnailB64 = parts.shift().slice(22); } catch {}
            let callbacks = await this.generateCallbacks(task, thumbnailB64);
            this.app.addTask(task, callbacks);

            const m2 = await message.channel.send(`Replay pending...`);
            setTimeout(() => { try { m2.delete(); } catch {} }, 5000);
        }
    }

    parseConfig(message) {
        let config = this.app.defaultRenderConfig;
        let raw = (message.cleanContent || message.content || "").toLowerCase();
        let args = raw.split(/ /g);
        while (args.length) {
            let arg  = args.shift();
            let next = args.shift();
            if (!arg) { next && args.unshift(next); continue; }
            switch (arg) {
                case "--dm":
                    args.unshift(next);
                    break;
                case "--fps":
                    if (["60", "30", "25", "1"].includes(next)) config.fps = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--fps**. Valid options (**60**|**30**|**25**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input FPS **${next}** is not a valid option (**60**|**30**|**25**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                case "--res":
                    if (["1080", "720", "480", "360", "240", "144"].includes(next)) config.res = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--res**. Valid options: (**1080**|**720**|**480**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input resolution **${next}** is not a valid option (**1080**|**720**|**480**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                case "--skin":
                    if (["all", "tag", "me", "none"].includes(next)) config.skin = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--skin**. Valid options: (**all**|**tag**|**me**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input skin option **${next}** is not a valid option (**all**|**tag**|**me**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                case "--name":
                    if (["all", "hideme", "none"].includes(next)) config.name = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--name**. Valid options: (**all**|**hideme**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input name option **${next}** is not a valid option (**all**|**hideme**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                case "--mass":
                    if (["short", "long", "none"].includes(next)) config.mass = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--mass**. Valid options: (**short**|**long**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input mass option **${next}** is not a valid option (**short**|**long**|**none**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                case "--quality":
                    if (["high", "medium", "low"].includes(next)) config.quality = next;
                    else {
                        if (next && next.startsWith("-")) message.reply(`Missing option for **--quality**. Valid options: (**high**|**medium**|**low**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        else message.reply(`Input quality option **${next}** is not a valid option (**high**|**medium**|**low**)`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                        return;
                    }
                    break;
                default:
                    if (arg.startsWith("--") || arg.startsWith("!") || arg.startsWith("/")) {
                        if (arg.startsWith("--")) {
                            message.reply(`Unknown argument: **${arg}**\nValid arguments: **--fps**, **--res**, **--skin**, **--name**, **--mass**, and **--quality**`).then(m => setTimeout(()=>{try{m.delete()}catch{}},8000));
                            return;
                        }
                    }
                    break;
            }
        }
        return config;
    }

    async generateCallbacks(task, thumbnailBase64 = "") {
        let file = `${this.app.QUEUE_PATH}/${task.hash}.vanis`;
        if (!thumbnailBase64) {
            if (!fs.existsSync(file)) return {};
            try {
                let data = fs.readFileSync(file, "utf-8");
                thumbnailBase64 = data.split("|")[2].slice(22);
            } catch {}
        }

        let thumbnailName = `thumbnail_${task.hash}.png`;
        let thumbBuffer;
        try { thumbBuffer = Buffer.from(thumbnailBase64, "base64"); } catch { thumbBuffer = Buffer.alloc(0); }

        let embed = this.createEmbed(task.user, `${task.filename} (pending)`);
        let files = [];
        if (thumbBuffer.length > 100) {
            let att = new AttachmentBuilder(thumbBuffer, { name: thumbnailName });
            files.push(att);
            embed.setImage(`attachment://${thumbnailName}`);
        }

        // FIX: busca canal com fetch, nao so cache, e nao da process.exit
        let channel = await this.findChannelById(task.channel);
        if (!channel) {
            channel = await this.getFallbackChannel();
        }
        if (!channel) {
            logger.error(`No channel found for task ${task.hash}, tried ${task.channel}. Queue will be cleared.`);
            // Nao crasha, apenas limpa a task
            try { this.app.pool.done(task.hash); } catch {}
            try { fs.unlinkSync(file); } catch {}
            return {
                onBegin: async () => {},
                onProgress: async () => {},
                onError: async () => {},
                onFinish: async () => {}
            };
        }

        let message = await channel.send({ embeds: [embed], files }).catch(e => { console.error("[Bot] send pending failed", e.message); return null; });

        let callbacks = {};
        let startTime = 0;

        callbacks.onBegin = async () => {
            try {
                logger.debug(`Starting to render ${task.filename}`);
                startTime = Date.now();
                try { if (message) await message.delete(); } catch {}
                embed = this.createEmbed(task.user, `${task.filename} (rendering)`).setDescription(`\`[>${" ".repeat(19)}]\` **0%**`);
                if (files.length) embed.setImage(`attachment://${thumbnailName}`);
                message = await channel.send({ embeds: [embed], files });
            } catch (_) {}
        }

        let bar = 0;
        callbacks.onProgress = async progress => {
            try {
                let newBar = Math.round(progress / 0.05);
                if (newBar != bar) {
                    bar = Math.min(newBar, 19);
                    embed.setDescription(`\`[${"=".repeat(bar)}>${" ".repeat(19 - newBar)}]\` **${Math.round(progress * 100)}%**`);
                    try { if (message) await message.edit({ embeds: [embed] }); } 
                    catch(e){ if(e.code !== 10008) console.error("[Edit Progress Error]", e.code, e.message); }
                }
            } catch (_) {}
        }

        callbacks.onError = error => {
            try {
                try { if (message) message.delete(); } catch {}
                let errEmbed = this.createEmbed(task.user, `${task.filename} (error)`).setDescription(String(error).slice(0, 4000));
                channel.send({ embeds: [errEmbed] });
            } catch (_) {}
        }

        callbacks.onFinish = async () => {
            let outputPath = Path.resolve(this.app.OUTPUT_PATH, `${task.hash}.mp4`);
            try {
                logger.verbose(`Uploading ${outputPath}`);
                try { if (message) await message.delete(); } catch {}

                let attachment = new AttachmentBuilder(outputPath, { name: task.filename });
                await channel.send({ content: `<@${task.user}> Done rendering **${task.filename}** (time elapsed: **${Math.round((Date.now() - startTime) / 1000)}** seconds)`, files: [attachment] });
            } catch (e) {
                const DiscordAPIError = (() => { try { return require("discord.js").DiscordAPIError; } catch { return null; } })();
                if (DiscordAPIError && e instanceof DiscordAPIError) {
                    if (!this.box || !this.box.enabled) {
                        const mb = fs.existsSync(outputPath) ? (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1) : "?";
                        await channel.send(`<@${task.user}> O video (${mb}MB) passou do limite de anexos do Discord e o DropBox nao esta configurado. Tenta **--res 720** ou **--fps 30** para ficar mais leve.`);
                        return;
                    }
                    let quota = await this.box.getQuota();
                    logger.verbose(`DropBox quota left: ${Math.round(quota / 1024 / 1024)}MB`);
                    if (quota < 250 * 1024 * 1024) this.reportToOwner(`Running out of quota: **${~~(quota / 1024 / 1024)}**MB left`);
                    if (quota <= fs.statSync(outputPath).size) {
                        await channel.send("No more space in Yuu's DropBox.");
                        return;
                    } else {
                        let link = await this.box.upload(outputPath, task.hash);
                        await channel.send(`<@${task.user}> Done rendering **${task.filename}** (time elapsed: **${Math.round((Date.now() - startTime) / 1000)}** seconds)\n${link}`);
                    }
                } else {
                    logger.error(e);
                    await channel.send("Error");
                    this.disable();
                }
            }
            try { fs.unlinkSync(outputPath); } catch {}
        }

        return callbacks;
    }

    // FIXED: nao da exit, tenta fetch
    async getFallbackChannel() {
        try {
            const firstId = Object.values(channels || {})[0] || Object.keys(channels || {})[0];
            if (!firstId) {
                logger.error("No channels configured in config.json");
                return null;
            }
            let ch = null;
            try { ch = await this.channels.fetch(firstId); } catch {}
            if (!ch) ch = this.channels.cache.get(firstId) || this.channels.cache.find(c => c.id == firstId) || null;
            if (!ch) {
                logger.error(`Fallback channel ${firstId} not found in cache. Bot may not have access or not ready yet.`);
                return null;
            }
            return ch;
        } catch (e) {
            logger.error("getFallbackChannel error: " + e.message);
            return null;
        }
    }

    // Mantido pra compatibilidade, mas agora chama getFallbackChannel
    get fallbackChannel() {
        // Nao chama process.exit mais, retorna null e deixa generateCallbacks tratar
        const firstId = Object.values(channels || {})[0];
        let ch = this.channels.cache.get(firstId) || this.channels.cache.find(c => c.id == firstId) || null;
        if (!ch) {
            logger.error("No fallback channel in cache (will try fetch later)");
            return null;
        }
        return ch;
    }

    async findChannelById(id) {
        if (!id) return null;
        try {
            let ch = await this.channels.fetch(id).catch(()=>null);
            if (ch) return ch;
        } catch {}
        return this.channels.cache.find(ch => ch.id == id) || this.channels.cache.get(id) || null;
    }

    findUserById(id) {
        return this.users.cache.find(u => u.id == id) || this.users.cache.get(id);
    }

    createEmbed(author, title) {
        let embed = new EmbedBuilder().setTitle(title || "No Title").setColor(0x00FFFF).setTimestamp();
        let user = this.findUserById(author);
        if (user) {
            embed.setAuthor({ name: user.username, iconURL: user.displayAvatarURL() });
        } else {
            embed.setAuthor({ name: String(author) });
        }
        return embed;
    }

    get avatar() {
        return this.user.displayAvatarURL() || this.user.avatarURL;
    }

    async adminMessage(message) {
        if (message.content.startsWith("!")) logger.verbose(`Admin Message: ${message.content}`);
        if (/^!disable( .*)?/i.test(message.content)) {
            this.disable();
            this.reportToOwner("Bot is now **disabled**");
        } else if (/^!enable( .*)?/i.test(message.content)) {
            this.enable();
            this.reportToOwner("Bot is now **enabled**");
        }
    }

    disable() {
        this.disabled = true;
        this.user && this.user.setActivity("Maintaining");
    }

    enable() {
        this.disabled = false;
        this.user && this.user.setActivity("Vanis Clips", { type: ActivityType.Playing });
    }

    async reportToOwner(msg) {
        if (msg.startsWith("**") && msg.endsWith("**")) logger.log(msg.slice(2, -2));
        else logger.error(msg);
        if (this.owner) {
            try {
                if (msg.length > 100) msg = "```\n" + msg + "\n```";
                await this.owner.send(String(msg));
            } catch(e) { logger.error(e); }
        }
    }

    async setOwner(id) {
        let user = this.findUserById(id);
        if (!user) {
            try { user = await this.users.fetch(id); } catch {}
        }
        if (!user) return;
        this.owner = user;
        logger.log(`Welcome Back, ${user.username}`);
    }
}
