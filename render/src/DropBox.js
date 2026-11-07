const logger = require("./Logger");

const { dropboxToken, dropboxClientId, 
    dropboxClientSecret } = require("../config.json");

const dropboxAPI = require("dropbox-v2-api");
const fs = require("fs");

module.exports = class DropBox {
    
    constructor() {
        // v27-hf: DropBox e opcional — sem token, os metodos rejeitam com erro claro
        // em vez de rebentar no arranque (o upload direto pro Discord continua a funcionar)
        this.enabled = typeof dropboxToken === "string" && dropboxToken.length > 10;
        if (!this.enabled) { this.box = null; return; }
        this.box = dropboxAPI.authenticate({ 
            token: dropboxToken,
            client_id: dropboxClientId,
            client_secret: dropboxClientSecret
        });
    }

    /** @returns {Number} */
    getQuota() {
        return new Promise((resolve, reject) => {

            logger.debug(`Getting quota left`);
        
            this.box({
                resource: 'users/get_space_usage',
            }, (err, result) => {
                if (err) reject(err);
                else resolve(result.allocation.allocated - result.used);
            });
        
        });
    }

    /**
     * @param {string} path
     * @param {string} hash 
     */
    upload(path, hash) {
        return new Promise((resolve, reject) => {

            logger.debug(`Uploading ${path} to DropBox`);

            this.box({
                resource: 'files/upload',
                parameters: {
                    path: `/${hash}.mp4`
                },
                readStream: fs.createReadStream(path)
            }, err => {
                if (err) reject(err);
                else this.getShareLink(hash).then(link => {
                    resolve(link + "&raw=1");
                });
            });
        });
    }

    getShareLink(hash) {
        return new Promise((resolve, reject) => {

            logger.verbose(`Getting share link for ${hash}`);
            this.box({
                resource: "sharing/create_shared_link_with_settings",
                parameters: {
                    path: `/${hash}.mp4`,
                    settings: {
                        requested_visibility: "public",
                        audience: "public",
                        access: "viewer"
                    }
                }
            }, (err, result) => {
                if (err) reject(err);
                else resolve(result.url);
            });
        });        
    }

    remove(path) {
        return new Promise((resolve, reject) => {

            this.box({
                resource: "files/delete_v2",
                parameters: { path }
            },  (err, result) => {
                if (err) reject(err);
                else resolve(result.url);
            });
        });
    }
}
