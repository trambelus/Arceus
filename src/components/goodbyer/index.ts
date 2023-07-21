import { GuildMember, PartialGuildMember } from 'discord.js';
import { Component } from '../component';
import { sendGoodbye } from './goodbyer'

export default new Component(
    'goodbyer',
    [],
    {
        guildMemberRemove: async (member: GuildMember | PartialGuildMember) => {
            await sendGoodbye(member);
        }
    }
);
