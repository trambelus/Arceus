import { GuildMember } from 'discord.js';
import { Component } from '../component';
import { sendGoodbye } from './goodbyer';

export default new Component(
    'goodbyer',
    [],
    {
        guildMemberRemove: async (member: GuildMember) => {
            await sendGoodbye(member);
        }
    }
);
