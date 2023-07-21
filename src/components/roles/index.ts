import { Interaction, MessageReaction, PartialMessageReaction, PartialUser, PermissionFlagsBits, PermissionsBitField, SlashCommandBuilder, User } from "discord.js";
import { RolesManager } from "./roles";
import { Component } from "../component";

const rolesManager = new RolesManager();

export default new Component(
    'roles',
    [new SlashCommandBuilder()
        .setName('roles')
        .setDescription('Manage roles and role-associated reactions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('register')
                .setDescription('Add a reaction to a message that will give a role to the user who reacts')
                .addStringOption(option =>
                    option
                        .setName('msg')
                        .setDescription('ID of the message to add the reaction to')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('ID of the emoji to react with')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to associate with this reaction')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('unregister')
                .setDescription('Remove a role-associated reaction from a message')
                .addStringOption(option =>
                    option
                        .setName('msg')
                        .setDescription('The message to remove the reaction from')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('role')
                        .setDescription('ID of the role to remove')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('validate')
                .setDescription('Ensure that every user with a role-associated reaction has that role, and no other users do.')
                .addStringOption(option =>
                    option
                        .setName('msg')
                        .setDescription('The message to validate reactions for, or blank to validate all messages')
                        .setRequired(false)
                )
            )
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new role')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('The name of the role to create')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('color')
                        .setDescription('The color of the role to create (leave blank for no color)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a role')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The role to delete')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option
                        .setName('force')
                        .setDescription('Delete the role even if it has permissions and members (default: false)')
                        .setRequired(false)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    ],
    {
        interactionCreate: async (interaction: Interaction) => {
            // Only handle slash commands in guilds
            if (interaction.isChatInputCommand() && interaction.commandName === 'roles' && !interaction.channel?.isDMBased()) {
                // Ensure that the user has permission to manage roles
                const permissions = (interaction.member?.permissions as PermissionsBitField) ?? new PermissionsBitField();
                if (!permissions.has(PermissionFlagsBits.ManageRoles)) {
                    await interaction.reply('You do not have permission to manage roles.');
                    return;
                }
                // The rest is handled by the roles manager
                await rolesManager.handleInteraction(interaction);
            }

        },

        messageReactionAdd: async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            await rolesManager.handleReaction(reaction, user, true);
        },
        
        messageReactionRemove: async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
            await rolesManager.handleReaction(reaction, user, false);
        }
    }
)