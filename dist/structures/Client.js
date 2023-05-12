"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const BannerUpdater_1 = __importDefault(require("./BannerUpdater"));
const ActiveUsers_1 = require("./ActiveUsers");
class Client extends discord_js_1.Client {
    constructor() {
        super({
            intents: 131071
        });
        this.activeUsers = new ActiveUsers_1.ActiveUsers(this);
        this.on('ready', () => {
            new BannerUpdater_1.default(this);
        });
    }
    async start() {
        await this.login(process.env.TOKEN);
    }
}
exports.default = Client;
