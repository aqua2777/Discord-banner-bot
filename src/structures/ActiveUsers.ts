import { Guild } from "discord.js";
import Client from "./Client";

const guildId = "1051462562413281290";

export class ActiveUsers extends Map {
    constructor(public client: Client) {
        super();
        client.on("message", (message) => {
            if(message.author.bot) return;
            if(message.guild.id !== guildId) return;
            
            this.message(message.author.id);
        })

        setInterval(() => { 
            (this.client.guilds.cache.get(guildId) as Guild).members.cache.filter(m => m.voice.channel).forEach(m => {
                this.checkUser(m.id);
                this.get(m.id).voice.push(Date.now());
                this.get(m.id).points += 2;
            })
            this.forEach((value, key) => {
                while(value.voice[0] && value.voice[0] < Date.now() - 60000 * 60 * 2) {
                    value.voice.shift()
                    value.points -= 2;
                }
                while(value.messages[0] && value.messages[0] < Date.now() - 60000 * 60 * 2) {
                    value.messages.shift()
                    value.points -= 1;
                }
            })
        }, 60000 * 5)
    }

    message(id: string) {
        this.checkUser(id);
        let messages = this.get(id).messages
        if(messages[messages.length - 1] < Date.now() - 60000 * 5)
            return 0;
        this.get(id).messages.push(Date.now());
        return this.get(id).points += 1;
    }

    checkUser(id: string) {
        if(!this.has(id))
            this.addUser(id);
    }

    addUser(id: string) {
        this.set(id, {
            messages: [],
            voice: [],
            points: 0,
            id
        })
    }

    getMostActiveUser() {
        let mostActiveUser = {
            points: 0,
            id: "1017493634418999426"
        };
        this.forEach((value, key) => {
            if(value.points > mostActiveUser.points)
                mostActiveUser = value;
        })
        return this.client.users.cache.get(mostActiveUser.id);
    }


}