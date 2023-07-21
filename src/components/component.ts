import { SlashCommandBuilder } from 'discord.js'

/**
 * Maps event names to functions that handle them
 */
export interface HandlerBundle {
    ready?: Function;
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
    commands: (SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">)[];

    // Conversely, a component must have at least one event handler
    handlers: HandlerBundle;

    constructor(name: string, commands: (SlashCommandBuilder | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">)[], handlers: HandlerBundle) {
        this.name = name;
        this.commands = commands;
        this.handlers = handlers;
        
        if (Object.keys(this.handlers).length === 0) {
            throw new Error(`Component ${this.name} has no event handlers`);
        }
    }
}
