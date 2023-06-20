import { GuildMember, PartialGuildMember } from "discord.js";

const goodbyes = [
    "[user] has left the building.",
    "[user] just slipped out of the server.",
    "Sad to see you go, [user].",
    "Goodbye [user], we'll miss you!",
    "[user] is no longer with us.",
    "[user] has departed. Safe travels!",
    "It's a sad day, [user] has left us.",
    "[user] just vanished into thin air!",
    "Until next time, [user].",
    "[user] just took off.",
    "A wild [user] has fled.",
    "[user] hopped out of the server.",
    "Everyone say goodbye to [user]!",
    "Farewell, [user]. Don't be a stranger!",
    "[user] has left the party.",
    "So long, [user]. We'll remember you!",
    "[user] has exited stage left.",
    "[user] has disconnected. See you on the flip side!",
    "[user] retreated from the server.",
    "[user] is off the grid."
];

    // register() {
    //     this.client.on('guildMemberRemove', async member => {
    //         const goodbye = this.getGoodbye(member.displayName);
    //         await member.guild.systemChannel?.send(goodbye);
    //     });
    // }

export const sendGoodbye = async (member: GuildMember | PartialGuildMember) => {
    const displayName = member.displayName;
    const goodbyeTemplate = goodbyes[Math.floor(Math.random() * goodbyes.length)];
    const goodbye = goodbyeTemplate.replace('[user]', `**${displayName}**`);
    await member.guild.systemChannel?.send(goodbye);
}
