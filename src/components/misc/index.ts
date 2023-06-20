import { Interaction, SlashCommandBuilder } from 'discord.js';
import { Component } from '../component';

export default new Component(
    'ping',
    [new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with pong, and the latency of the bot')
    ],
    {
        interactionCreate: async (interaction: Interaction) => {

            if (!interaction.isChatInputCommand() || interaction.commandName !== 'ping') return;

            // Get latency
            const start = Date.now();
            await interaction.deferReply();
            const latency = Date.now() - start;

            // Reply with latency
            let requesterName = interaction.user.tag;
            if (requesterName.endsWith('#0')) requesterName = requesterName.slice(0, -2);

            const embed = {
                title: '🏓 Pong!',
                description: `**Latency**: ${latency}ms`,
                color: 0x7289da,
                footer: {
                    text: `Requested by ${requesterName}`,
                    icon_url: interaction.user.displayAvatarURL()
                }
            }
            
            await interaction.editReply({ embeds: [embed] });
        }
    }
);