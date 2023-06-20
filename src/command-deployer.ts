// Standalone (sorta) script to deploy all available commands to Discord via REST.
// Apparently this is better than deploying them on bot startup because of rate limits.
// I haven't ever hit a rate limit, but I'm not going to argue with the Discord.js devs.

import dotenv from 'dotenv';
import path from 'path';
import { REST, Routes } from 'discord.js'
import { getComponents } from './components';

dotenv.config();

async function deployCommands() {
    const components = await getComponents(path.join(__dirname, 'components'));

    if (!components) {
        console.error('No components found. Exiting...');
        return;
    }
    // Extract commands from components (only if they have commands)
    const commands = components.filter(component => component.commands.length > 0).flatMap((component) => component.commands);

    console.log(`Found ${components.length} components with ${commands.length} commands.`)

    // Grab and check environment variables
    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const clientId = process.env.DISCORD_APP_ID;
    if (!token) {
        throw 'No token found in environment variables.';
    }
    if (!guildId) {
        throw 'No guild ID found in environment variables.';
    }
    if (!clientId) {
        throw 'No client ID found in environment variables.';
    }

    const rest = new REST().setToken(token); // does this need a version?

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands for guild ${guildId}.`)

        const commandJson = commands.map((command) => command.toJSON());

        const result = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commandJson },
        );

        console.log('Successfully reloaded application (/) commands.');
        console.log(result);
    }
    catch (error) {
        console.error(error);
    }
}

deployCommands().then(() => {
    console.log('Successfully deployed commands.')
})
.catch((err) => {
    console.error('Failed to deploy commands.')
    console.error(err);
})
