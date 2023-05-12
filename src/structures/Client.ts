import { Client as DJSClient } from 'discord.js';
import BannerUpdater from './BannerUpdater';
import { ActiveUsers } from './ActiveUsers';

export default class Client extends DJSClient {
    activeUsers = new ActiveUsers(this);

    constructor() {
        super({
            intents: 131071
        })
        this.on('ready', () => {
            new BannerUpdater(this);
        })
    }

    async start() {
        await this.login(process.env.TOKEN)
    }
}