import { AttachmentBuilder, Guild, TextChannel } from "discord.js";
import Client from "./Client";
import canvas from "canvas";

//@ts-ignore
import GifFrames from "./../gif-frames/gif-frames.js" ;
//@ts-ignore
import GifEncoder from "./../gif-encoder-2/index.js";

const guildId = "1051462562413281290";


export default class BannerUpdater {
    constructor(public client: Client) {
        setInterval(() => {
            this.update();
        }, 60000)
    }

    async update() {
        let background = await canvas.loadImage(`${__dirname}/../../assets/background.gif`);
        let encoder: any;
        
        if(background.width < 960 && background.height < 540)
            if(background.width / background.height >= 960/540)
                encoder = new GifEncoder(background.height / 540 * 960, background.height);
            else
                encoder = new GifEncoder(background.width, background.width / 960 * 540);
        else
            encoder = new GifEncoder(960, 540);

        encoder.start();

        let nickname: string;
        let nickFont: string;
        let activeUser = this.client.activeUsers.getMostActiveUser();
        let avatar = await canvas.loadImage(activeUser?.avatarURL({ size: 128, extension: "png" }) || `${__dirname}/../../assets/unknown.png`);
        let voiceMembersCount = (this.client.guilds.cache.get(guildId) as Guild).members.cache.filter(m => m.voice.channel).size;

        GifFrames({ url: `${__dirname}/../../assets/background.gif`, frames: "all", outputType: "canvas", cumulative: true })
        .then((frames: any) => {
            frames.forEach( async (frame: any) => {

                let cnv = canvas.createCanvas(encoder.width, encoder.height);

                let ctx = cnv.getContext("2d");
        
                if(background.width / background.height >= cnv.width / cnv.height) {
                    let width = background.width / background.height * cnv.height;
                    let height = cnv.height;
                    let x = (cnv.width - width) / 2;
                    let y = 0;
                    ctx.drawImage(frame.getImage(), x, y, width, height);
                } else {
                    let width = cnv.width;
                    let height = background.height / background.width * cnv.width;
                    let x = 0;
                    let y = (cnv.height - height) / 2;
                    ctx.drawImage(frame.getImage(), x, y, width, height);
                }
        
                ctx.fillStyle = "#ffffff";
                ctx.font = "48px Uni Sans";
                ctx.textAlign = "center";
        
                ctx.fillText(voiceMembersCount.toString(), 371.5, 200);
        
                if(!nickname) {

                    nickname = activeUser?.username || "Неизвестный";
                    //nickname = "Очень длинный никнейм, который не влезает в баннер";
                    let dots = false;        
                    let fontSize = 48;

                    while(ctx.measureText(nickname).width > 170) {
                        if(fontSize > 30) {
                            fontSize -= 1;
                            ctx.font = fontSize + "px Uni Sans";
                            nickFont = fontSize + "px Uni Sans";
                        } else {
                            if(!dots) {
                                nickname = nickname.slice(0, -1) + "...";
                                dots = true;
                            }
                            else {
                                nickname = nickname.slice(0, -4) + "...";
                            }
                        }
                    }
                }
        
                ctx.font = nickFont;
                ctx.fillText(nickname, 185, 187);
        
                // Обрезать круг
        
                ctx.beginPath();
                ctx.arc(54, 175, 35, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
        
                ctx.drawImage(avatar, 19, 140, 70, 70);

                encoder.setDelay(frame.delay * 10);
                encoder.addFrame(ctx);
            })

            encoder.finish()

            // let attachment = new AttachmentBuilder(encoder.out.getData(), { name: "banner.gif" });

            // (this.client.channels.cache.get("1105934222339874907") as TextChannel).send({
            //     files: [attachment]
            // });

            this.client.guilds.cache.get(guildId)?.setBanner(encoder.out.getData());
        })

        
    }
}