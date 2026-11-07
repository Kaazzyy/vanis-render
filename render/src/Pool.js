const fs = require("fs");
const Path = require("path");

module.exports = class Pool {
    constructor(app) {
        this.app = app;
        this.queue = {};
        this.path = Path.resolve(__dirname, "..", "pool.json");
        this.read();
    }

    read() {
        try {
            if (!fs.existsSync(this.path)) {
                this.queue = {};
                this.write();
                return;
            }
            let raw = fs.readFileSync(this.path, "utf-8");
            // FIX BOM: remove \uFEFF and trim
            raw = raw.replace(/^\uFEFF/, "").trim();
            if (!raw) raw = "{}";
            this.queue = JSON.parse(raw);
        } catch (e) {
            console.error("[Pool] pool.json corrompido, resetando:", e.message);
            this.queue = {};
            try { this.write(); } catch {}
        }
    }

    write() {
        try {
            // Escreve sem BOM, ASCII puro
            fs.writeFileSync(this.path, JSON.stringify(this.queue), { encoding: "utf-8" });
        } catch (e) {
            console.error("[Pool] Erro ao escrever pool.json", e);
        }
    }

    add(task) {
        this.queue[task.hash] = task;
        this.write();
    }

    // v26: `isBusy(hash)` lets the caller skip tasks that are already rendering — the head of the
    // queue used to be offered forever, so one stuck task blocked every later one.
    offer(isBusy) {
        for (const hash of Object.keys(this.queue)) {
            if (isBusy && isBusy(hash)) continue;
            return this.queue[hash];
        }
        return null;
    }

    done(hash) {
        delete this.queue[hash];
        this.write();
    }
}