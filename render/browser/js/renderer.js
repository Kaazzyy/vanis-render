/** @param {RenderConfig} config */

// =====================================================================
// v2.10 — fundo e borda à prova de falha, paridade exata com o jogo:
//   * textura de fundo EMBUTIDA abaixo (a img/background.png real do cliente
//     vanis, md5 1052cf2004b2a5f9ce4c18b1840e3dcd). Como data URI nunca depende
//     de rede, caminho relativo, file:// ou CORS — se o assets/bg.png falhar
//     por qualquer motivo no Actions, o fallback entra automaticamente.
//   * setBackgroundImage agora VALIDA a imagem (naturalWidth): o ImageLoader
//     devolve {} (truthy) quando o carregamento falha, o que antes criava uma
//     PIXI.BaseTexture({}) sem pixels — fundo invisível.
//   * setupStage protege setBackgroundImage com try/catch: o setBorder() corre
//     SEMPRE, mesmo que o fundo falhe.
//   * backgroundImageOpacity = .6 — o valor exato do cliente real (main.js).
//   * [BG-DIAG] no 1º frame: mostra nos logs do Actions o renderer (WebGL/Canvas),
//     a textura ativa, as dimensões do mapa e amostras de pixels (canto/centro).
// =====================================================================
// NOTA: o ficheiro chama-se background.png mas é WEBP lossless (RIFF) —
// o Chromium decodifica pelo conteúdo; usamos o MIME correto no data URI.
window.VANIS_BG_DATA_URI = "data:image/webp;base64," + "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";

// === FIX PARA browser/index.html - COLAR NO FINAL DO setConfig ===

const CAMERA_MOVE_RATE = 3.08;
const CAMERA_ZOOM_RATE = 9.05;

const setConfig = config => {
    setSkinMode(config.skin);
    setNameMode(config.name);
    setMassMode(config.mass);
    
    let dim = config.res.split("x");
    resizeRenderer(~~dim[0], ~~dim[1]);
    if (window.game && window.game.renderer) {
        window.game.renderer.view.width  = ~~dim[0];
        window.game.renderer.view.height = ~~dim[1];
    }

    // --- FIXES ---
    // 1. Camera: SAME smoothing as the Roblox game's Camera.lua (v25). It was a hard-lock
    // (20 / 5 = time constant 0.05 s / 0.2 s), 6x snappier than the game the player saw.
    // Game: per-60fps-frame lerp 0.05 (move) / 0.14 (zoom)  =>  rate = -60 * ln(1 - s)
    //   move: 3.08 /s (time constant 0.32 s)   zoom: 9.05 /s (0.11 s)
    // Raise the numbers to follow the clipper tighter, lower them for a softer camera.
    if (window.settings) {
        window.settings.cameraMoveSmoothing = CAMERA_MOVE_RATE;
        window.settings.cameraZoomSmoothing = CAMERA_ZOOM_RATE;
    }

    // 2. Garante cores mesmo sem skinUrl
    if (window.game && window.game.playerManager) {
        try {
            Object.values(window.game.playerManager.players).forEach(p => {
                if (!p.skinUrl || p.skinUrl === "") {
                    if (p.skinSprite && p.skinSprite.parent) {
                        p.skinSprite.parent.removeChild(p.skinSprite);
                    }
                }
            });
            window.game.playerManager.reRenderPlayerTextures();
        } catch(e) { console.error("[setConfig color fix]", e); }
    }
}

const { ipcRenderer } = require("electron");

ipcRenderer.on("render", 
/**
 * @param {string} hash
 * @param {string} path
 * @param {string} out
 * @param {RenderConfig} config
 */
async (_, hash, data, config) => {
    window.renderID = hash;

    // v26: ANY failure (corrupt clip, missing asset, exception in a tick) is reported to the
    // main process, which stops ffmpeg, closes the window and frees the queue. Before this a
    // single bad clip left its task stuck at the head of the pool forever, so no later
    // !render ever ran.
    const fail = e => {
        const msg = (e && (e.stack || e.message)) || String(e);
        console.error("[render-error]", msg);
        ipcRenderer.send("render-error", hash, String(msg).slice(0, 300));
    };

    try {
        await loadReplay(data);

        // v2.11d: espera (max 10 s) pelas skins ANTES do 1.o frame — antes,
        // as skins so "acendiam" a meio do video porque carregavam depois
        // do render comecar. Se uma skin nunca chegar, segue em frente.
        if (window.waitForSkins) await window.waitForSkins(10000);

        // v2.11b: one-line skin summary — makes a "skins missing" report
        // diagnosable straight from the Actions log.
        try {
            var _ss = window.__skinStats;
            if (_ss && _ss.requested > 0)
                console.log("[skins] summary: " + _ss.resolved + " resolved, " +
                    (_ss.requested - _ss.resolved) + " FAILED of " + _ss.requested +
                    " rbxassetid skin(s)" + (_ss.resolved < _ss.requested ? "  <-- see the [skins] warnings above" : ""));
        } catch (_se) {}

        let buffer = await tick(0);
        setConfig(config);

        // v2.10: diagnóstico do 1º frame — aparece nos logs do Actions
        // ([Browser log] ...). Se o video sair "tudo da mesma cor", estas amostras
        // dizem logo se o problema é textura ausente, renderer errado ou mapa inválido.
        try {
            game.renderer.render(game.stage);
            const dc = document.createElement("canvas");
            dc.width = 32, dc.height = 18;
            const dg = dc.getContext("2d");
            dg.drawImage(game.renderer.view, 0, 0, 32, 18);
            const dd = dg.getImageData(0, 0, 32, 18).data
              , px = i => dd[4 * i] + "," + dd[4 * i + 1] + "," + dd[4 * i + 2]
              , bs = game.scene && game.scene.backgroundSprite;
            console.log("[BG-DIAG] renderer=" + (game.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? "WebGL" : "Canvas")
                + " sprite=" + (bs ? bs.texture.baseTexture.width + "x" + bs.texture.baseTexture.height + " alpha=" + bs.alpha : "AUSENTE")
                + " mapa=" + (game.border && game.border.width + "x" + game.border.height)
                + " px canto=" + px(0) + " meio-topo=" + px(16 * 18 + 0) + " centro=" + px(9 * 32 + 16));
        } catch (e) {
            console.log("[BG-DIAG] falhou: " + (e && e.message || e));
        }

        let frame = 0;
        const render = async () => {
            try {
                frame++;
                buffer = await tick(1 / config.fps);

                if (buffer) {
                    if (frame > 5)
                        ipcRenderer.send("buffer", hash, buffer.slice(23));
                    setImmediate(render);
                } else {
                    ipcRenderer.send("buffer", hash, "");
                }
            } catch (e) { fail(e); }
        }
        setImmediate(render);
    } catch (e) { fail(e); }
});


!function(x) {
    function a(a) {
        for (var t, i, r = a[0], s = a[1], o = a[2], l = 0, d = []; l < r.length; l++)
            i = r[l],
            n[i] && d.push(n[i][0]),
            n[i] = 0;
        for (t in s)
            Object.prototype.hasOwnProperty.call(s, t) && (x[t] = s[t]);
        for (c && c(a); d.length; )
            d.shift()();
        return _.push.apply(_, o || []),
        e()
    }
    function e() {
        for (var x, a = 0; a < _.length; a++) {
            for (var e = _[a], t = true, r = 1; r < e.length; r++) {
                var s = e[r];
                0 !== n[s] && (t = false)
            }
            t && (_.splice(a--, 1),
            x = i(i.s = e[0]))
        }
        return x
    }
    var t = {}
      , n = {
        0: 0
    }
      , _ = [];
    function i(a) {
        if (t[a])
            return t[a].exports;
        var e = t[a] = {
            i: a,
            l: false,
            exports: {}
        };
        return x[a].call(e.exports, e, e.exports, i),
        e.l = true,
        e.exports
    }
    i.m = x,
    i.c = t,
    i.d = function(x, a, e) {
        i.o(x, a) || Object.defineProperty(x, a, {
            enumerable: true,
            get: e
        })
    }
    ,
    i.r = function(x) {
        typeof Symbol !== "undefined" && Symbol.toStringTag && Object.defineProperty(x, Symbol.toStringTag, {
            value: "Module"
        }),
        Object.defineProperty(x, "__esModule", {
            value: true
        })
    }
    ,
    i.t = function(x, a) {
        if (1 & a && (x = i(x)),
        8 & a)
            return x;
        if (4 & a && typeof x === "object" && x && x.__esModule)
            return x;
        var e = Object.create(null);
        if (i.r(e),
        Object.defineProperty(e, "default", {
            enumerable: true,
            value: x
        }),
        2 & a && "string" != typeof x)
            for (var t in x)
                i.d(e, t, function(a) {
                    return x[a]
                }
                .bind(null, t));
        return e
    }
    ,
    i.n = function(x) {
        var a = x && x.__esModule ? function() {
            return x.default
        }
        : function() {
            return x
        }
        ;
        return i.d(a, "a", a),
        a
    }
    ,
    i.o = function(x, a) {
        return Object.prototype.hasOwnProperty.call(x, a)
    }
    ,
    i.p = "";
    var r = window.webpackJsonp = window.webpackJsonp || []
      , s = r.push.bind(r);
    r.push = a,
    r = r.slice();
    for (var o = 0; o < r.length; o++)
        a(r[o]);
    var c = s;
    _.push([119, 1]),
    e()
}([, , , function(x, a, e) {
    var t = e(226)
      , n = e(10)
      , _ = e(110)
      , i = e(227)
      , r = e(228)
      , s = e(230)
      , o = e(231)
      , c = e(232)
      , l = e(233)
      , d = e(16)
      , f = e(56)
      , u = e(239)
      , h = e(39)
      , v = {};
    v.devMode = true,
    v.events = new h,
    v.devMode ? (h.config.devtools = true,
    window.game = v,
    window.imageLoader = f) : document.body.oncontextmenu = function() {
        return false
    }
    ,
    v.renderer = _,
    v.usingWebGL = _.type === PIXI.RENDERER_TYPE.WEBGL,
    v.usingWebGL && n.showBackgroundImage && n.backgroundImageUrl && PIXI.Texture.from(n.backgroundImageUrl),
    v.state = {
        isAlive: false,
        isConnected: false
    },
    v.start = async function(x) {
        if (!(x.protocol && x.instanceSeed && x.playerId && x.border))
            throw "Lacking mandatory data";
        v.running = true,
        v.protocol = x.protocol,
        v.modeId = x.gameModeId || 0,
        v.instanceSeed = x.instanceSeed,
        v.pingstamp = 0,
        v.timestamp = 0,
        v.deltaTime = 0,
        v.playerId = x.playerId,
        v.spectating = false,
        v.state.isAlive = false,
        v.center = {
            x: 0,
            y: 0
        },
        v.score = 0,
        v.splitCount = 0,
        v.moveWaitUntil = 0,
        v.replaying = !!x.replayUpdates,
        v.replayUpdates = x.replayUpdates,
        v.replayUpdateIndex = 0,
        v.replay.updateHistory.length = 0,
        v.nodes = {},
        v.nodelist = [],
        v.removedNodes = [],
        v.oldNodes = {},
        v.rawMouse = {},
        v.mouse = {},
        v.stopMovement = false,
        v.border = x.border,
        v.setupZoom(v.border),
        l.createMassFont(),
        v.massTextPool = [],
        await v.setupStage(),
        u.prepareMode(v, v.modeId),
        v.playerManager = new r(v);
    }
    ,
    v.setupZoom = function(x) {
        v.zoom = .3,
        x.width === x.height ? v.zoomScale = 2e4 / x.width : v.zoomScale = 1,
        v.zoomMin = .03 * v.zoomScale
    }
    ,
    v.replayUpdate = async function() {
        if (v.replayUpdateIndex >= v.replayUpdates.length) {
            v.timestamp = 0;
            v.replayUpdateIndex = -1;
            v.clearNodes();
            v.renderer.clear();
            return;
        }

        await v.parseMessage(v.replayUpdates[v.replayUpdateIndex]);
        v.replayUpdateIndex++;
    }
    window.resetReplayIndex = () => {
        v.replayUpdateIndex = 1;
    }
    ,
    v.setupStage = async function() {
        var x = v.stage = new PIXI.Container
          , a = v.scene = new i(v.border);
        if (n.showBackgroundImage && n.backgroundImageUrl) {
            // v2.10: se o fundo falhar por qualquer motivo, o setBorder() e o resto
            // do palco NAO podem morrer com ele — sem isto, um erro aqui deixava
            // o video todo na cor de fundo (sem borda, sem textura, sem celulas).
            try {
                await a.setBackgroundImage(n.backgroundImageUrl, n.backgroundImageRepeat);
            } catch (e) {
                console.error("[BG] setBackgroundImage falhou: " + (e && e.message || e));
            }
        }
        a.setBorder(),
        x.addChild(a.container),
        v.cameraScale = v.zoom,
        v.camera = new t(v.scene.container),
        v.camera.scale.set(v.cameraScale),
        v.camera.position.set(0)
    }
    ,
    v.setupStats = function() {
        var x = v.stats = c()
        v.stage.addChild(x.container),
        v.everySecond = setInterval(()=>{
            x.fps.update(),
            x.score.set(v.score),
            v.ping()
        }
        , 1e3);
    }
    ,
    v.clearNodes = function() {
        for (; v.nodelist.length; )
            v.nodelist[0].destroy();

        v.nodes = {},
        v.nodelist = [],
        v.removedNodes = [],
        v.oldNodes = {},
        v.rawMouse = {},
        v.mouse = {};
    }
    ,
    v.stop = function() {
        for (v.running = false,
        v.renderer.clear(),
        f.clearCallbacks(),
        v.playerManager.destroy(),
        v.minimap && v.minimap.destroy(),
        delete v.minimap,
        v.leaderboard && v.leaderboard.destroy(),
        delete v.leaderboard,
        v.stats && v.stats.destroy(),
        delete v.stats,
        v.clearNodes(),
        v.scene && v.scene.destroyBackgroundImage(false),
        v.stage.destroy(true),
        d.cells.destroyCache(); v.massTextPool.length; )
            v.massTextPool.pop().destroy(true);
    }
    ,
    v.toggleOverlay = () => {}
    ,
    v.tick = async function(x) {
        v.deltaTime = x;
        v.timestamp += x;

        if ((v.replayUpdateIndex * 40 / 1000) <= v.timestamp) {
            await v.replayUpdate();
            if (v.replayUpdateIndex < 0)
                return;
        }

        v.updateNodes(v.replayUpdateIndex < 2);
        v.renderer.render(v.stage);

        if (v.replayUpdateIndex > 0) {
            // let startTime = Date.now();
            let buffer = window.targetCanvas.toDataURL('image/jpeg', 1);
            // ipcRenderer.send("debug", `${Date.now() - startTime}ms to get buffer`);
            return buffer;
        }
    }
    window.targetCanvas = v.renderer.view,
    window.tick = v.tick,
    v.updateNodes = function(teleportCamera) {
        for (var x = v.removedNodes.length; x--; ) {
            var a = v.removedNodes[x];
            a.update() && (a.destroySprite(),
            v.removedNodes.splice(x, 1))
        }
        var e = 0
          , t = 0
          , _ = 0
          , i = 0;
        if (v.nodelist.forEach(x=>{
            if (x.update(),
            x.pid === v.playerId) {
                var a = x.getMass();
                e += x.x * a,
                t += x.y * a,
                _ += a,
                i += x.nSize
            }
        }
        ),
        v.scene.sort(),
        v.spectating)
            e = v.center.x,
            t = v.center.y;
        else {
            if (!_)
                return;
            e /= _,
            t /= _,
            _ > v.score && (v.score = _)
        }
        var r = 1 - Math.exp(-n.cameraMoveSmoothing * v.deltaTime);   // v25: exact at any fps
        if (v.camera.position.x = teleportCamera ? e : lerp(v.camera.position.x, e, r),
        v.camera.position.y = teleportCamera ? t : lerp(v.camera.position.y, t, r),
        n.autoZoom) {
            var s = Math.min(64 / i, 1);
            v.cameraScale = v.zoom * Math.pow(s, .27) * window.innerWidth / 2200;
        } else
            v.cameraScale = v.zoom * window.innerWidth / 2200;
        var o = teleportCamera ? v.cameraScale : lerp(v.camera.scale.x, v.cameraScale, 1 - Math.exp(-n.cameraZoomSmoothing * v.deltaTime));
        v.camera.scale.set(o)
    }
    ,
    v.updateMouse = function() {
    }
    ,
    v.joinGame = () => {
    }
    ,
    v.seededRandom = function(x) {
        var a = 1e4 + v.instanceSeed
          , e = Math.sin(x) * a;
        return e - Math.floor(e)
    }
    ,
    v.getThumbnail = function() {
        var x = v.scene.container
          , a = new (PIXI.Container);
        a.pivot.x = x.position.x,
        a.pivot.y = x.position.y,
        a.position.x = 120,
        a.position.y = 67.5,
        a.scale.set(.25),
        a.addChild(x);
        var e = PIXI.RenderTexture.create(240, 135);
        v.renderer.render(a, e),
        v.stage.addChildAt(x, 0);
        var t = v.renderer.extract.canvas(e)
          , _ = document.createElement("canvas");
        _.width = 240,
        _.height = 135;
        var i = _.getContext("2d")
          , r = "#" + ("00000" + (0 | n.backgroundColor).toString(16)).substr(-6);
        i.beginPath(),
        i.rect(0, 0, 240, 135),
        i.fillStyle = r,
        i.fill(),
        i.drawImage(t, 0, 0, 240, 135);
        var s = _.toDataURL();
        return e.destroy(true),
        s
    }
    ,
    x.exports = v
}
, , , , , , , function(x, a) {
    var e = {
        skinsEnabled: "all",
        namesEnabled: "all",
        foodVisible: true,
        showMass: "short",
        showLocations: false,
        useWebGL: true,
        spawnTransparency: true,
        drawDelay: 120,
        cameraMoveSmoothing: 3.08,
        cameraZoomSmoothing: 9.05,
        cameraZoomSpeed: 30,
        eatAnimation: true,
        doubleResolution: true,
        cellBorderSize: 1,
        autoZoom: true,
        showChat: false,
        showBackgroundImage: true,
        backgroundImageUrl: "assets/bg.png",
        backgroundImageRepeat: true,
        backgroundImageOpacity: .6, // v2.10: 0.6 — o valor EXATO do jogo real (main.js do cliente vanis, linha 356)
        backgroundColor: 1052688, // v2.8: #101010 — igual ao jogo real (string2hex("101010"))
        backgroundDefaultIfUnequal: true
    };
    window.setSkinMode = mode => {
        settings.set("skinsEnabled", mode);
        process.stdout.write(`Setting skin mode to ${mode}\n`);
        if (game.playerManager)
            game.playerManager.reRenderPlayerTextures();
    };
    window.setNameMode = mode => {
        settings.set("namesEnabled", mode);
        process.stdout.write(`Setting name mode to ${mode}\n`);
        if (game.playerManager)
            game.playerManager.reRenderPlayerTextures();
    };
    window.setMassMode = mode => {
        settings.set("showMass", mode);
        process.stdout.write(`Setting mass mode to ${mode}\n`);
        if (game.playerManager)
            game.playerManager.reRenderPlayerTextures();
    };
    x.exports = window.settings = new class {
        constructor() {
            this.getInternalSettings(),
            this.userDefinedSettings = this.loadUserDefinedSettings(),
            Object.assign(this, e, this.userDefinedSettings)
        }
        getInternalSettings() {
            this.cellSize = 512,
            this.cellNamePadding = 350,
            this.cellRenderSize = this.cellSize + this.cellNamePadding,
            this.cellScaleRatio = this.cellRenderSize / this.cellSize
        }
        loadUserDefinedSettings() {
            if (localStorage.settings)
                try {
                    return JSON.parse(localStorage.settings)
                } catch (x) {
                    console.error("loadUserDefinedSettings:", x.message)
                }
            return {}
        }
        set(x, a) {
            return this[x] !== a && (this[x] = a,
            this.userDefinedSettings[x] = a,
            localStorage.settings = JSON.stringify(this.userDefinedSettings),
            true)
        }
    }
}
, , , , , , function(x, a, e) {
    var t = e(236)
      , n = e(237);
    x.exports = {
        cells: t,
        virus: n
    }
}
, , , , , , , function(x, a, e) {
    var t = e(3)
      , n = e(16)
      , _ = e(10);
    x.exports = class {
        constructor(x) {
            this.id = x.id || 0,
            this.oSize = this.size = x.size,
            this.cellScale = x.cellScale || 1,
            this.newPositionScale = 1,
            this.removed = false,
            this.destroyed = false,
            this.isProtected = false,
            this.lastUpdate = 0,
            this.texture = x.texture || n.cells.getTexture(0),
            this.sprite = new (PIXI.Sprite)(this.texture),
            this.sprite.anchor.set(.5),
            this.sprite.gameData = this,
            this.x = this.ox = this.sprite.position.x = x.x,
            this.y = this.oy = this.sprite.position.y = x.y
        }
        getRadius() {
            return this.size
        }
        getMass() {
            var x = this.nSize;
            return Math.floor(x * x / 100)
        }
        update() {
            if (0 == this.id || this.destroyed)
                console.warn("destroyed or id 0");
            else {
                let a = 1000 * (t.timestamp - this.lastUpdate) / 120;
                if (a = 0 > a ? 0 : 1 < a ? 1 : a,
                this.removed && (a >= 1 || this.texture.clearedFromCache))
                    return true;
                if (!this.sprite.texture || !this.sprite.texture.valid)
                    return console.warn("Cell with invalid texture, pid:", this.pid),
                    void (this.sprite.texture = n.cells.getTexture(0));
                this.size = a * (this.nSize - this.oSize) + this.oSize;
                var e = 2 * this.getRadius() * this.cellScale;
                this.sprite.width = this.sprite.height = e,
                this.sprite.position.x = this.x = a * this.newPositionScale * (this.nx - this.ox) + this.ox,
                this.sprite.position.y = this.y = a * this.newPositionScale * (this.ny - this.oy) + this.oy,
                this.onUpdate && this.onUpdate()
            }
        }
        destroy(x) {
            if (this.removed)
                console.warn("Cell already removed!");
            else {
                this.onDestroy && this.onDestroy();
                var a, e = t.nodelist, n = t.nodes;
                (a = e.indexOf(this)) >= 0 && e.splice(a, 1),
                delete n[this.id],
                this.removed = true,
                x ? t.removedNodes.push(this) : this.destroySprite()
            }
        }
        destroySprite() {
            this.sprite ? (this.sprite.destroy(),
            this.sprite = null) : console.warn("Sprite already destroyed!")
        }
    }
}
, function(x, a, e) {
    var t = e(259).mixin({
        animation: false,
        background: "#151515",
        confirmButtonColor: "#C97F11",
        cancelButtonColor: "#2b2b2b",
        customClass: "swal-custom"
    });
    x.exports = {
        alert: function(x) {
            t.fire({
                text: x,
                confirmButtonText: "OK"
            })
        },
        confirm: function(x, a) {
            var e = {
                text: x,
                showCancelButton: true,
                confirmButtonText: "Continue"
            };
            t.fire(e).then(x=>{
                x.value && a()
            }
            )
        },
        instance: t
    }
}
, , , , , , function(x, a, e) {
    var t = e(262);
    "string" == typeof t && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true,
        transform: void 0
    };
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(283);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true,
        transform: void 0
    };
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(286);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(288);
    "string" == typeof t && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(290);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(293);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(295);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(297);
    "string" == typeof t && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {
    var t = e(299);
    typeof t === "string" && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, , , , , , , , , , , , , , , , , , function(x, a) {
    var e = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
    function t() {}
    var cache = {};
    class ImageLoader {

        constructor(x, callback) {
            this.loading = true;
            this.success = null;
            this.error = null;
            this.callbacks = [callback];
            this.image = new Image;
            this.image.onload = this.onLoad.bind(this);
            this.image.onerror = this.image.onabort = this.onError.bind(this);
            if (/^https?:/i.test(x)) this.image.crossOrigin = "anonymous"; // v2.5: só para URLs externos — ficheiros locais não têm CORS
            this.image.src = x;
        }

        onLoad() {
            for (console.assert(this.image.complete),
            this.loading = false,
            this.success = true; this.callbacks.length; ) {
                this.callbacks.pop()(this.image);
            }
        }

        onError(err) {
            this.callbacks.forEach(cb => cb({}));
            this.callbacks = null;
            this.loading = false,
            this.error = err;
        }

        destroy() {
            this.callbacks = null,
            this.image.onload = null,
            this.image.onerror = null,
            this.image.src = e,
            this.image = null
        }
    }
    x.exports = {
        loadImage: function(url, callback) {
            var e = cache[url];
            if (e) {
                if (!e.loading)
                    return e.success ? (console.assert(e.image.complete),
                    callback(e.image),
                    t) : (console.assert(e.error),
                    t);
                e.callbacks.push(callback)
            } else
                e = cache[url] = new ImageLoader(url, callback);
            return function() {
                if (Array.isArray(e.callbacks)) {
                    var x = e.callbacks.indexOf(callback);
                    x >= 0 && e.callbacks.splice(x, 1);
                }
            }
        },
        clearCache: function() {
            for (var x in cache)
                cache[x].destroy();
            cache = {},
            console.warn("images cleared")
        },
        clearCallbacks: function() {
            for (var x in cache)
                cache[x].callbacks = []
        },
        getCache: function() {
            return cache
        }
    }
}
, function(x, a, e) {
    var t = e(3)
      , n = {
        respawn: function() {
            t.joinGame(),
            t.toggleOverlay(false)
        },
        feed: t.actions.feed.bind(null),
        feedMacro: t.actions.feed.bind(null, true),
        split: t.actions.split.bind(null, 1),
        splitx2: t.actions.split.bind(null, 2),
        splitx3: t.actions.split.bind(null, 3),
        splitMax: t.actions.split.bind(null, 4),
        linesplit: t.actions.linesplit,
        stopMovement: function() {
            t.stopMovement = !t.stopMovement
        },
        toggleSkins: t.actions.toggleSkins,
        toggleNames: t.actions.toggleNames,
        toggleFood: t.actions.toggleFood,
        spectateLock: t.actions.spectateLockToggle,
        selectPlayer: t.actions.targetPlayer.bind(null, true),
        saveReplay: t.replay.save,
        zoomLevel1: t.actions.setZoomLevel.bind(null, 1),
        zoomLevel2: t.actions.setZoomLevel.bind(null, 2),
        zoomLevel3: t.actions.setZoomLevel.bind(null, 3),
        zoomLevel4: t.actions.setZoomLevel.bind(null, 4),
        zoomLevel5: t.actions.setZoomLevel.bind(null, 5)
    }
      , _ = {
        feed: "W",
        feedMacro: "MOUSE0",
        split: "SPACE",
        splitx2: "G",
        splitx3: "H",
        splitMax: "T",
        linesplit: "Z",
        respawn: "",
        stopMovement: "",
        toggleSkins: "",
        toggleNames: "",
        toggleFood: "",
        spectateLock: "Q",
        selectPlayer: "MOUSE1",
        saveReplay: "R",
        toggleChat: "",
        zoomLevel1: "1",
        zoomLevel2: "2",
        zoomLevel3: "3",
        zoomLevel4: "4",
        zoomLevel5: "5"
    };
    x.exports = window.hotkeys = new class {
        constructor() {
            this.version = 2,
            this.pressHandlers = null,
            this.releaseHandlers = null,
            this.resetObsoleteHotkeys(),
            this.load()
        }
        resetObsoleteHotkeys() {
            localStorage.hotkeysVersion != this.version && (localStorage.hotkeys && (console.log("Incompatible hotkeys"),
            localStorage.removeItem("hotkeys")),
            localStorage.hotkeysVersion = this.version)
        }
        load() {
            this.hotkeys = this.loadHotkeys(),
            this.loadHandlers(this.hotkeys)
        }
        loadHotkeys() {
            var x = Object.assign({}, _);
            if (localStorage.hotkeys) {
                var a = JSON.parse(localStorage.hotkeys);
                Object.assign(x, a)
            }
            return x
        }
        saveHotkeys(x) {
            localStorage.hotkeys = JSON.stringify(x)
        }
        reset() {
            return localStorage.removeItem("hotkeys"),
            this.load(),
            this.hotkeys
        }
        get() {
            return this.hotkeys
        }
        set(x, a) {
            if (n[x]) {
                if (this.hotkeys[x] === a)
                    return true;
                for (var e in this.hotkeys)
                    this.hotkeys[e] === a && (this.hotkeys[e] = "");
                return this.hotkeys[x] = a,
                this.saveHotkeys(this.hotkeys),
                this.loadHandlers(this.hotkeys),
                true
            }
            console.log("Invalid action name", x)
        }
        loadHandlers(x) {
            this.pressHandlers = {},
            Object.keys(x).forEach(a=>{
                var e = n[a];
                if (e) {
                    var t = x[a];
                    this.pressHandlers[t] = e
                } else
                    console.warn("Invalid action in hotkeys", a)
            }
            ),
            this.releaseHandlers = {},
            x.feedMacro && (this.releaseHandlers[x.feedMacro] = t.actions.feed.bind(null, false))
        }
        press(x) {
            var a = this.pressHandlers[x];
            return !!a && (a(),
            true)
        }
        release(x) {
            var a = this.releaseHandlers[x];
            a && a()
        }
        convertKey(x) {
            return " " === x ? "SPACE" : x.toString().toUpperCase()
        }
    }
}
, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function(x, a, e) {
    var t = e(10);
    PIXI.utils.skipHello();
    var n = document.getElementById("canvas")
      , _ = {
        resolution: t.customResolution || window.devicePixelRatio || 1,
        view: n,
        forceCanvas: !t.useWebGL,
        antialias: false,
        backgroundColor: t.backgroundColor
    }
      , i = PIXI.autoDetectRenderer(_);
    window.resizeRenderer = i.resize.bind(i);
    i.plugins.interaction.destroy(),
    i.clear(),
    console.log(i.type === PIXI.RENDERER_TYPE.WEBGL ? "WebGL Renderer" : "Canvas Renderer"),
    x.exports = i
}
, function(x, a) {
    a.neon = [16776960, 65280, 65535, 16711935],
    a.basic = [16711680, 16744448, 16776960, 8453888, 65280, 65408, 65535, 33023, 8323327, 16711935, 16711807],
    a.hsl15 = [16711680, 16728064, 16744448, 16760576, 16776960, 12582656, 8453888, 4259584, 65280, 65344, 65408, 65471, 65535, 49151, 32767, 16639, 255, 4194559, 8323327, 12517631, 16711935, 16711871, 16711808, 16711744]
}
, function(x, a) {
    x.exports = {
        initialData: function(x) {
            var a = 1
              , e = {
                border: {}
            };
            return e.protocol = x.getUint8(a, true),
            a += 1,
            e.protocol >= 2 ? (e.gameModeId = x.getUint8(a, true),
            a += 1,
            e.instanceSeed = x.getUint16(a, true),
            a += 2,
            e.playerId = x.getUint16(a, true),
            a += 2,
            e.border.width = x.getUint32(a, true),
            a += 4,
            e.border.height = x.getUint32(a, true),
            a += 4) : function() {
                e.instanceSeed = x.getUint16(a, true),
                a += 2,
                e.playerId = x.getUint16(a, true),
                a += 2;
                var t = x.getUint16(a, true);
                a += 2,
                e.border.width = t,
                e.border.height = t
            }(),
            e
        }
    }
}
, , , , , , , function(x, a, e) {
    "use strict";
    e.r(a);
    var t = e(120)
      , n = (e.n(t),
    e(222))
      , _ = (e.n(n),
    e(223));
    e.n(_);
    e(3),
    e(242),
    e(244),
    e(245),
    e(257),
    e(260),
    e(302),
    e(300),
    e(301)
}
, , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , , function(x, a, e) {
    (function(x) {
        x.prepareData = function(x) {
            return new DataView(new ArrayBuffer(x))
        }
        ,
        Number.prototype.clamp = function(x, a) {
            return Math.min(Math.max(this, x), a)
        }
        ,
        x.lerp = function(x, a, e) {
            return (1 - e) * x + e * a
        }
        ,
        x.htmlEncode = function(x) {
            return x = x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;")
        }
    }
    ).call(this, e(12))
}
, function(x, a, e) {
    var t = e(224);
    "string" == typeof t && (t = [[x.i, t, ""]]);
    var n = {
        hmr: true
    };
    n.transform = void 0,
    n.insertInto = void 0;
    e(11)(t, n);
    t.locals && (x.exports = t.locals)
}
, function(x, a, e) {}
, , function(x, a) {
    x.exports = class {
        constructor(x) {
            this.position = x.pivot,
            this.scale = x.scale
        }
    }
}
, function(x, a, e) {
    var t = e(10);
    const Loader = e(56);
    x.exports = class {
        constructor(x) {
            this.border = x,
            this.container = new (PIXI.Container),
            this.background = new (PIXI.Container),
            this.foreground = new PIXI.Container,
            this.container.addChild(this.background, this.foreground),
            this.food = new (PIXI.Container),
            this.food.visible = t.foodVisible,
            this.backgroundGraphics = new (PIXI.Container),
            this.backgroundGraphics.visible = false,
            this.background.addChild(this.backgroundGraphics),
            this.background.addChild(this.food),
            this.setPosition();
        }
        setPosition() {
            this.container.position.x = window.innerWidth  / 2;
            this.container.position.y = window.innerHeight / 2;
        }
        sort() {
            this.foreground.children.sort(function(x, a) {
                return x = x.gameData,
                a = a.gameData,
                x.size === a.size ? x.id - a.id : x.size - a.size
            })
        }
        addCell(x) {
            this.foreground.addChild(x)
        }
        addFood(x) {
            this.food.addChild(x)
        }
        setBorder() {
            var x = this.border.width
              , a = this.border.height
              , e = x / 2
              , t = a / 2
              , n = new (PIXI.Graphics);
            n.lineStyle(45, 0, 1, .5),
            n.drawRect(0, 0, x, a),
            n.endFill(),
            n.position.set(-e, -t),
            this.background.addChild(n),
            // v2.10: confirma nos logs do Actions que a borda foi desenhada
            console.log("[BG] setBorder desenhado: " + x + "x" + a + " (linha preta 45px)")
        }
        toggleBackgroundImage(x) {
            x && !this.backgroundSprite ? this.setBackgroundImage(t.backgroundImageUrl, t.backgroundImageRepeat) : x || this.destroyBackgroundImage(true)
        }
        async setBackgroundImage(x, a) {
            if (this.border.width !== this.border.height && t.backgroundDefaultIfUnequal && (x = "assets/bg.png",
            a = true),
            x) {
                // v2.10: o ImageLoader devolve {} (truthy!) quando o carregamento
                // falha — validar naturalWidth em vez de confiar no truthy.
                let img = await new Promise(resolve => Loader.loadImage(x, resolve)).catch(console.error);

                if (!img || !img.naturalWidth) {
                    console.log("[BG] '" + x + "' nao carregou (img=" + (img && img.naturalWidth) + ") — a usar a textura EMBUTIDA do jogo");
                    x = window.VANIS_BG_DATA_URI;
                    img = await new Promise(resolve => Loader.loadImage(x, resolve)).catch(console.error);
                }
                if (!img || !img.naturalWidth) {
                    console.error("[BG] nem a textura embutida carregou — o fundo fica sem padrao");
                    return;
                }
                console.log("[BG] textura ok: " + img.naturalWidth + "x" + img.naturalHeight + " (fonte: " + (x === window.VANIS_BG_DATA_URI ? "data URI embutida" : x) + ")");

                var e = this.border.width
                  , n = this.border.height
                  , _ = new (PIXI.Texture)(new (PIXI.BaseTexture)(img));

                if (this.backgroundSprite && this.destroyBackgroundImage(this.backgroundSprite.texture !== _),
                a)
                    var i = new (PIXI.extras.TilingSprite)(_,e,n);
                else
                    (i = new (PIXI.Sprite)(_)).width = e,
                    i.height = n;
                i.anchor.set(.5),
                this.background.addChildAt(i, 0),
                this.backgroundSprite = i,
                this.backgroundSprite.alpha = t.backgroundImageOpacity
            }
        }
        destroyBackgroundImage(x) {
            this.backgroundSprite && (this.backgroundSprite.destroy(!!x),
            this.backgroundSprite = null)
        }
        clear() {
            this.foreground.removeChildren(),
            this.food.removeChildren()
        }
        destroy() {
            this.container.destroy(true)
        }
    }
}
, function(x, a, e) {
    var t = e(229);
    x.exports = class {
        constructor(x) {
            this.game = x,
            this.players = {}
        }
        getPlayer(x) {
            var a = this.players[x] || null;
            return a || console.warn("Trying to get non-existing player", x),
            a
        }
        addPlayer(x) {
            return this.players[x] && console.error("Player already exists", x),
            this.players[x] = new t(this.game,x),
            this.players[x]
        }
        async setPlayerData(x, a, e, tag, nameColor) {
            var n = this.players[x];
            n || (n = this.players[x] = new t(this.game,x));
            
            n.setNameColor(nameColor);
            n.setName(a);
            await n.setSkin(e);
            n.setTag(tag);
            this.game.renderer.type === PIXI.RENDERER_TYPE.CANVAS ? setTimeout(n.render.bind(n)) : n.render();
            return n;
        }
        delayedRemovePlayer(x) {
            var a = this.players[x]
              , e = this.game.replay.updateHistory[0];
            a && (e ? a.lastUpdate && a.lastUpdate.packetId >= e.packetId ? a.lastUpdate.clearWhenShifted.push(x) : this.removePlayer(x) : this.removePlayer(x))
        }
        removePlayer(x) {
            var a = this.players[x];
            a && (a.clearCachedData(),
            delete this.players[x])
        }
        destroy() {
            for (var x in this.players)
                this.removePlayer(x)
        }
        reRenderPlayerTextures() {
            for (var x in this.players)
                this.players[x].render()
        }
    }
}
, function(x, a, e) {
    var t = e(10)
      , n = e(56)
      , _ = e(111).basic
      , i = t.cellSize
      , r = {
        fontFamily: "Ubuntu", // v2.4: era "Hind Madurai" (webfont nao carregada no runner — caia para DejaVu)
        fontSize: 80,
        lineJoin: "round",
        fill: 16777215,
        stroke: true,
        strokeThickness: 8
    };
    function s(x) {
        x = x || 0;
        var a = new (PIXI.Graphics);
        return a.lineStyle(t.cellBorderSize, 0, .5),
        a.beginFill(x),
        a.drawCircle(0, 0, t.cellSize / 2),
        a.endFill(),
        a
    }
    x.exports = class {
        constructor(x, a) {
            this.game = x,
            this.pid = a,
            this.nameColor = x.playerId && x.playerId === a ? 16747520 : 16777215,
            this.cellColor = this.getCellColor(),
            this.cellSprite = null,
            this.skinSprite = null,
            this.skinMaskSprite = null,
            this.nameSprite = null,
            this.abortSkinLoader = null,
            this.sprites = new PIXI.Container,
            this.sprites.pivot.set(-i / 2),
            this.texture = PIXI.RenderTexture.create(i, i)
        }

        setName(x) {
            this.name = x || "Unnamed",
            this.unnamedEmptyName = this.name === "Unnamed" ? "" : this.name,
            this.setNameSprite(this.unnamedEmptyName);
        }

        setNameSprite(x) {
            if (t.namesEnabled == "none") {
                if (this.nameSprite) this.nameSprite.destroy();
                return;
            }            
            this.nameSprite ? this.nameSprite.text = x : this.nameSprite = new PIXI.Text(x,r),
            this.applyNameColor(),
            this.nameSprite.updateText()
        }

        // v25 colored-name perk: players JSON carries nameColor ("ff9933" / "#ff9933")
        setNameColor(c) {
            var v = null;
            if (typeof c === "string") {
                var m = /^#?([0-9a-fA-F]{6})$/.exec(c.trim());
                if (m) v = parseInt(m[1], 16);
            } else if (typeof c === "number" && c >= 0 && c <= 16777215) v = c;
            this.customNameColor = v;
            this.applyNameColor();
        }

        applyNameColor() {
            if (!this.nameSprite) return;
            var fill = this.customNameColor != null ? this.customNameColor : 16777215;
            if (this.nameSprite.style.fill !== fill) {
                this.nameSprite.style.fill = fill;
                this.nameSprite.updateText();
            }
        }

        async setSkin(x) {
            this.skinUrl = x || "",
            this.skinSprite && (this.skinSprite.destroy(true),
            this.skinSprite = null),
            this.skinMaskSprite && (this.skinMaskSprite.destroy(),
            this.skinMaskSprite = null);
            if (this.skinUrl) await this.loadSkin();
        }

        setTag(tag) {
            if (tag) {
                this.tag = tag;
                this.render();
            }
        }

        loadSkin() {
            // v2.11d: promessa que so resolve quando a textura da skin ESTA
            // aplicada (ou falhou a valer) — o waitForSkins() aguarda-a.
            var done;
            this._skinDone = new Promise(r => { done = r; });
            setTimeout(done, 9000);   // failsafe: nunca bloquear para sempre
            
            return new Promise(async resolve => {
                try {
                    // console.log(`Loading Skin: ${this.skinUrl}`);
                    // v2.11: the Roblox client saves skins as Roblox assets
                    // ("rbxassetid://<id>"). A browser cannot fetch that scheme, and
                    // the real PNG behind the id lives on rbxcdn, which sends no CORS
                    // headers (ImageLoader sets crossOrigin=anonymous for https since
                    // v2.5) - the skin silently never appeared in the rendered videos.
                    // The MAIN process (Node, no CORS restrictions) resolves the id to
                    // a data URI through thumbnails.roblox.com (ipcMain.handle
                    // "vanis-skin" in App.js). If the lookup fails the cell keeps its
                    // plain colour - exactly like a broken web skin URL today.
                    let skinSrc = this.skinUrl;
                    const RBX_SKIN = /^rbxassetid:\/\/(\d+)/i.exec(skinSrc || "");
                    if (RBX_SKIN) {
                        // v2.11b: up to 3 IPC attempts, 1.5 s apart. The thumbnails
                        // API is rate limited to ~1 req/s PER IP and GitHub Actions
                        // runners share egress IPs, so the first attempt can 429 —
                        // a silent single attempt turned into "skins missing" with
                        // no trace in the log. Every failure now prints a [skins]
                        // warning and the render prints a one-line summary.
                        let du = null, handlerMissing = false;
                        for (let at = 0; at < 3 && !du; at++) {
                            try { du = await ipcRenderer.invoke("vanis-skin", RBX_SKIN[1]); }
                            catch (errSkin) {
                                // a THROWN invoke means the main process has no
                                // "vanis-skin" handler => render/src/App.js is an
                                // older file. Retrying cannot help.
                                handlerMissing = true;
                                break;
                            }
                            if (!(typeof du === "string" && du.slice(0, 5) === "data:")) du = null;
                            if (!du && at < 2) await new Promise(r => setTimeout(r, 1500));
                        }
                        try {
                            window.__skinStats = window.__skinStats || { requested: 0, resolved: 0 };
                            window.__skinStats.requested++;
                            if (du) window.__skinStats.resolved++;
                        } catch (_st) {}
                        if (handlerMissing)
                            console.warn("[skins] main process has NO 'vanis-skin' handler (App.js is old) — update render/src/App.js. id " + RBX_SKIN[1]);
                        if (typeof du === "string" && du.slice(0, 5) === "data:") {
                            skinSrc = du;
                        } else {
                            if (!handlerMissing)
                                console.warn("[skins] asset " + RBX_SKIN[1] + " NOT resolved after 3 attempts (API rate limit / moderated / offline) — cell keeps plain colour");
                            done();
                            resolve();
                            return;
                        }
                    }
                    let abort = n.loadImage(skinSrc, x => {
                        if (!(x.naturalWidth > 2048 || x.naturalHeight > 2048)) {
                            var a = new (PIXI.BaseTexture)(x)
                            , e = new (PIXI.Texture)(a);
                            
                            this.skinMaskSprite || (this.skinMaskSprite = s())
                            this.skinSprite || (this.skinSprite = new (PIXI.Sprite),
                            this.skinSprite.width = this.skinSprite.height = t.cellSize,
                            this.skinSprite.anchor.set(.5),
                            this.skinSprite.mask = this.skinMaskSprite);
                            this.skinSprite.texture = e;
                            this.renderTexture();
                        }
                        done();
                        resolve();
                    });
                    setTimeout(abort, 5000);
                } catch (e) { 
                    done();
                    resolve(); 
                } finally {
                    resolve();
                };
            });
        }

        render() {
            if (this.texture.valid) {
                this.sprites.removeChildren();

                if (!this.cellSprite) {
                    this.cellSprite = s(this.cellColor);
                }
                this.sprites.addChild(this.cellSprite);
                
                if (!this.skinMaskSprite) {
                    this.skinMaskSprite = s();
                }
                this.sprites.addChild(this.skinMaskSprite);
                
                if (!this.skinSprite) {
                    this.skinSprite = new (PIXI.Sprite);
                    this.skinSprite.width = this.skinSprite.height = t.cellSize,
                    this.skinSprite.anchor.set(.5),
                    this.skinSprite.mask = this.skinMaskSprite;
                }

                if (t.skinsEnabled == "none" || 
                        (t.skinsEnabled == "me" &&  this.pid != this.game.playerId) ||
                        (t.skinsEnabled == "tag" &&  this.tag != this.game.myTag)) {
                    // console.log(`Not rendering ${this.name} because ${t.skinsEnabled}`, this.isMe, this.tag);
                } else {
                    this.sprites.addChild(this.skinSprite);
                }

                this.renderTexture();
            }
        }

        renderTexture() {
            this.texture.valid ? this.game.renderer.render(this.sprites, this.texture, true) : console.warn("Trying to render to destroyed/invalid players texture")
        }

        getCellColor() {
            var x = this.game.seededRandom(this.pid)
              , a = Math.floor(x * _.length);
            return _[a]
        }

        clearCachedData() {
            this.texture.destroy(true),
            this.texture.clearedFromCache = true,
            this.game.minimap && this.game.minimap.destroyNode(this.pid),
            this.cellSprite && this.cellSprite.destroy(true),
            this.nameSprite && this.nameSprite.destroy(true),
            this.skinSprite && this.skinSprite.destroy(true),
            this.skinMaskSprite && this.skinMaskSprite.destroy(true);
        }
    }
}
, function(x, a) {
    function e(x, a, e) {
        return new (PIXI.Text)(x,{
            fontFamily: "Ubuntu", // v2.4: era "Verdana" (nao existe no runner)
            fontSize: a,
            lineJoin: "round",
            fill: e || 16777215
        })
    }
    x.exports = class {
        constructor(x) {
            this.game = x,
            this.titleSize = 22,
            this.fontSize = 18,
            this.lineHeight = this.fontSize + 4,
            this.padding = 15,
            this.maxNameCount = 10,
            this.width = 240,
            this.height = this.maxNameCount * this.lineHeight + 3 * this.padding + this.titleSize,
            this.setup()
        }
        setup() {
            this.create(),
            this.setPosition()
        }
        create() {
            var x = this.container = new (PIXI.Container)
              , a = new (PIXI.Graphics);
            a.beginFill(0),
            a.drawRect(0, 0, this.width, this.height),
            a.alpha = .6,
            this.nameContainer = this.createNameContainer(),
            x.addChild(a, this.createTitle(), this.nameContainer),
            this.game.stage.addChild(x)
        }
        createTitle() {
            var x = e("Leaderboard", this.titleSize);
            return x.position.set(this.padding),
            x
        }
        createNameContainer() {
            var x = new (PIXI.Container);
            x.position.x = this.padding,
            x.position.y = 2 * this.padding + this.titleSize;
            for (var a = 0; a < this.maxNameCount; a++) {
                var t = e("", this.fontSize);
                t.position.y = a * this.lineHeight,
                x.addChild(t)
            }
            return x
        }
        receiveUpdate(x) {
            for (var a = 1, e = 0; ; ) {
                var t = x.getUint16(a, true);
                if (a += 2,
                !t)
                    break;
                var n = this.nameContainer.children[e++];
                if (!n) {
                    console.error("Invalid name text", e, n);
                    break
                }
                var _ = this.game.playerManager.getPlayer(t);
                _ ? (n.text = e + ". " + _.name,
                n.visible = true) : n.visible = false
            }
            for (; e < this.nameContainer.children.length; )
                this.nameContainer.children[e].visible = false,
                e++
        }
        setPosition() {
            var x = this.game.renderer;
            this.container.position.x = x.width / x.resolution - this.width
        }
        destroy() {
            this.container.destroy(true)
        }
    }
}
, function(x, a) {
    var e = {
        size: 240,
        smoothing: .03
    };
    x.exports = class {
        constructor(x) {
            this.game = x,
            this.nodes = {},
            this.size = e.size,
            this.setup()
        }
        setup() {
            var x = this.container = new (PIXI.Container)
              , a = new PIXI.Container
              , e = new PIXI.Graphics;
            e.beginFill(0),
            e.alpha = .6,
            e.drawRect(0, 0, this.size, this.size),
            x.addChild(e, a),
            x.pivot.set(this.size),
            this.playerContainer = a,
            this.game.stage.addChild(x),
            this.setPosition()
        }
        createNode(x, a, e) {
            this.nodes[x] && this.destroyNode(x);
            var t = new (PIXI.Container);
            t.newPosition = {};
            var n = new (PIXI.Graphics);
            if (n.beginFill(e),
            n.drawCircle(0, 0, 5),
            n.endFill(),
            t.addChild(n),
            a) {
                var _ = new PIXI.Text(a,{
                    fontFamily: "Ubuntu", // v2.4: era "Nunito" (webfont nao carregada no runner)
                    fill: 16777215,
                    fontSize: 12
                });
                _.anchor.set(.5),
                _.pivot.y = 15,
                t.addChild(_)
            }
            this.nodes[x] = t
        }
        destroyNode(x) {
            var a = this.nodes[x];
            a ? a.destroy(true) : console.log("MM destroyNode: node doesnt exist", x)
        }
        receiveUpdate(x) {
            var a = 1;
            for (this.playerContainer.removeChildren(); ; ) {
                var e = x.getUint16(a, true);
                if (a += 2,
                !e)
                    break;
                var t = this.nodes[e];
                t ? (t.newPosition.x = x.getUint8(a, true) / 255 * this.size,
                a += 1,
                t.newPosition.y = x.getUint8(a, true) / 255 * this.size,
                a += 1,
                this.playerContainer.addChild(t)) : (console.warn("MM update: player or its minimap node not found"),
                a += 2)
            }
        }
        setPosition() {
            var x = this.game.renderer;
            this.container.position.x = x.width / x.resolution,
            this.container.position.y = x.height / x.resolution
        }
        render() {
            for (var x = this.playerContainer.children, a = 0, t = x.length; a < t; a++) {
                var n = x[a];
                n.position.x = lerp(n.position.x, n.newPosition.x, e.smoothing),
                n.position.y = lerp(n.position.y, n.newPosition.y, e.smoothing)
            }
        }
        destroy() {
            this.container.destroy(true)
        }
    }
}
, function(x, a) {
    var e = 16
      , t = 16777215;
    x.exports = function() {
        var x = function() {
            var x = new PIXI.Text("",{
                fill: t,
                fontSize: e
            });
            return {
                set: function(a) {
                    a ? x.text = "Score: " + a : x.text = ""
                },
                text: x,
                destroy: function() {
                    x.destroy(true)
                }
            }
        }()
          , a = function() {
            var x = 0
              , a = 0
              , n = new (PIXI.Text)("",{
                fill: t,
                fontSize: e
            });
            return {
                set: function(e) {
                    x += e,
                    a++
                },
                text: n,
                update: function() {
                    var e = x / a;
                    n.text = "FPS: " + Math.floor(e),
                    x = a = 0
                },
                destroy: function() {
                    n.destroy(true)
                }
            }
        }()
          , n = function() {
            var x = new (PIXI.Text)("",{
                fill: t,
                fontSize: e
            });
            return {
                set: function(a) {
                    x.text = "Ping: " + a + " ms"
                },
                text: x,
                destroy: function() {
                    x.destroy(true)
                }
            }
        }()
          , _ = new (PIXI.Container);
        return _.position.set(10),
        _.addChild(x.text, a.text, n.text),
        n.text.position.y = 20,
        x.text.position.y = 40,
        {
            score: x,
            fps: a,
            ping: n,
            container: _,
            destroy: function() {
                var e = _.parent;
                e && e.removeChild(_),
                x.destroy(),
                a.destroy(),
                n.destroy()
            }
        }
    }
}
, function(x, a, e) {
    var t = e(234)
      , n = e(235)
      , _ = new Image;
    _.src = n,
    x.exports = {
        createMassFont: function() {
            var x = new (PIXI.BaseTexture)(_)
              , a = new PIXI.Texture(x)
              , e = (new DOMParser).parseFromString(t, "text/xml");
            PIXI.extras.BitmapText.registerFont(e, a)
        }
    }
}
, function(x, a) {
    x.exports = `<?xml version="1.0"?>
<font>
  <info face="Mass Font" size="75" bold="1" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1" outline="3"/>
  <common lineHeight="73" base="60" scaleW="256" scaleH="256" pages="1" packed="0" alphaChnl="1" redChnl="0" greenChnl="0" blueChnl="0"/>
  <pages>
    <page id="0" file="mass_0.png" />
  </pages>
  <chars count="12">
    <char id="46" x="151" y="49" width="18" height="17" xoffset="-2" yoffset="47" xadvance="15" page="0" chnl="15" />
    <char id="48" x="38" y="0" width="38" height="49" xoffset="-2" yoffset="15" xadvance="34" page="0" chnl="15" />
    <char id="49" x="227" y="0" width="27" height="47" xoffset="1" yoffset="16" xadvance="34" page="0" chnl="15" />
    <char id="50" x="151" y="0" width="37" height="48" xoffset="-2" yoffset="15" xadvance="34" page="0" chnl="15" />
    <char id="51" x="77" y="0" width="36" height="49" xoffset="-2" yoffset="15" xadvance="34" page="0" chnl="15" />
    <char id="52" x="74" y="50" width="39" height="47" xoffset="-3" yoffset="16" xadvance="34" page="0" chnl="15" />
    <char id="53" x="38" y="50" width="35" height="48" xoffset="-1" yoffset="16" xadvance="34" page="0" chnl="15" />
    <char id="54" x="189" y="0" width="37" height="48" xoffset="-1" yoffset="16" xadvance="34" page="0" chnl="15" />
    <char id="55" x="114" y="50" width="36" height="47" xoffset="-1" yoffset="16" xadvance="34" page="0" chnl="15" />
    <char id="56" x="114" y="0" width="36" height="49" xoffset="-1" yoffset="15" xadvance="34" page="0" chnl="15" />
    <char id="57" x="0" y="53" width="37" height="48" xoffset="-2" yoffset="15" xadvance="34" page="0" chnl="15" />
    <char id="107" x="0" y="0" width="37" height="52" xoffset="0" yoffset="11" xadvance="34" page="0" chnl="15" />
  </chars>
</font>
`
}
, function(x, a) {
    x.exports = "data:image/png;base64,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"
}
, function(x, a, e) {
    var t = e(10)
      , n = e(110)
      , _ = {};
    x.exports = {
        getTexture: function(x) {
            var a = _[x];
            return a || (_[x] = function(x) {
                var a = t.cellSize
                  , e = a / 2
                  , _ = function(x, a) {
                    var e = new (PIXI.Graphics);
                    return e.beginFill(a),
                    e.drawCircle(0, 0, x),
                    e.endFill(),
                    e
                }(e, x);
                _.position.set(e);
                var i = PIXI.RenderTexture.create(a, a);
                return n.render(_, i),
                i
            }(x))
        },
        destroyCache: function() {
            for (var x in _)
                _[x].destroy(true),
                delete _[x]
        }
    }
}
, function(x, a, e) {
    var t = new Image;
    t.src = e(238);
    var n = _();
    function _() {
        var x = new (PIXI.BaseTexture)(t);
        return new (PIXI.Texture)(x)
    }
    x.exports = {
        getTexture: function() {
            return n.valid && n || (n = _())
        }
    }
}
, function(x, a) {
    x.exports = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOkc5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAqqBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlLOW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZarnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUFK4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1+1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuWTPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO/PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7JvttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTradox7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nuer21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72Xcn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT+R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAgY0hSTQAAeiUAAICDAAD5/wAAgOkAAHUwAADqYAAAOpgAABdvkl/FRgAAGkRJREFUeNrsnXm8VlW5x7/vGQDlMIgiigOgoqZQIjlrgmnZBKl5u1ct5zRn8VoWpDlnpEZoOZOal3srTb3dW93MUlFUBDQFTUNUJlFQpsN8zrp/PM/78fVlrz29+5yzN+f5fj7rc+Dde6+991rPb6/5WSWHkSOu1L9XWFK0Ey5cAQ2WQjVTArL4zlwNjNN/1wE/yNGzdWIBWagldHcww8HZDko1xHOtk29ZZbiuhvhK+kwz9Bktr3zBudBgCVRb+FmFQT/uYFCKOK4PEEc53JAivkH6LOU4Jlo+mUA6Iox00Fpl0KscnOegLmYc40PEUQ7jY8ZVp/deVXV9q4MjLL9MIO0ZejiYG2LUTzgYHBHHjTHEUQ43RsS1m97Td/1cfWbLOxNIu4Q7Yhj1agdjAkqTkoObE4ijHCYEtHPqHFzsoDnG9XdavplA4oYBDrZLee3nA6pWYeEZB3tWiGNCCnFUtifKItnDwdMJrm11cHTKd95O08wE0knCrxysd/BrrZ/H7YHq7WBeCsNe4+A7Dm6tQRzlcKuDS7WESnrtPAdbJegJG6lptN7BAyaQzhH6OVhXZTivaVUlynh+mYGBh4UnHZyrf9vqHvdGvONWDi7SNKm8bl0Npa4JpEBhXES7YZKDAwKuGxVheAsdrKjBcKc5GO1ghP6dVkNcK/R5fMdHB7zfAfruYSXTOBPI5h0aHLwT08hmOPiWgyYHfRwsCjn3AwfH6Nd/VgqDfl4FOKIijHLwXIq4ZulzHKPPFXTOIgdb67udqe8at4rW0JkEUupk8xCOA36b8JoVwDvAkJBzxgJTNc27AScCXwWaYsT/PHANsDLgWJNOPzkgRjyrgIeBB4C1Os3kQOA6z/mvADsBvRKmx/Ep0rCwc7E6m0D+CozIOM4/AzcALVW/DwFOAYaHXPsscK0at48mFeCBIefMACap0VdSD3wXOCrD9/0bMNIEsvmxlxpQKcM4FwAXAB94jncHRgOnBkwMfVZLjuYY9+muIjmo6veNKoxHQuLpA/wM2CHD994bmN0ZBFLXiUqPcz3icAFf/7jcDnwYcrwZmAycA8ys+P1pLTmaY96nWc9/quK3FzXeyRHxfAjclvL9WgieDXxeZzGaIpYgvbRdkOTRe+rXPqhNsBy4Sv8eC3wxZpx/AG7Sr3gcugPHANsCd+k7JKUHcCbwPvBQAoE1ABcneLf/1fh7AZcHtFNWaftlWYq8W25VrLblYeBw/YLO1Pr3TOC1kJLgfK1mBDETuEQF16hiOgg4DdjKc81c4FJgacJnr9N2wYYa3r9R37M14XV9gJ8Ag0JKmnu0s2GFPmNJr9k34PwLgImeuOqBPYFhGvYF9gGe1CqnCaQNWQD0D/h9NfAyMF3FM0P/vwGYBXwi4Jr1Wno8XZ0uQBfN5BOB/aquuVqvKVLylYCDtUToUvH7NKTn6zV9t+p3OiTgGoB/aJo2AkMrRDBc/79lwDMs8uSdCSQjtgcWJjh/A/AmsIfn+CLg5JAveknDNsAopJv4Ma1aFbF/owSMAY7UKtQjwBI+GhbwlVj3atoTIJJd9Jy47JAwD00gCRitVaysuA34rwTG1aDVh7UFbnd20yraxgQi/zpwdkb3/6oKsxACKVov1vAM41qnDe3YSaklTZHFgT7/hoQl4B8yfO/hRUqsoglkvwzjmkK6nqTOyApNryzY3wRSjBLkfrP7DkmvQpUgRXL7MwDoG1IazAL6ATtr2CYkrjnAPLP5RMwH3gAGh5yzRNP1beA9pJfrsKpztkG6mueaQLLl0yHHJiNTH0pI92JvFdP2wEDNkF2ArfX8uylmL1SHNmeRcZLr9f9LkR7CucBbSI/g+8jg4Wo9P0gg5VLEBNKO7Y8lFZnYrGEBMh5SB2yBjGT3UtG8YAJJJZDpiNfHRciIeDOwBv+g5ZKQvPytCaR9SpDF+sXy0Vohmve0mmCkYwMyGh6X1Zo//RLUBqyRnoJSSOPuZaTL1sgf6zV/gqpYpSK8QEeVINcQbxFQSdsT9fo3iNnEnzBotC8t2nlyZNXvvZCpQC3aZolT3X2Oj3wXb/YC2Scg0dIyx9oTuaVV88dnA0nokFpC3WaQAe+bHeaaJSSfeWxtkAxLj2azwVzTHFKKJKGpMwmke0bxvIZ0Mxr5ZY3mU63UdyaBZNX2ecca6LlnIzKyXkjyNg6yGBnEWxfxxdioYao10HOPQxxU9FV7C7O5FqArMk7SzwSyKTORZZwbYiS6CaM4LEDW3pQXoIXRCFwEHG0C2ZQNGlrNpjbb0sTFsIHcVJvz1otVR0FGWI02b7eYQDxfD6s6WSljAgn5cphADDqzQErY/uxGuvZyqSNu2tYMQLrtKkNvy28jIQciPpBfQNalTNN/v10kgfQPEENfy1sjI3ojk1wrJ7ouqRBLWTgL8ySQXsB9Kob+lodGO7MN8AUNZRaqWL5Jcv/BmQtkBbLnRk/LKyMn9Eccfdfs1imLRrrj4679ay2NDCMLO5hJBgPOWbVBZiIe19PwBuLj9fUMhWYUm/uQpbq7I36VB6eI48U8NdLjGvZi4O/I9Od/agNrFTIleoPZhaE1kvkaGhGPNE3a1tgN8bg/FNguIp4ZWTxMVs6rhxC8OB9kV6TJiB+l1chMXRsQNFLZq37UuyL+z/oA/wZ8JuDcT+nHOEKOrl1KkPLCpS0Cjs0GXrW8NTIqXcoTWlchbpxmBwhkLRntoZjVSPrGELX2wyYgGm1XogStG3mZjOZzZTnVxNco2png3YYMo1a2VPtK2yZuV4FM9/yeZrN6w4hDL49AZuRRID7V9kV2djWMrOlL8FSmXArklZB63/aWl0YbsL2nPfxKHgWyDhnbCGIAxffBZeSLOrWrat4kw23ysjDansg+5LORQZwgBhHcBWwYaelG8J7vuyPDCudn0fatRSB7Az9HPFb8LEQcIFMFulueGhnSpGIIYg+1yflqo0PaSyANwNeAx7We923iuYTcCuvJMrKll9pVlIi+jYyL/FVtt6EtBLId4nr+LeA3wMgUL7ST5amRITsmPH+E2u5basvbxbkoai7WQOA64DigS8oX+SdwJ9INbBMSjaxoBIYBZyKTGJOyHngQGItzc9MKZHvE/22SYsnpzZ9Ctg5egMzLt8mJRtaUtBa0A3ASsmFoV+JPbdoI7Ixzi9IKBGSzxeNiKnIp8AjwR2Q1l4nCaE+x9ERclo5GdjSOqvU8iHNfq6WKBfBZ4LGQ0mIZsqXvQ8g2WeZt3ehoGpAt/o5FuoJ7e0qVo3DusVoFUkKmswd1qW0ALiPDoX3DyJh9kb3dq0uTN4A9cOELQuL0Yjng9pCG0jLLAyPHLPNUtW6P0wSI2837S/w7OR1PB+3+YxgR1CNjH9WsUZsmK4F8APzac+wIzFOikU96axu6mt8iHUqZCYSQalYX4CBs1aCRL0pql0HVq9viRpJEIFPxrxo8lfQDiYbRFnQBTgn4/SXgmbYQSJjy+iATxKwUMfJSeuyOjIWkLj3SCOQBYKXn2AkmECNHAjkh4PdVwK/aUiDd8Lub39+jWMNob7ZGBgqreUttuE0EMhqZ4j4kRLWjrRQxclB6jPLY4RC14WOyFMhWyKTDh4neu/p4bPcoo2NpAP4l5Hg/ZFrU/USvJ4kUyBeQxSYnxXiwDcCfsEFDo2OpVzuMWlpxEvAypdKXQosjz1h7T+Am4PSYDzUHmAQ8bflj5IRDkOGHXWOcezcwBudWxBHIkcBdBHuMCOL3yLD9UssTI4eN9ZOBr8Q49x3gDJz7s08g3YHxwNkxG9rvArcAzwItlhdGjqtcBwLnEb3M1iHjJJfiXHOlQOqQJbGfjHnT/wbutVLDKFhp8k2khyuKl4F9cK613EhvBe6IceFK4HvARBOHUTCWao3ne/gHu8vcjnOt1VWsEuIaxbeV2gLEGdcybCmtUVxKiMugW5C17NU8AYwsL6Sqq6p/nQ40eyLuqXU4E4dRZBzijCRoV+Zm4PTKVYbV4yBzgLGeiHsA5yJeIwyjqHRVO+4RcGwszs2p/CFooHAiMMUT+d7Aidh0EqO41asT1Y6rmaK2T5RAWoHT8C+xHQXsZWltFJC9CO7FWgOcVm6YRwkExOPDOM+xXsC3SDgr0jA6mG5qt0E+osfh3BtBF4XNxZqArCIM4pPIYnjb88MoAnVqr0HjfFPV1kkqkBatavk2I/k6wfszGEbeGKT2Ws1arVq1pBEIiMO4KzzHmoAxWK+WkW+6qp0GbdNxJc69FlX0RLX6B0U0eswvlpFXyn6xfJ1KAymVSmkFUkK6vc6OeIj+1hYxckqJ8A1kzwJuCRNJXUjEE5ABlTCeRLa4MofVRh5pQWbnPhFyzjnABJ9IfAK5GZl3FcZTwI8RTxE2/cTII07tc7zaq4/zgZuDRBIkkJuACyNu/DRwA/55W4aRJ5rVXsNWvF6oth8qkJ8AF0fcbCrwIxOHUUCRXI9/bA/gIkqlG30C+TFwScRNnkX2LFxl6W0UVCTXqh37GEOp9ONqgVwHXBoR+TSN3MRhbA4ieT7knEsplX4EsmDqGvxT3Ms8CdyI7DtoGJsDPbTGdHjIOdfXEa+L9j9NHMZmxkpgcsQ5G+uAH2qRE8YJBK/AMoyi0pNwh4jX4tzl9T+U/zyOzFk5zHPyzsBgbdyst7Q1NoPq1Q+QDXaCuAHnvg9QFgjAX4AtEY90QfRHvNQ9ZyIxCkyTimN/z/HxOPfd8n8qBQKyH3oP4GDPxTsgkxdNJEZRxTGW4K0RAG7EuY/15lYLBOD/kFVXvuJnR2Ag0k1mIjGKJI7vhdj1T3Fuk3FA31ysMYSsstIS5jKC59gbRh7FcVlIzWiC2vwmBJUgZf6E7D14QEjDfSfgBaJdzRtGR1DSJsN3gEM950wELqr0hRWnBAGZCXkhcGvIOYch04VtwZSRR+qR9Uy+3tlfABf6xBElkLJIFkac87blg5Fj5oUcmx8mDvBvoFNmb2A6/nXnLyNzuNZZPhg5pSuyHmRowLF1wHCcm5WmBKkH7gkRxwrgpyYOI+esUztd4RHPPZRK9WkEcgn+wRSQ+VlzLf2NAjBX7TWI/QlZ5uGrYu2JbKjj8574ItJtZqWHUaSq1o+AfQKOrQWGBbkAqgupWvnEsQzZbMfEYRStqnWH2m813XxVrSCBXIh/tBFkv/TXLL2NAvKa2m8QBxHgi6G6ijUYeAnYwhPJLK2vWelhFLmq5evVWgN8qtKRdWUJUgLuDBHHSmTQ0MRhFL2qdSvBvVpbaFWrLkgg5xC+/HAFsBjbPMcoNiXgPfwrZA+lwidcXcXfMyIi3gG4T+tqjZbORgFpVPu9H5mV7uO0coO9sg2yJdINdl6MUuL3yD7pSyzNjYKwDXAy8OWQcxyy++1lOLc6qJEOcARwN7LmI4zFGtlUxAeqYeSRei01zgP6hZz3NrJXyOMfq495Bgp7IF4Wz4xZmtwHvG95YeSMvsA3Y5QadwL/jnMrN2mwRExWPFov3jHiQd4EJiG+T82RtZEHDgVOBXYJOWcBcAbO/dHboo9hzb2QFVcnR5y3AVmueyv+HXINo63phvTIHk14Z9K9yEKpZWGRxdn4ZjlwCjAaeDeih+AobK8Qo2NpAT4XIo7FasunEDztJLFAyjyKrA95OeScX5tAjA5mI/Abz7FX1IYfjRtZ0q3T1uPfs9Dpja0NYnQkYXY4kISeeJIK5CT8nkyeA5Za/hg5YCnBWxw0Ee5utGaBhG3o+R9Wehg5KkUmp7DhmgRyMPCpEMW+bgIxciSQf3hqNJ/E7163JoGEKe+XmJdFI3+N9Um1liJxBbI1siG7r+E+1UoPI2e0ajskaHnG15C5WZkJ5BT860QeI0Z/smF0AMuQXQuq6aY2nYlASsBZIccfxCYrGvmkRe0ziLOIsbYpjkA+iyzF9dXz+lg+GDmmD8GD17sBR0aWDjEaDg8Cx4b0FixDpgr/Ttsi5sja6GgagQPVbgcAvT2lxUM4d1wtAumvxt8Q46HWAx8CjwB/QOZwWcPdaC9KyMTaLyBzrbYCukRcsxEYiHML0gpkALJN9PH4XZAGlSrrkanv9wHzrY1itCH1yHKMbyBT3LsQz2/COmTO1jice7uWKhbIwpMztWGzc8IXmIs47Jpu1S8j42rUcLXLXRJcNw+4DbgLeI9w5+6xBVKp1tHIfPsjSObh5GpkN13DyIKRwOUJajWPAz/XJsBHNZoIgSSdi9UCPKSt/73x+xfyKdcwsmJ+jHPKvtyGqM0+lLS6X1fDA76KLITfETgXmB1y7ofaaDeMrFgOfOA5Nlttcwf9OzvtTeoyeNCVWnQNwe+z9w2g2fLUyJBValfVvK62eKvaZk3UZfjAXZHBlyDexNapG9myVu2qml3w70zQoQIZin+85B1k8phhZEWr2lU1DQQ7pu5wgewTcmyR5afRBvjsalgeBTLc8/t7Ggwja94n2GHh8DwKZF/P7/OxHiyjbVjuqWbtkzeBNGjPQRBvA6stL402YLXaV5L2cIcI5BP4F1S9h01aNNoG56m+d0MGsnMjkH1Djg0B9gK2RZxix51MZhjVlNR+eqg97RVSc8mkod6Q0YOH1fkO4SMvEu8jnhlfBf6p6m/WotImMhrVNCL71nRXQeymtZWhyATaMIYhzkRqU2RGdZ8ngM+kvHYO4qLldWCGNuqtSta5S4kdtVayO7AHsGuKeKYAh0VX0lybC6SkvQk9Mkicx4DrTCCdXiDfJ8Zy2AhWIisJW2sRSBZtkB5q2FnM1l1m9mFkYAfz1CZr/mhn0QZZwUdr1vsBn64K21l+G23Iu8ALVWFxVpE3ZPywi4H/0VBmxwDRbG35aqRgaYAY5rflDRva4aXma3i44repiNcJw4jLs8hmnO1KXQe9rG2yYxTCZuos3Q2jOAJpwEbZDROIl0YTSKen1E5t40IKpBUbJDRyJJCGnCVMo4YNMcVtjf3iUB/z49doAvEzDDgfcQtZHyPBf0PwghkjX+yEuK+N8kvQgjj/GNbZBeL78vcDvpQgnreRaQVWLct3m2J/4CvWSI9PVj6yBuSwFDQ2/QgPyCCels4kkKzYA/9KRiMfbAHsmUE8q0wgydkVWUxj5JfupFvP0anbIC8Sf7+R8nOO8Ai8L+Z3K8/09XyInyDZKtIXO5NAxqVo6C1Fdg2qZjCyjNca6vlsoAeVHsuQ7Qtyn2dFqWI5ZAOeIPZE+s6NfNZQ9gr4fXpRPmhFaoO84Pl9KNF70RkdQ1eC/eS+YG2Q9hNIP8Tzha+Xox7xk9SErFHeHtk/0byoJKcR8VCzSKtJqxAv674u2C01f0wgHSgQgG0QF0J1milb6W/bAwMRl/i7VLRhvo8swLF2S7L2xKeBKyraEXOQLQjeUtEsQTZLWo2Mmm+TIi/z9dIFs5D3CPaHNAXxtdUP2WR0J8KX9b6JbP5oWzIkq47fQXiX7VJkZsM7yPLrTyA7z1byPuLjKietW7fZlCAA04AvBvx+aEBGhLGLCukts/vY7ET0eMbWGvYJOWd60b4KRSLLovkks/lEfCPDj5wJpI3I8utzCNDL7D4WvRKW0O2VhyaQGr8+6/HvcNqNZDOHS0gvTtHnfm1B8pWbXyR45sMsTeMkPG8CaTsWAQs9x1YBzwATgdORNQVNiPdvn0i+QvggY0nTqJ826h9FthUu6rLgErJl96PAt/S96iLepxEYFfD7q8gYR5O2OU7XtH8af5f7Qgo2LaiIU8WnIU6JZyLOrmdqeB1/r9QvNPOq6QMcgPSCVRtSF6QX5iQ+vqXXUUgX8RSK1U1c0mrSUfpu/6phOvArNfj1Ae+0v6ZTUJo6ZDzpJQ2VH97BiAPqYRV/pxXui1LAgYAeJN//ukm/XE0Bx14CLtbMbtT69sHAqcjAYhBzgUuRbs0k1Kvx1DJI2agfgqTrI7YGxgODPMeXA/doKbxcn7EE3MSmvVKrgB0Qt7NtnXdtSzs4r25v0iTwKvx7RQzUEmIwMAZZxntxiDhQIzsjYQncHTgBuAjomfLde+r1J5Bsmn+DVoEGRTTEL9b3H6PpMdxzzX0pxEHuxLGZliBp2Qt4JaC+3VrDx+IK4KmIqlYJ2fjlnIov8TPA9SRbBNQEXMZHmxG9CPwc2Ygo6v6HAVemeL+gtHER7bpi0Q77gxSJvwBHZBjfQuCCkKpWd+AY4BQ2dULxHHBNTJE0AWPZ1J9xi5aMv8O/jLmPtr/6Z/TOf804Da2KlSNuSXHNcuDvnmP9gbMJ9sAyFLhKqzZBxw9A1sVE7WHRQ8870NOmOV3vM9Rz/GyPOP5Ouu25b+lMBtPZSpAGZILdzjHOnQ7cBkxGxgBeQSY/BjEO6d4EGWc4QUuOOO2EaVqSrPCI4wfAfjHiaUY86D8ArNHfDtG4q3kX2QV2HdKTdTYyETGKd5DpJpuPP7KIEgTX+cJYJ8kSFJod3O1gv4Drvhxy3YcOjnVwnoNZIef5wjQHoxyMqAijHDyfIq7ZDs7X5/nQc86ogPfbz8Fdmga+uMdtdvbgXGjojALp62BdVcbPcnCBg94R104KMZ6FDlakMOhyeMHBaBXHaP1/2rhW6vMEHZsU8Y69NC2qhb7OwbYmkM4R7nOw1sFkB4cnuK6Xg3kpDHa1g0scTIw47yn9+j8Vcs5EjWt1iueYF+MjUBkO1zRa6+D+zdIWTCCBYUANX8PPOWhNYJRTHOyu15Yc3FxDyTBB40DjnJLg2lYHn0/5zttqmplALMQKt8UwyGYHFzqoC7j+xhTiuLlCHOVQp/dojnH97ZZvJpD2Ck0O3gwxxr852DUijvEJxDE+Iq5d9Z6+69900MPyzQTSnmFEQFVrpYNzA770vnBDDHHcEDOukt57RUDVaqTllwmkI8KECkN8zMGgFHFcGyKO61PEN9DBn6vaLZZXJpAOCVtqd+xZCUqNoHB1gDiuqSG+koMz9dm6Wz6ZQDoylDKK58oKcVyZs2frtALpbFNN8s7l+vcqS4p8TDX5/wEAl6mZyRp+m1gAAAAASUVORK5CYII="}
, function(x, a) {
    var e = {
        5: function(x) {
            var a = x.border.width
              , e = a / 2
              , t = x.border.height / 2
              , n = x.scene && x.scene.backgroundGraphics;
            if (n) {
                var _;
                n.visible = true,
                (_ = new (PIXI.Graphics)).beginFill(2593235, .1),
                _.lineStyle(40, 0),
                _.drawRect(0, 0, a, 3500),
                _.position.set(-e, -t),
                n.addChild(_),
                (_ = new (PIXI.Graphics)).beginFill(2593235, .1),
                _.lineStyle(40, 0),
                _.drawRect(0, 0, a, 2e3),
                _.position.set(-e, t - 2e3),
                n.addChild(_)
            } else
                console.error("backgroundGraphics container missing!")
        }
    };
    a.prepareMode = function(x, a) {
        var t = e[a];
        t && t(x)
    }
}
, , , function(x, a, e) {
    var n = e(3)
      , _ = e(112)
      , i = [];

    function s(x) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(x)))
    }
    function o(x) {
        x = atob(x);
        for (var a = new ArrayBuffer(x.length), e = new Uint8Array(a), t = 0; t < x.length; t++)
            e[t] = x.charCodeAt(t);
        return new DataView(a)
    }
    n.replay = {
        updateHistory: i,
        addHistory: () => {},
        load: async x => {
            var a = x.split("|");
            "REPLAY" === a[0] && (a = a.slice(3));
            var e = a.map(o)
              , t = e.shift()
              , i = e.shift();
            n.running && n.stop(),
            n.closeConnection();
            var r = _.initialData(t);
            r.replayUpdates = e;
            await n.start(r);
            await n.parseMessage(i);
            return r.replayUpdates.length;
        },
        save: () => {}
    }
    window.loadReplay = n.replay.load;
    // v2.11d: aguarda as promessas _skinDone de todos os jogadores (as
    // texturas das skins estao ou aplicadas ou falhadas) antes do 1.o frame.
    window.waitForSkins = async (ms) => {
        try {
            ms = ms || 10000;
            var pm = window.game && window.game.playerManager;
            if (!pm || !pm.players) return;
            var ps = [];
            Object.values(pm.players).forEach(p => { if (p && p._skinDone) ps.push(p._skinDone); });
            if (!ps.length) return;
            await Promise.race([Promise.all(ps), new Promise(r => setTimeout(r, ms))]);
        } catch (e) { console.warn("[skins] waitForSkins: " + e); }
    };
}
, , function(x, a, e) {
}
, function(x, a, e) {
    var t = e(3)
      , n = e(246);
    function _() {
        t.state.isConnected = false,
        t.ws && (t.ws.onmessage = null,
        t.ws.onclose = null,
        t.ws.onerror = null,
        t.ws.close())
    }
    function i(x) {
        var a = "You have been disconnected";
        x.reason && (a += " (" + x.reason + ")"),
        t.chat.addError(a),
        t.state.isConnected = false,
        t.running && t.stop(),
        1003 === x.code && setTimeout(()=>{
            3 === t.ws.readyState && t.connect(t.lastWsUrl)
        }
        , 1500),
        t.toggleOverlay(true)
    }
    function r() {
        return !(!t.ws || 1 !== t.ws.readyState)
    }
    t.send = function(x) {
        r() ? t.ws.send(x) : t.replaying || console.log("WebSocket not open?")
    }
    ,
    t.sendUint8 = function(x) {
        var a = prepareData(1);
        a.setUint8(0, x),
        t.send(a)
    }
    ,
    t.ping = function() {
        t.pingstamp = Date.now();
        var x = prepareData(1);
        x.setUint8(0, 3),
        t.send(x)
    }
    ,
    t.connect = () => {}
    ,
    t.closeConnection = _,
    t.isConnected = r
}
, function(x, a, e) {
    var t = e(3)
      , n = e(247)
      , _ = e(112)
      , i = {};
    e(256);
    var r = 1;
    x.exports = t.parseMessage = async function(x) {
        function a() {
            for (var a, e = ""; 0 != (a = x.getUint16(s, true)); )
                s += 2,
                e += String.fromCharCode(a);
            return s += 2,
            e
        }
        function e() {
            for (var a, e = ""; 0 != (a = x.getUint8(s, true)); )
                s += 1,
                e += String.fromCharCode(a);
            return s += 1,
            e
        }
        x.packetId = r++,
        x.clearWhenShifted = [];
        var s = 0;
        switch (x.getUint8(s++)) {
        case 1:
            var o = _.initialData(x);
            t.initialDataPacket = x,
            t.start(o);
            break;
        case 2:
            var c = e()
              , l = i.gen(c);
            t.send(l);
            break;
        case 3:
            var d = Date.now() - t.pingstamp;
            t.stats.ping.set(d);
            break;
        case 4:
            for (; f = x.getUint16(s, true); )
                t.playerManager.delayedRemovePlayer(f),
                s += 2;
            break;
        case 10:
            n(x);
            break;
        case 11:
            t.leaderboard.receiveUpdate(x);
            break;
        case 12:
            t.minimap.receiveUpdate(x);
            break;
        case 13:
            t.chat.receiveMessage(x, s);
            break;
        case 15:
            for (; ; ) {
                var f = x.getUint16(s, true);
                if (s += 2,
                !f)
                    break;
                var u = a()
                  , h = e();
                await t.playerManager.setPlayerData(f, u, h)
            }
            break;
        case 16:
            let json = JSON.parse(decodeURIComponent(escape(e())));
            
            for (var R = [], T = 0; T < json.length; T++) {
                let player = await t.playerManager.setPlayerData(json[T].pid, json[T].nickname, json[T].skinUrl, json[T].tagId, json[T].nameColor);
                R.push(player);
            }
            t.playerManager.reRenderPlayerTextures();
            break;

        case 17:
            t.center.x = x.getInt32(s, true),
            s += 4,
            t.center.y = x.getInt32(s, true),
            s += 4;
            break;
        case 18:
            t.replay.updateHistory.length = 0,
            t.clearNodes()
        }
    }
}
, function(x, a, e) {
    var t = e(3)
      , n = e(248)
      , _ = e(10);
    x.exports = function(x) {
        var a = t.nodes
          , e = t.nodelist;
        for (var i, r, s = 1, o = !t.spectating && !t.replaying, c = t.state.isAlive, l = false; ; ) {
            var d = x.getUint8(s++);
            if (0 === d)
                break;
            1 === d ? (r = x.getUint16(s),
            s += 2,
            r === t.playerId && (l = true)) : r = null,
            i = x.getUint32(s),
            s += 4;
            var f = x.getInt32(s);
            s += 4;
            var u = x.getInt32(s);
            s += 4;
            var h = x.getInt16(s);
            s += 2;
            var v = null;
            if (a.hasOwnProperty(i))
                (v = a[i]).update(),
                v.ox = v.x,
                v.oy = v.y,
                v.oSize = v.size;
            else {
                var g = {
                    id: i,
                    pid: r,
                    x: f,
                    y: u,
                    size: h,
                    isMe: l
                };
                switch (d) {
                case 1:
                    v = new (n.PlayerCell)(g),
                    t.scene.addCell(v.sprite);
                    break;
                case 2:
                    v = new (n.Virus)(g),
                    t.scene.addCell(v.sprite);
                    break;
                case 3:
                    v = new n.EjectedMass(g),
                    t.scene.addCell(v.sprite);
                    break;
                case 4:
                    v = new (n.Food)(g),
                    t.scene.addFood(v.sprite);
                    break;
                case 5:
                    v = new (n.DeadCell)(g),
                    t.scene.addCell(v.sprite);
                    break;
                default:
                    console.error("Received invalid cell type", d)
                }
                e.push(v),
                a[i] = v,
                v.ka = f,
                v.la = u
            }
            v.nx = f,
            v.ny = u,
            v.nSize = h,
            v.lastUpdate = t.timestamp,
            o && v.player && (v.player.lastUpdate = x)
        }
        for (o && t.replay.addHistory(x),
        c === l || t.replaying || t.toggleOverlay(!l),
        t.state.isAlive = l; i = x.getUint32(s),
        s += 4,
        0 !== i; )
            a[i] && a[i].destroy();
        for (; i = x.getUint32(s),
        s += 4,
        0 !== i; ) {
            var p = a[i]
              , m = x.getUint32(s);
            s += 4;
            var b = a[m];
            if (p)
                if (b) {
                    p.destroy(_.eatAnimation),
                    p.ox = p.x,
                    p.oy = p.y,
                    p.oSize = p.size;
                    var y = p.size / b.nSize;
                    y = 0 > y ? 0 : 1 < y ? 1 : y,
                    p.newPositionScale = y,
                    p.nx = b.x,
                    p.ny = b.y,
                    p.nSize = 0;
                    p.lastUpdate = t.timestamp;
                } else
                    p.destroy();
            else
                t.replaying || console.warn("Prey not found:", i)
        }
    }
}
, function(x, a, e) {
    a.PlayerCell = e(249),
    a.Food = e(250),
    a.Virus = e(251),
    a.EjectedMass = e(252),
    a.DeadCell = e(253)
}
, function(x, a, e) {
    var t = e(3)
      , n = e(23)
      , _ = e(10);
      // Player cell
    x.exports = class extends n {
        constructor(x) {
            var a = x.pid
              , e = t.playerManager.getPlayer(a);
            e && e.texture && e.texture.valid ? x.texture = e.texture : console.warn("No player texture"),
            super(x),
            this.pid = a,
            this.player = e;
            this.tagId = e.tag;
            e.isMe = x.isMe;
            this.isMe = x.isMe;
            if (this.isMe && this.tagId) {
                t.myTag = this.tagId;
            }
        }

        onUpdate() {

            if ((_.namesEnabled == "all" || 
             (_.namesEnabled == "hideme" && !this.isMe) &&
             (_.namesEnabled != "none")) && this.player && this.player.nameSprite) {

                // console.log("Adding namesprite for ", this.player, this.isMe, _.namesEnabled);
                this.nameSprite = new (PIXI.Sprite)(this.player.nameSprite.texture);
                this.nameSprite.anchor.set(.5);
                this.sprite.addChild(this.nameSprite);
            } else if (this.nameSprite) {
                // console.log("Removing name sprite because mode is " + _.namesEnabled);
                // this.sprite.removeChild(this.nameSprite);
            }

            _.showMass && (_.showMass != "none") && !this.massText && (this.massText = t.massTextPool.shift() || function() {
                var x = new (PIXI.extras.BitmapText)("",{
                    font: "75px Mass Font",
                    align: "right"
                });
                return x.anchor.x = .5,
                x.anchor.y = -.45,
                x
            }(),
            this.sprite.addChild(this.massText));
            var x = t.cameraScale * this.size > 40;
            this.nameSprite && (this.nameSprite.visible = _.namesEnabled && x),
            this.massText && (_.showMass && (_.showMass != "none") && x ? (this.massText.text = (_.showMass == "long" ? 
                this.getLongMass() : this.getShortMass()),
            this.massText.visible = true) : this.massText.visible && (this.massText.visible = false))
        }

        onDestroy() {
            this.massText && (this.sprite.removeChild(this.massText),
            t.massTextPool.push(this.massText))
        }

        getLongMass() {
            var x = this.getMass();
            return x.toString();
        }

        getShortMass() {
            var x = this.getMass();
            return x < 1e3 ? x.toString() : (Math.round(.001 * x * 10) / 10).toFixed(1) + "k"
        }
    }
}
, function(x, a, e) {
    e(3);
    var t = e(23)
      , n = e(16)
      , _ = e(111).neon;
    x.exports = class extends t {
        constructor(x) {
            var a = _[x.id % _.length];
            x.texture = n.cells.getTexture(a),
            super(x)
        }
    }
}
, function(x, a, e) {
    e(3);
    var t = e(23)
      , n = e(16);
    x.exports = class extends t {
        constructor(x) {
            x.texture = n.virus.getTexture(),
            x.cellScale = 1.1,
            super(x)
        }
    }
}
, function(x, a, e) {
    e(3);
    var t = e(23)
      , n = e(16);
    x.exports = class extends t {
        constructor(x) {
            x.texture = n.cells.getTexture(16753920),
            super(x)
        }
    }
}
, function(x, a, e) {
    e(3);
    var t = e(23)
      , n = e(16);
    x.exports = class extends t {
        constructor(x) {
            x.texture = n.cells.getTexture(4210752),
            super(x)
        }
    }
}
, function(_0x11afbe, _0x4176e8, _0x53c25f) {
    (function(_0x260a97, _0x4070fb) {
        var _0x490e85 = typeof _0x490e85 !== "undefined" ? _0x490e85 : {}, _0x323383 = {}, _0x38bff5;
        for (_0x38bff5 in _0x490e85)
            _0x490e85.hasOwnProperty(_0x38bff5) && (_0x323383[_0x38bff5] = _0x490e85[_0x38bff5]);
        _0x490e85.arguments = [],
        _0x490e85.thisProgram = "./this.program",
        _0x490e85.quit = function(x, a) {
            throw a
        }
        ,
        _0x490e85.preRun = [],
        _0x490e85.postRun = [];
        var _0xa5972f = false
          , _0x20fc4f = false
          , _0x1d1cc9 = false
          , _0x450dcb = false
          , _0x5e4bde = false;
        _0xa5972f = typeof window === "object",
        _0x20fc4f = typeof importScripts === "function",
        _0x450dcb = typeof _0x260a97 === "object" && "function" === "function",
        _0x1d1cc9 = _0x450dcb && !_0xa5972f && !_0x20fc4f,
        _0x5e4bde = !_0xa5972f && !_0x1d1cc9 && !_0x20fc4f;
        var _0x55817b = "", _0x28992b, _0xa9ab12;
        function _0x446855(x) {
            return _0x490e85.locateFile ? _0x490e85.locateFile(x, _0x55817b) : _0x55817b + x
        }
        _0x1d1cc9 ? (_0x55817b = _0x4070fb + "/",
        _0x490e85.read = function(x, a) {
            var e;
            return _0x28992b || (_0x28992b = _0x53c25f(255)),
            _0xa9ab12 || (_0xa9ab12 = _0x53c25f(9)),
            x = _0xa9ab12.normalize(x),
            e = _0x28992b.readFileSync(x),
            a ? e : e.toString()
        }
        ,
        _0x490e85.readBinary = function(x) {
            var a = _0x490e85.read(x, true);
            return a.buffer || (a = new Uint8Array(a)),
            _0x235991(a.buffer),
            a
        }
        ,
        _0x260a97.argv.length > 1 && (_0x490e85.thisProgram = _0x260a97.argv[1].replace(/\\/g, "/")),
        _0x490e85.arguments = _0x260a97.argv.slice(2),
        _0x11afbe.exports = _0x490e85,
        _0x260a97.on("uncaughtException", function(x) {
            if (!(x instanceof _0x36d1e6))
                throw x
        }),
        _0x260a97.on("unhandledRejection", _0x40929f),
        _0x490e85.quit = function(x) {
            _0x260a97.exit(x)
        }
        ,
        _0x490e85.inspect = function() {
            return "[Emscripten Module object]"
        }
        ) : _0x5e4bde ? ("undefined" != typeof read && (_0x490e85.read = function(x) {
            return read(x)
        }
        ),
        _0x490e85.readBinary = function(x) {
            var a;
            return typeof readbuffer === "function" ? new Uint8Array(readbuffer(x)) : (_0x235991("object" == typeof (a = read(x, "binary"))),
            a)
        }
        ,
        typeof scriptArgs != "undefined" ? _0x490e85.arguments = scriptArgs : typeof arguments != "undefined" && (_0x490e85.arguments = arguments),
        typeof quit === "function" && (_0x490e85.quit = function(x) {
            quit(x)
        }
        )) : (_0xa5972f || _0x20fc4f) && (_0x20fc4f ? _0x55817b = self.location.href : document.currentScript && (_0x55817b = document.currentScript.src),
        _0x55817b = 0 !== _0x55817b.indexOf("blob:") ? _0x55817b.substr(0, _0x55817b.lastIndexOf("/") + 1) : "",
        _0x490e85.read = function(x) {
            var a = new XMLHttpRequest;
            return a.open("GET", x, false),
            a.send(null),
            a.responseText
        }
        ,
        _0x20fc4f && (_0x490e85.readBinary = function(x) {
            var a = new XMLHttpRequest;
            return a.open("GET", x, false),
            a.responseType = "arraybuffer",
            a.send(null),
            new Uint8Array(a.response)
        }
        ),
        _0x490e85.readAsync = function(x, a, e) {
            var t = new XMLHttpRequest;
            t.open("GET", x, true),
            t.responseType = "arraybuffer",
            t.onload = function() {
                200 == t.status || 0 == t.status && t.response ? a(t.response) : e()
            }
            ,
            t.onerror = e,
            t.send(null)
        }
        ,
        _0x490e85.setWindowTitle = function(x) {
            document.title = x
        }
        );
        var _0x408924 = _0x490e85.print || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null)
          , _0x390358 = _0x490e85.printErr || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || _0x408924);
        for (_0x38bff5 in _0x323383)
            _0x323383.hasOwnProperty(_0x38bff5) && (_0x490e85[_0x38bff5] = _0x323383[_0x38bff5]);
        _0x323383 = void 0;
        var _0x1cd2ba = {
            "f64-rem": function(x, a) {
                return x % a
            },
            debugger: function() {}
        }, _0x4db6c9 = new Array(0), _0x112070, _0x614f4a;
        typeof WebAssembly !== "object" && _0x390358("no native wasm support detected");
        var _0x1ccac9 = false
          , _0x40874e = 0;
        function _0x235991(x, a) {
            x || _0x40929f("Assertion failed: " + a)
        }
        function _0x560163(x) {
            var a = _0x490e85["_" + x];
            return _0x235991(a, "Cannot call unknown function " + x + ", make sure it is exported"),
            a
        }
        function _0x414bc0(x, a, e, t, n) {
            var _ = {
                string: function(x) {
                    var a = 0;
                    if (null !== x && void 0 !== x && 0 !== x) {
                        var e = 1 + (x.length << 2);
                        _0x3f70af(x, a = _0x5b0a52(e), e)
                    }
                    return a
                },
                array: function(x) {
                    var a = _0x5b0a52(x.length);
                    return _0x8bc108(x, a),
                    a
                }
            };
            var i = _0x560163(x)
              , r = []
              , s = 0;
            if (t)
                for (var o = 0; o < t.length; o++) {
                    var c = _[e[o]];
                    c ? (0 === s && (s = _0x5888a1()),
                    r[o] = c(t[o])) : r[o] = t[o]
                }
            var l = i.apply(null, r);
            return l = function(x) {
                return a === "string" ? _0x5d7215(x) : a === "boolean" ? Boolean(x) : x
            }(l),
            0 !== s && _0x1932a6(s),
            l
        }
        function _0x687f3c(x, a, e, t) {
            var n = (e = e || []).every(function(x) {
                return x === "number"
            });
            return "string" !== a && n && !t ? _0x560163(x) : function() {
                return _0x414bc0(x, a, e, arguments, t)
            }
        }
        var _0x465922 = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0;
        function _0x118040(x, a, e) {
            for (var t = a + e, n = a; x[n] && !(n >= t); )
                ++n;
            if (n - a > 16 && x.subarray && _0x465922)
                return _0x465922.decode(x.subarray(a, n));
            for (var _ = ""; a < n; ) {
                var i = x[a++];
                if (128 & i) {
                    var r = 63 & x[a++];
                    if (192 != (224 & i)) {
                        var s = 63 & x[a++];
                        if ((i = 224 == (240 & i) ? (15 & i) << 12 | r << 6 | s : (7 & i) << 18 | r << 12 | s << 6 | 63 & x[a++]) < 65536)
                            _ += String.fromCharCode(i);
                        else {
                            var o = i - 65536;
                            _ += String.fromCharCode(55296 | o >> 10, 56320 | 1023 & o)
                        }
                    } else
                        _ += String.fromCharCode((31 & i) << 6 | r)
                } else
                    _ += String.fromCharCode(i)
            }
            return _
        }
        function _0x5d7215(x, a) {
            return x ? _0x118040(_0x1c9704, x, a) : ""
        }
        function _0x354124(x, a, e, t) {
            if (!(t > 0))
                return 0;
            for (var n = e, _ = e + t - 1, i = 0; i < x.length; ++i) {
                var r = x.charCodeAt(i);
                if (r >= 55296 && r <= 57343)
                    r = 65536 + ((1023 & r) << 10) | 1023 & x.charCodeAt(++i);
                if (r <= 127) {
                    if (e >= _)
                        break;
                    a[e++] = r
                } else if (r <= 2047) {
                    if (e + 1 >= _)
                        break;
                    a[e++] = 192 | r >> 6,
                    a[e++] = 128 | 63 & r
                } else if (r <= 65535) {
                    if (e + 2 >= _)
                        break;
                    a[e++] = 224 | r >> 12,
                    a[e++] = 128 | r >> 6 & 63,
                    a[e++] = 128 | 63 & r
                } else {
                    if (e + 3 >= _)
                        break;
                    a[e++] = 240 | r >> 18,
                    a[e++] = 128 | r >> 12 & 63,
                    a[e++] = 128 | r >> 6 & 63,
                    a[e++] = 128 | 63 & r
                }
            }
            return a[e] = 0,
            e - n
        }
        function _0x3f70af(x, a, e) {
            return _0x354124(x, _0x1c9704, a, e)
        }
        var _0x3beebe = "undefined" != typeof TextDecoder ? new TextDecoder("utf-16le") : void 0;
        function _0x8bc108(x, a) {
            _0x30c757.set(x, a)
        }
        var _0x34eda9 = 65536, _0x2dbaa4, _0x30c757, _0x1c9704, _0xed56e3, _0x14ec92, _0xf74ad7, _0x5f3802, _0x40318f, _0x5767de;
        function _0x11425f() {
            _0x490e85.HEAP8 = _0x30c757 = new Int8Array(_0x2dbaa4),
            _0x490e85.HEAP16 = _0xed56e3 = new Int16Array(_0x2dbaa4),
            _0x490e85.HEAP32 = _0xf74ad7 = new Int32Array(_0x2dbaa4),
            _0x490e85.HEAPU8 = _0x1c9704 = new Uint8Array(_0x2dbaa4),
            _0x490e85.HEAPU16 = _0x14ec92 = new Uint16Array(_0x2dbaa4),
            _0x490e85.HEAPU32 = _0x5f3802 = new Uint32Array(_0x2dbaa4),
            _0x490e85.HEAPF32 = _0x40318f = new Float32Array(_0x2dbaa4),
            _0x490e85.HEAPF64 = _0x5767de = new Float64Array(_0x2dbaa4)
        }
        var _0x15c5d9 = 5245792
          , _0x20d5af = 2880
          , _0x325285 = 5242880
          , _0x10f1a5 = _0x490e85.TOTAL_MEMORY || 16777216;
        function _0x58fcf5(x) {
            for (; x.length > 0; ) {
                var a = x.shift();
                if ("function" != typeof a) {
                    var e = a.func;
                    typeof e === "number" ? void 0 === a.arg ? _0x490e85.dynCall_v(e) : _0x490e85.dynCall_vi(e, a.arg) : e(void 0 === a.arg ? null : a.arg)
                } else
                    a()
            }
        }
        _0x10f1a5 < _0x325285 && _0x390358("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + _0x10f1a5 + "! (TOTAL_STACK=" + _0x325285 + ")"),
        _0x490e85.buffer ? _0x2dbaa4 = _0x490e85.buffer : typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function" ? (_0x112070 = new (WebAssembly.Memory)({
            initial: _0x10f1a5 / _0x34eda9,
            maximum: _0x10f1a5 / _0x34eda9
        }),
        _0x2dbaa4 = _0x112070.buffer) : _0x2dbaa4 = new ArrayBuffer(_0x10f1a5),
        _0x11425f(),
        _0xf74ad7[_0x20d5af >> 2] = _0x15c5d9;
        var _0xd8667f = []
          , _0x3c2e87 = []
          , _0x49d88e = []
          , _0x3edf16 = []
          , _0x33b302 = false;
        function _0x3ce3ca() {
            if (_0x490e85.preRun)
                for (typeof _0x490e85.preRun == "function" && (_0x490e85.preRun = [_0x490e85.preRun]); _0x490e85.preRun.length; )
                    _0x35f3e3(_0x490e85.preRun.shift());
            _0x58fcf5(_0xd8667f)
        }
        function _0x59de1b() {
            _0x33b302 = true,
            _0x58fcf5(_0x3c2e87)
        }
        function _0x3dedac() {
            _0x58fcf5(_0x49d88e)
        }
        function _0x5c943f() {
            if (_0x490e85.postRun)
                for (typeof _0x490e85.postRun == "function" && (_0x490e85.postRun = [_0x490e85.postRun]); _0x490e85.postRun.length; )
                    _0x4ed632(_0x490e85.postRun.shift());
            _0x58fcf5(_0x3edf16)
        }
        function _0x35f3e3(x) {
            _0xd8667f.unshift(x)
        }
        function _0x4ed632(x) {
            _0x3edf16.unshift(x)
        }
        var _0x4adba8 = 0
          , _0x1e0f3d = null
          , _0x35be2e = null;
        function _0x4d19f1(x) {
            _0x4adba8++,
            _0x490e85.monitorRunDependencies && _0x490e85.monitorRunDependencies(_0x4adba8)
        }
        function _0x2e08bf(x) {
            if (_0x4adba8--,
            _0x490e85.monitorRunDependencies && _0x490e85.monitorRunDependencies(_0x4adba8),
            0 == _0x4adba8 && (null !== _0x1e0f3d && (clearInterval(_0x1e0f3d),
            _0x1e0f3d = null),
            _0x35be2e)) {
                var a = _0x35be2e;
                _0x35be2e = null,
                a()
            }
        }
        _0x490e85.preloadedImages = {},
        _0x490e85.preloadedAudios = {};
        var _0x16c1e5 = "data:application/octet-stream;base64,";
        function _0x320f82(x) {
            return String.prototype.startsWith ? x.startsWith(_0x16c1e5) : 0 === x.indexOf(_0x16c1e5)
        }
        var _0x4e6c57 = "wauth.wasm";
        function _0x244e4d() {
            try {
                if (_0x490e85.wasmBinary)
                    return new Uint8Array(_0x490e85.wasmBinary);
                if (_0x490e85.readBinary)
                    return _0x490e85.readBinary(_0x4e6c57);
                throw "both async and sync fetching of the wasm failed"
            } catch (x) {
                _0x40929f(x)
            }
        }
        function _0x37194e() {
            return _0x490e85.wasmBinary || !_0xa5972f && !_0x20fc4f || typeof fetch !== "function" ? new Promise(function(x, a) {
                x(_0x244e4d())
            }
            ) : fetch(_0x4e6c57, {
                credentials: "same-origin"
            }).then(function(x) {
                if (!x.ok)
                    throw "failed to load wasm binary file at '" + _0x4e6c57 + "'";
                return x.arrayBuffer()
            }).catch(function() {
                return _0x244e4d()
            })
        }
        function _0x23a07a(x) {
            var a = {
                env: x,
                global: {
                    NaN: NaN,
                    Infinity: 1 / 0
                },
                "global.Math": Math,
                asm2wasm: _0x1cd2ba
            };
            function e(x, a) {
                var e = x.exports;
                _0x490e85.asm = e,
                _0x2e08bf("wasm-instantiate")
            }
            function t(x) {
                e(x.instance)
            }
            function n(x) {
                return _0x37194e().then(function(x) {
                    return WebAssembly.instantiate(x, a)
                }).then(x, function(x) {
                    _0x390358("failed to asynchronously prepare wasm: " + x),
                    _0x40929f(x)
                })
            }
            if (_0x4d19f1("wasm-instantiate"),
            _0x490e85.instantiateWasm)
                try {
                    return _0x490e85.instantiateWasm(a, e)
                } catch (x) {
                    return _0x390358("Module.instantiateWasm callback failed with error: " + x),
                    false
                }
            return function() {
                if (_0x490e85.wasmBinary || typeof WebAssembly.instantiateStreaming !== "function" || _0x320f82(_0x4e6c57) || typeof fetch !== "function")
                    return n(t);
                fetch(_0x4e6c57, {
                    credentials: "same-origin"
                }).then(function(x) {
                    return WebAssembly.instantiateStreaming(x, a).then(t, function(x) {
                        _0x390358("wasm streaming compile failed: " + x),
                        _0x390358("falling back to ArrayBuffer instantiation"),
                        n(t)
                    })
                })
            }(),
            {}
        }
        function _0x538ff1() {
            return _0x30c757.length
        }
        function _0x57e59d(_0x383bd1) {
            return 0 | eval(_0x5d7215(_0x383bd1))
        }
        function _0x20bd69(x) {
            return _0x490e85.___errno_location && (_0xf74ad7[_0x490e85.___errno_location() >> 2] = x),
            x
        }
        function _0x45972(x) {
            _0x40929f("OOM")
        }
        function _0x2495c9(x) {
            _0x45972(x)
        }
        _0x320f82(_0x4e6c57) || (_0x4e6c57 = _0x446855(_0x4e6c57)),
        _0x490e85.asm = function(x, a, e) {
            return a.memory = _0x112070,
            a.table = _0x614f4a = new (WebAssembly.Table)({
                initial: 0,
                maximum: 0,
                element: "anyfunc"
            }),
            a.__memory_base = 1024,
            a.__table_base = 0,
            _0x23a07a(a)
        }
        ;
        var _0x5223f3 = {}
          , _0x3fed5 = {
            b: _0x20bd69,
            f: _0x538ff1,
            e: _0x2495c9,
            d: _0x57e59d,
            c: _0x45972,
            a: _0x20d5af
        }
          , _0x41b42d = _0x490e85.asm(_0x5223f3, _0x3fed5, _0x2dbaa4);
        _0x490e85.asm = _0x41b42d;
        var _0x314188 = _0x490e85.___errno_location = function() {
            return _0x490e85.asm.g.apply(null, arguments)
        }
          , _0x4f4e11 = _0x490e85._free = function() {
            return _0x490e85.asm.h.apply(null, arguments)
        }
          , _0x2efdda = _0x490e85._gen = function() {
            return _0x490e85.asm.i.apply(null, arguments)
        }
          , _0x196c1f = _0x490e85._malloc = function() {
            return _0x490e85.asm.j.apply(null, arguments)
        }
          , _0x5b0a52 = _0x490e85.stackAlloc = function() {
            return _0x490e85.asm.k.apply(null, arguments)
        }
          , _0x1932a6 = _0x490e85.stackRestore = function() {
            return _0x490e85.asm.l.apply(null, arguments)
        }
          , _0x5888a1 = _0x490e85.stackSave = function() {
            return _0x490e85.asm.m.apply(null, arguments)
        }
        ;
        function _0x36d1e6(x) {
            this.name = "ExitStatus",
            this.message = "Program terminated with exit(" + x + ")",
            this.status = x
        }
        function _0x1a237d(x) {
            function a() {
                _0x490e85.calledRun || (_0x490e85.calledRun = true,
                _0x1ccac9 || (_0x59de1b(),
                _0x3dedac(),
                _0x490e85.onRuntimeInitialized && _0x490e85.onRuntimeInitialized(),
                _0x5c943f()))
            }
            x = x || _0x490e85.arguments,
            _0x4adba8 > 0 || (_0x3ce3ca(),
            _0x4adba8 > 0 || _0x490e85.calledRun || (_0x490e85.setStatus ? (_0x490e85.setStatus("Running..."),
            setTimeout(function() {
                setTimeout(function() {
                    _0x490e85.setStatus("")
                }, 1),
                a()
            }, 1)) : a()))
        }
        function _0x40929f(x) {
            throw _0x490e85.onAbort && _0x490e85.onAbort(x),
            void 0 !== x ? (_0x408924(x),
            _0x390358(x),
            x = '"' + x + '"') : x = "",
            _0x1ccac9 = true,
            _0x40874e = 1,
            "abort(" + x + "). Build with -s ASSERTIONS=1 for more info."
        }
        if (_0x490e85.asm = _0x41b42d,
        _0x490e85.ccall = _0x414bc0,
        _0x490e85.cwrap = _0x687f3c,
        _0x36d1e6.prototype = new Error,
        _0x36d1e6.prototype.constructor = _0x36d1e6,
        _0x35be2e = function x() {
            _0x490e85.calledRun || _0x1a237d(),
            _0x490e85.calledRun || (_0x35be2e = x)
        }
        ,
        _0x490e85.run = _0x1a237d,
        _0x490e85.abort = _0x40929f,
        _0x490e85.preInit)
            for (typeof _0x490e85.preInit == "function" && (_0x490e85.preInit = [_0x490e85.preInit]); _0x490e85.preInit.length > 0; )
                _0x490e85.preInit.pop()();
        _0x490e85.noExitRuntime = true,
        _0x1a237d(),
        window.gen = _0x4176e8.gen = function(x) {
            for (var a = x.length, e = _0x490e85._malloc(a), t = new Uint8Array(_0x490e85.HEAPU8.buffer,e,a), n = 0; n < a; n++)
                t[n] = x.charCodeAt(n);
            _0x490e85._gen(e, a);
            var _ = new Uint8Array(new ArrayBuffer(1 + a));
            return _[0] = 4,
            _.set(t, 1),
            _0x4f4e11(e),
            _
        }
    }
    ).call(this, _0x53c25f(27), "/")
}
, , function(x, a, e) {
    x.exports = e.p + "js/wauth.wasm"
}
, function(x, a, e) {
}
, function(x, a, e) {
    var t = e(3)
      , n = e(10)
      , _ = t.actions = {};
    _.spectate = (x=>{
    }
    ),
    _.spectateLockToggle = function() {
    }
    ,
    _.move = (()=>{
        var x = t.stopMovement ? t.camera.position : t.mouse
          , a = prepareData(9);
        a.setUint8(0, 16),
        a.setInt32(1, x.x, true),
        a.setInt32(5, x.y, true),
        t.send(a)
    }
    ),
    _.feed = function(x) {
        var a;
        arguments.length ? ((a = prepareData(2)).setUint8(0, 21),
        a.setUint8(1, +x)) : (a = prepareData(1)).setUint8(0, 21),
        t.send(a)
    }
    ,
    _.linesplit = (()=>{
        var x = t.mouse
          , a = x.x - t.camera.position.x
          , e = x.y - t.camera.position.y
          , n = Math.atan2(e, a);
        x.x = x.x + 1e5 * Math.cos(n),
        x.y = x.y + 1e5 * Math.sin(n),
        _.split(3),
        t.moveWaitUntil = Date.now() + 1e3
    }
    ),
    _.split = (x=>{
        _.move(),
        msg = prepareData(2),
        msg.setUint8(0, 17),
        msg.setUint8(1, x),
        t.send(msg),
        t.splitCount += x,
        t.splitCount <= 2 ? t.moveWaitUntil = Date.now() + 300 : (t.moveWaitUntil = 0,
        t.splitCount = 0)
    }
    ),
    _.zoom = (x=>{
        var a = 1 - n.cameraZoomSpeed / 100
          , e = 0;
        x.wheelDelta ? e = x.wheelDelta / -120 : x.detail && (e = x.detail / 3);
        var _ = Math.pow(a, e)
          , i = (t.zoom * _).clamp(t.zoomMin, 1);
        t.zoom = i
    }
    ),
    _.setZoomLevel = function(x) {
        var a = .8 / Math.pow(2, x - 1) * t.zoomScale;
        t.zoom = a
    }
    ,
    _.targetPlayer = (()=>{
        var x = _.findPlayerUnderMouse(true);
        x && (t.selectedPlayer = x.pid)
    }
    ),
    _.findPlayerUnderMouse = (x=>{
        for (var a = t.mouse, e = null, n = 1 / 0, _ = t.nodelist.filter(x=>x.pid).sort((x,a)=>x.size - a.size), i = 0; i < _.length; i++) {
            var r = _[i]
              , s = r.x - a.x
              , o = r.y - a.y
              , c = Math.sqrt(Math.abs(s * s + o * o)) - r.getRadius();
            if (x)
                c < n && (n = c,
                e = r);
            else if (c <= 0)
                return r
        }
        return e
    }
    ),
    _.toggleSkins = function(x) {
        x = void 0 === x ? !n.skinsEnabled : x,
        n.set("skinsEnabled", x),
        t.playerManager.reRenderPlayerTextures()
    },
    _.toggleNames = function(x) {
        x = void 0 === x ? !n.namesEnabled : x,
        n.set("namesEnabled", x)
    }
    ,
    _.toggleFood = function(x) {
        x = void 0 === x ? !n.foodVisible : x,
        n.set("foodVisible", x),
        t.scene.food.visible = x
    }
}
, , function(x, a, e) {
    e(3)
}
, function(x, a, e) {
    "use strict";
    var t = e(30);
    e.n(t).a
}
, function(x, a, e) {}
, , , , , , , , , , , , , , , , , , , , function(x, a, e) {
    "use strict";
    var t = e(31);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a) {
    var e = "seenNotifications";
    x.exports = new class {
        constructor() {
            this.seenList = this.parseSeen(localStorage[e])
        }
        parseSeen(x) {
            if (!x)
                return [];
            try {
                var a = JSON.parse(x);
                if (Array.isArray(a))
                    return a
            } catch (x) {
                console.error("notifications.parseSeen:", x.message)
            }
            return []
        }
        saveSeen() {
            try {
                localStorage[e] = JSON.stringify(this.seenList)
            } catch (x) {
                console.error("notifications.saveSeen:", x.message)
            }
        }
        isSeen(x) {
            return this.seenList.includes(x)
        }
        setSeen(x) {
            this.isSeen(x) ? console.warn(`Key "` + x + `" is already on the seen list`) : (this.seenList.push(x),
            this.saveSeen())
        }
        ifNotSeen(x, a) {
            this.isSeen(x) || a(this.setSeen.bind(this, x))
        }
    }
}
, function(x, a, e) {
    "use strict";
    var t = e(32);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a, e) {
    "use strict";
    var t = e(33);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a, e) {
    "use strict";
    var t = e(34);
    e.n(t).a
}
, function(x, a, e) {}
, , function(x, a, e) {
    "use strict";
    var t = e(35);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a, e) {
    "use strict";
    var t = e(36);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a, e) {
    "use strict";
    var t = e(37);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a, e) {
    "use strict";
    var t = e(38);
    e.n(t).a
}
, function(x, a, e) {}
, function(x, a) {
    PIXI.CanvasRenderer.prototype.render = function(x, a, e, t, n) {
        if (!this.view)
            return;
        this.renderingToScreen = !a,
        this.emit("prerender");
        const _ = this.resolution;
        a ? ((a = a.baseTexture || a)._canvasRenderTarget || (a._canvasRenderTarget = new PIXI.CanvasRenderTarget(a.width,a.height,a.resolution),
        a.source = a._canvasRenderTarget.canvas,
        a.valid = true),
        this.context = a._canvasRenderTarget.context,
        this.resolution = a._canvasRenderTarget.resolution) : this.context = this.rootContext;
        const i = this.context;
        if (a || (this._lastObjectRendered = x),
        !n) {
            const a = x.parent
              , e = this._tempDisplayObjectParent.transform.worldTransform;
            t ? (t.copy(e),
            this._tempDisplayObjectParent.transform._worldID = -1) : e.identity(),
            x.parent = this._tempDisplayObjectParent,
            x.updateTransform(),
            x.parent = a
        }
        i.save(),
        i.setTransform(1, 0, 0, 1, 0, 0),
        i.globalAlpha = 1,
        this._activeBlendMode = PIXI.BLEND_MODES.NORMAL,
        i.globalCompositeOperation = this.blendModes[PIXI.BLEND_MODES.NORMAL],
        navigator.isCocoonJS && this.view.screencanvas && (i.fillStyle = "black",
        i.clear()),
        (void 0 !== e ? e : this.clearBeforeRender) && (this.renderingToScreen ? this.transparent ? i.clearRect(0, 0, this.width, this.height) : (i.fillStyle = this._backgroundColorString,
        i.fillRect(0, 0, this.width, this.height)) : i.clearRect(0, 0, a.realWidth, a.realHeight));
        const r = this.context;
        this.context = i,
        x.renderCanvas(this),
        this.context = r,
        i.restore(),
        this.resolution = _,
        this.emit("postrender")
    }
}
, function(x, a, e) {
}
, function(x, a, e) {
}
]);
