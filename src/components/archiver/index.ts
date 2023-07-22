import { Client, Message, PartialMessage, SlashCommandBuilder, Interaction, TextChannel, ThreadChannel, MessageReaction, PartialMessageReaction } from 'discord.js'
import { Component } from '../component'
import { Archiver, ArchiveResult } from './archiver'

let archiver: Archiver | null;

export default 
    new Component(
        'archiver',
        [new SlashCommandBuilder()
            .setName('archive')
            .setDescription('Archive all messages in the specified channel')
            .addBooleanOption(option =>
                option
                    .setName('stoponexisting')
                    .setDescription('Whether to stop archiving when encountering a message that has already been archived')
                    .setRequired(false)
            )
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('The channel to archive')
                    .setRequired(false)
            ),
        new SlashCommandBuilder()
            .setName('archiveall')
            .setDescription('Archive all messages in all channels in this guild')
            .addBooleanOption(option =>
                option
                    .setName('stoponexisting')
                    .setDescription('Whether to stop archiving when encountering a message that has already been archived')
                    .setRequired(false)
            )
            .addNumberOption(option =>
                option
                    .setName('delay')
                    .setDescription('The delay between fetch requests, in milliseconds')
                    .setRequired(false)
            )
        ],
        {
            ready: async (client: Client) => {
                try {
                    archiver = new Archiver();
                    console.log('Archiver component initialized.')
                } catch (err) {
                    console.error(err);
                    console.error('WARNING: Archiver component failed to initialize. Archiving will not work.')
                    archiver = null;
                }
            },

            messageCreate: async (message: Message | PartialMessage) => {
                if (archiver === null) return;
                await archiver.archiveSingle(message);
            },

            messageUpdate: async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
                if (archiver === null) return;
                await archiver.messageUpdated(oldMessage, newMessage);
            },

            messageDelete: async (message: Message | PartialMessage) => {
                if (archiver === null) return;
                await archiver.messageDeleted(message);
            },

            messageReactionAdd: async (reaction: MessageReaction | PartialMessageReaction) => {
                if (archiver === null) return;
                const result = await archiver.reactionUpdated(reaction.message);
                // console.log(`reaction added: ${reaction.emoji.name}. Result: ${result.message}`);
            },

            messageReactionRemove: async (reaction: MessageReaction | PartialMessageReaction) => {
                if (archiver === null) return;
                const result = await archiver.reactionUpdated(reaction.message);
                // console.log(`reaction removed: ${reaction.emoji.name}. Result: ${result.message}`);
            },

            interactionCreate: async (interaction: Interaction) => {
                if (!interaction.isCommand()) return;
                if (!interaction.isChatInputCommand() || (interaction.commandName !== 'archive' && interaction.commandName !== 'archiveall')) return;

                // Don't return silently if archiving is not available, since the user tried to use the command
                if (archiver === null) {
                    await interaction.reply('Archiving is not available.');
                    return;
                }
                if (interaction.channel === null) {
                    await interaction.reply('This command cannot be used in DMs.');
                    return;
                }

                const stopOnExisting = interaction.options.getBoolean('stoponexisting') || true;
                // This may take a while, so we want to let the user know we're working on it
                await interaction.reply({ content: 'Archiving...', ephemeral: interaction.commandName === 'archiveall' });

                // If the user specified a delay, use that. Otherwise, use the default.
                const delay = interaction.options.getNumber('delay') || 100;

                let result: ArchiveResult | null = null;

                // archive command
                if (interaction.commandName === 'archive') {
                    // If the user specified a channel, use that. Otherwise, use the current channel.
                    const channel = interaction.options.getChannel('channel') || interaction.channel;
                    // Must be a text-based channel (for now)
                    if (!(channel instanceof TextChannel || channel instanceof ThreadChannel)) {
                        await interaction.editReply('Archiving is only supported in text channels and threads.');
                        return;
                    }
                    result = await archiver.archiveAll(channel, stopOnExisting);
                }

                // archiveall command
                else if (interaction.commandName === 'archiveall') {
                    if (!interaction.guild) {
                        await interaction.editReply('This command cannot be used in DMs.');
                        return;
                    }
                    result = await archiver.archiveAllInGuild(interaction.guild, stopOnExisting, delay);
                }

                if (result !== null) {
                    console.log(`archiveAll: ${result.message}`)
                    await interaction.editReply(result.message);
                }
            }
        }
);
