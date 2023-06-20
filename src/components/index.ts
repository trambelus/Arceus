import path from 'path';
import { Client } from 'discord.js';
import { Component, HandlerBundle } from './component';
import { getFilePaths } from '../utils';

export async function getComponents(dir: string): Promise<Component[]> {
    const components: Component[] = [];

    // console.debug(`Searching for components in ${dir}...`)

    // Read all files and folders in the components directory
    const moduleFiles = getFilePaths(dir);

    // Import each file and add the default export to the components array
    for await (const filePath of moduleFiles) {

        // console.debug(`Found path ${filePath} in components directory.`)

        // Only load module files (index.js), and exclude the index.js file in the components directory itself
        if (!filePath.endsWith('index.js') || filePath === __filename) continue;

        // console.debug(`Loading component from ${filePath} in components directory...`);
        const componentModule = await import(filePath);

        if (componentModule.default) {;
            // Default export can be either a single component or a list of components
            const component = componentModule.default as Component | Component[];
            if (Array.isArray(component)) {
                components.push(...component);
            } else {
                components.push(component);
            }
            console.debug(`Loaded ${Array.isArray(component) ? component.map(c => c.name).join(', ') : component.name} from ${filePath}`)
        } else {
            console.warn(`Failed to load component from ${filePath} in components directory.`);
        }
    }
    return components;
}

export async function registerCommands(client: Client) {

    const components = await getComponents(path.join(__dirname, '..', 'components'))
    console.debug(`Loaded ${components.length} components.`)
    // Add event handlers for each command to the client
    for (const component of components) {
        if (!component.handlers) continue;
        for (const key of Object.keys(component.handlers)) {
            console.debug(`Registering ${key} handler for ${component.name} component...`)
            const handlerKey = key as keyof HandlerBundle;
            client.on(key, async (...args) => {
                // Since this wrapper isn't aware of event types, it's up to the handler to check if the event is the correct type and the command name is correct
                await component.handlers[handlerKey]?.(...args);
            });
        }
    }
    // Registering commands with Discord is done elsewhere, so we're done here.
}