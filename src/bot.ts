import dotenv from 'dotenv';
import { Client, Partials } from 'discord.js'

import { registerCommands } from './components';

dotenv.config();

const client = new Client({ 
    intents: ['Guilds', 'GuildMessages', 'GuildMessageReactions', 'GuildMembers', 'MessageContent'],
    partials: [Partials.Message, Partials.Reaction, Partials.User]
});

registerCommands(client);

client.once('ready', () => {
    console.log('Bot is ready!');
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
    throw 'No token found in environment variables.';
}
client.login(token);

process.on('SIGINT', () => {
    console.log('Caught interrupt signal. Shutting down...');
    client.destroy();
    process.exit();
});
