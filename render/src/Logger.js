let logLevel;
try { ({ logLevel } = require("../config.json")); } catch {}
const fs = require("fs");

const LOG_PATH = __dirname + "/log";
if (!fs.existsSync(LOG_PATH)) fs.mkdirSync(LOG_PATH);

const out = fs.createWriteStream(`${LOG_PATH}/${Date.now()}.log`, "utf-8");

const writeLog = (mode, msg) => {
    if (process.env.pm_id || process.env.pm_id === 0) {
        console.log(`[Process_${process.env.pm_id}][${mode}] ${msg}`);
    } else {
        console.log(`[${mode}] ${msg}`);
    }
    out.writable && out.write(msg);
};

class Logger {

    static setLevel(level) {
        if (Number.isInteger(level) && level >= 0 && level < 5) {
            logLevel = level;
        } else {
            logLevel = 2;
        }
        // Logger.log(`Log level set to ${logLevel}`);
    }

    static debug(msg) {
        if (logLevel < 1) {
            writeLog("Debug", msg.toString());
        }
    }

    static verbose(msg) {
        if (logLevel < 2) {
            writeLog("Verbose", msg.toString());
        }
    }

    static log(msg) {
        if (logLevel < 3) {
            writeLog("Info", msg.toString());
        }
    }

    static warn(msg) {
        if (logLevel < 4) {
            writeLog("Warn", msg.toString());
        }
    }

    static error(msg) {
        if (msg instanceof Error) {
            writeLog("Error", msg.name + ": " + msg.message);
            if (msg.stack && msg.stack.replace(new RegExp("\n", "g"), "").trim())
                writeLog("Stack", "\n" + 
                    msg.stack.split("\n").slice(1).join("\n"));
                    
        } else if (msg instanceof String) {
            writeLog("Error", msg);
        } else {
            writeLog("Error", "");
            console.log(msg);
        }
    }

    static exit(msg) {
        writeLog(`${"Exit"}`, msg || "Unknown Reason");
        out.close();
    }
}

Logger.setLevel(logLevel);

Logger.DEBUG = 0;
Logger.VERBOSE = 1;
Logger.LOG = 2;
Logger.WARN = 3;
Logger.ERROR = 4;


module.exports = Logger;
