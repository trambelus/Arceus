import { SlashCommandBuilder } from 'discord.js'

/**
 * Maps event names to functions that handle them
 */
export interface HandlerBundle {
    interactionCreate?: Function;
    messageReactionAdd?: Function;
    messageReactionRemove?: Function;
    messageCreate?: Function;
    messageDelete?: Function;
    messageUpdate?: Function;
    guildMemberAdd?: Function;
    guildMemberRemove?: Function;
    guildMemberUpdate?: Function;
}

export class Component {

    name: string;

    // Note that an empty list is valid here, since a component may not be associated with any slash commands
    commands: SlashCommandBuilder[];

    // Conversely, a component must have at least one event handler
    handlers: HandlerBundle;

    constructor(name: string, commands: SlashCommandBuilder[], handlers: HandlerBundle) {
        this.name = name;
        this.commands = commands;
        this.handlers = handlers;
    }
}
