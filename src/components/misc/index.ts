import { Interaction, SlashCommandBuilder, TextChannel } from 'discord.js';
import { Component } from '../component';

export default [
    new Component(
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
    ),
    new Component(
        'invite',
        [new SlashCommandBuilder()
            .setName('invite')
            .setDescription('Get an invite link for this channel')
        ],
        {
            interactionCreate: async (interaction: Interaction) => {
                    
                    if (!interaction.isChatInputCommand() || interaction.commandName !== 'invite') return;
                    // Ensure this isn't a DM channel
                    if (!interaction.channel || interaction.channel.isDMBased()) return;
                    const channel: TextChannel = interaction.channel as TextChannel;
                    const invite = await channel.createInvite({
                        maxAge: 0,
                        maxUses: 0,
                        unique: true,
                        reason: `Requested by ${interaction.user.tag}`
                    });
    
                    if (!invite) {
                        await interaction.reply('Failed to create invite');
                        return;
                    }
    
                    const embed = {
                        title: '📨 Invite Link',
                        description: invite.url,
                        color: 0x7289da,
                        footer: {
                            text: `Requested by ${interaction.user.tag}`,
                            icon_url: interaction.user.displayAvatarURL()
                        }
                    }
    
                    await interaction.reply({ embeds: [embed] });
            }
        }
    )
];
