import { Message, PartialMessage, SlashCommandBuilder, Interaction } from 'discord.js'
import { Component } from '../component'
import { Archiver } from './archiver'

let archiver: Archiver | null;
try {
    archiver = new Archiver();
} catch (err) {
    console.error(err);
    console.error('WARNING: Archiver component failed to initialize. Archiving will not work.')
    archiver = null;
}

export default 
    new Component(
        'archiver',
        [new SlashCommandBuilder()
            .setName('archive')
            .setDescription('Archive all messages in the current channel')
            .addBooleanOption(option =>
                option
                    .setName('archiveall')
                    .setDescription('Whether to continue archiving when encountering a message that has already been archived')
                    .setRequired(false)
            )
        ],
        {
            messageCreate: async (message: Message | PartialMessage) => {
                if (archiver === null) return;
                await archiver.archiveSingle(message);
            },
            interactionCreate: async (interaction: Interaction) => {
                if (archiver === null) return;
                if (!interaction.isCommand()) return;
                if (interaction.commandName !== 'archive' || !interaction.isChatInputCommand()) return;
                if (interaction.channel === null) {
                    await interaction.reply('This command cannot be used in DMs.');
                    return;
                }
                const getEntireHistory = interaction.options.getBoolean('archiveall') || true;
                // This may take a while, so we defer the reply to avoid a timeout.
                await interaction.deferReply();
                const result = await archiver.archiveAll(interaction.channel, getEntireHistory);
                console.log(`archiveAll: ${result.message}`)
                await interaction.reply(result.message);
            }
        }
);