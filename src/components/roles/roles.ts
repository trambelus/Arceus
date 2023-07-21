import { ChatInputCommandInteraction, MessageReaction, User, PermissionFlagsBits, PartialMessageReaction, PartialUser, Role, ChannelType } from 'discord.js'
import fs from 'fs';
import path from 'path';

const ROLE_ASSIGNMENTS_FILE = path.join(__dirname, 'role-assignments.json');

export class RolesManager {

    // Variable that maps message IDs to emoji IDs to role IDs
    private roleAssignments: Record<string, Record<string, string>> = {};

    constructor() {
        if (fs.existsSync(ROLE_ASSIGNMENTS_FILE)) {
            this.roleAssignments = JSON.parse(fs.readFileSync(ROLE_ASSIGNMENTS_FILE, 'utf8'));
        }
    }

    /**
     * Handles a chat input command interaction (/roles register, /roles unregister, /roles validate)
     * 
     * @param interaction - The interaction to handle
     */
    async handleInteraction(interaction: ChatInputCommandInteraction) {

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'register') {
            await this.registerCommand(interaction);
        }
        else if (subcommand === 'unregister') {
            await this.unregisterCommand(interaction);
        }
        else if (subcommand === 'validate') {
            await interaction.reply({ content: 'Not implemented yet.', ephemeral: false });
            // await this.validateCommand(interaction);
        }
        else if (subcommand === 'create') {
            await this.createRoleCommand(interaction);
        }
        else if (subcommand === 'delete') {
            await this.deleteRoleCommand(interaction);
        }
    }

    private async registerCommand(interaction: ChatInputCommandInteraction) {
        // Check if the bot user has the Manage Roles permission        
        if (!interaction.guild?.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            await interaction.reply({ content: 'I need the Manage Roles permission in this server to assign roles.', ephemeral: true });
            return;
        }

        const messageId = interaction.options.getString('msg')!;
        const emojiId = interaction.options.getString('emoji')!;
        const role = interaction.options.getRole('role')!;

        // Validate channel
        const channel = interaction.channel;
        if (!channel || !channel.isTextBased()) {
            await interaction.reply({ content: 'I can only assign roles for messages in text channels.', ephemeral: true });
            return;
        }

        // Validate message
        if (!messageId) {
            await interaction.reply({ content: 'Message ID is required.', ephemeral: true });
            return;
        }
        const message = await channel.messages.fetch(messageId);
        if (!message) {
            await interaction.reply({ content: `Message not found: ${messageId}`, ephemeral: true });
            return;
        }

        // Validate emoji
        if (!emojiId) {
            await interaction.reply({ content: 'Emoji ID is required.', ephemeral: true });
            return;
        }
        const emoji = await interaction.guild.emojis.fetch(emojiId);
        if (!emoji) {
            await interaction.reply({ content: `Emoji not found: ${emojiId}`, ephemeral: true });
            return;
        }
        // Check existing reactions in case the bot already reacted with this emoji
        const existingReaction = message.reactions.cache.find(r => r.emoji.id === emojiId);
        if (existingReaction?.me) {
            await interaction.reply({ content: `I already reacted to ${message.url} with ${emojiId}.`, ephemeral: true });
            return;
        }
        // Add the emoji to the message
        await message.react(emoji)
            .catch(async (error) => {
                await interaction.reply({ content: `Failed to react to ${message.url} with ${emojiId}.`, ephemeral: true });
                console.error(error);
                return;
            });

        // Role validation is up to Discord, so we don't need to validate the role here

        // Add the role to the role assignments
        this.roleAssignments[messageId] = this.roleAssignments[messageId] || {};
        this.roleAssignments[messageId][emojiId] = role.id;

        // Send confirmation message
        await interaction.reply({ content: `Reacting to ${message.url} with ${emojiId} will now assign the ${role.name} role.` });

        // Save the role assignments to disk
        fs.writeFileSync(ROLE_ASSIGNMENTS_FILE, JSON.stringify(this.roleAssignments, null, 2));
    }

    private async unregisterCommand(interaction: ChatInputCommandInteraction) {
        const messageId = interaction.options.getString('msg')!;
        const role = interaction.options.getRole('role')!;

        const emojiId = Object.keys(this.roleAssignments[messageId] || {}).find(emojiId => this.roleAssignments[messageId][emojiId] === role.id);
        if (!emojiId) {
            await interaction.reply({ content: `I'm not reacting to ${messageId} with any emoji that assigns the ${role.name} role.`, ephemeral: true });
            return;
        }
        // Remove the emoji from the message
        const message = await interaction.channel?.messages.fetch(messageId);
        if (!message) {
            await interaction.reply({ content: `Message not found: ${messageId}`, ephemeral: true });
            return;
        }
        const reactions = message.reactions.cache.get(emojiId)
        if (reactions) {
            await reactions.remove()
                .catch(() => { console.error(`Failed to remove reaction ${emojiId} from ${message.url}`); });
        }
        else {
            await interaction.reply({ content: `I'm not reacting to ${message.url} with ${emojiId}.`, ephemeral: true });
        }

    }

    private async validateCommand(interaction: ChatInputCommandInteraction) {

        const messageId = interaction.options.getString('msg', false);
        const validateAll = messageId === null;

        // Get list of message IDs to validate
        const messageIds = validateAll ? Object.keys(this.roleAssignments) : [messageId!];

        // For each message, ensure that each user who reacted with an emoji that assigns a role has that role
        // Also ensure that no user on the server has that role if they didn't react with the emoji
        for (const messageId of messageIds) {
            // Check if the messageId's key exists in the role assignments (it might not if messageId was specified in the command but not registered)
            if (!this.roleAssignments[messageId]) {
                await interaction.reply({
                    content: `Message ID ${messageId} not found in assignments map. If the message exists, it's safe to delete it and start over, because the bot isn't tracking any reactions for it.`,
                    ephemeral: true
                });
                return;
            }
            const emojiIds = Object.keys(this.roleAssignments[messageId] || {});
            const roleIds = Object.values(this.roleAssignments[messageId] || {});
            const message = await interaction.channel?.messages.fetch(messageId);
            if (!message) {
                await interaction.reply({ content: `Message not found: ${messageId}. Removing from assignments map and removing associated role assignments from all users on the server.`, ephemeral: true });
                return;
            }
        }
    }

    /**
     * Handles a reaction being added or removed from a message.
     * @param reaction 
     * @param user 
     * @param add 
     * @returns 
     */
    async handleReaction(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser, add: boolean) {
        // Ignore reactions from the bot
        if (user.bot) return;

        const messageId = reaction.message.id;
        const emoji = reaction.emoji.id!
        // TODO: clean up this debug logging
        console.debug(`Reaction on message ${messageId} - :${reaction.emoji.identifier}: (${emoji}) by ${user.username} (${user.id}) ${add ? 'added' : 'removed'}`)

        // Ignore reactions on messages that aren't in the role assignments
        if (!this.roleAssignments[messageId]) return;

        const roleId = this.roleAssignments[messageId]?.[emoji];
        if (!roleId) {
            console.debug(`No registered role found for emoji ${emoji} on message ${messageId}`);
            return;
        }

        const role = reaction.message.guild?.roles.cache.get(roleId);
        if (!role) {
            console.error(`Role was registered for emoji ${emoji} on message ${messageId}, but the role doesn't exist on the server.`);
            return;
        }

        const member = reaction.message.guild?.members.cache.get(user.id);
        if (!member) {
            console.error(`User ${user.id} reacted to message ${messageId} with emoji ${emoji}, but the user isn't a member of the server.`);
            return;
        }

        if (add) {
            await member.roles.add(role);
        } else {
            await member.roles.remove(role);
        }
    }

    private async createRoleCommand(interaction: ChatInputCommandInteraction) {
        const roleName = interaction.options.getString('role')!;

        // Check if the role already exists
        const existingRole = interaction.guild?.roles.cache.find(role => role.name === roleName);
        if (existingRole) {
            await interaction.reply({ content: `Role ${roleName} already exists.`, ephemeral: true });
            return;
        }
        // Create the role
        const role = await interaction.guild?.roles.create({
            name: roleName,
            color: 'Default',
            mentionable: false,
            hoist: false,
            permissions: [],
        });
        if (!role) {
            await interaction.reply({ content: `Failed to create role ${roleName}.`, ephemeral: true });
            return;
        }
        await interaction.reply({ content: `Created role ${roleName}.`, ephemeral: true });
    }

    private async deleteRoleCommand(interaction: ChatInputCommandInteraction) {
        const roleName = interaction.options.getString('role')!;
        const role = interaction.guild?.roles.cache.find(role => role.name === roleName);
        if (!role) {
            await interaction.reply({ content: `Role ${roleName} not found.`, ephemeral: true });
            return;
        }
        let errors: string[] = [];
        // Ensure that the role doesn't have any permissions
        if (Number(role.permissions.bitfield) !== 0 && !interaction.options.getBoolean('force', false)) {
            errors.push(`Role ${roleName} has permissions. Please remove them before deleting the role, or use the force option to delete the role anyway.`);
        }
        // Ensure that the role isn't assigned to any users
        if (role.members.size > 0 && !interaction.options.getBoolean('force', false)) {
            errors.push(`Role ${roleName} is assigned to ${role.members.size} users. Please remove it from all users before deleting the role, or use the force option to delete the role anyway.`);
        }
        // Check guild channels' permissions for the role
        const channels = interaction.guild?.channels.cache.filter(channel => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice);
        if (channels) {
            for (const channel of channels.values()) {
                const permissions = channel.permissionsFor(role);
                if (permissions?.has('ViewChannel') || permissions?.has('SendMessages') || permissions?.has('Connect')) {
                    errors.push(`Role ${roleName} has permissions in channel ${channel.name}. Please remove them before deleting the role, or use the force option to delete the role anyway.`);
                }
            }
        }
        if (errors.length === 1) {
            await interaction.reply({ content: errors[0], ephemeral: true });
            return;
        }
        else if (errors.length > 1) {
            await interaction.reply({ content: errors.map(e => `• ${e}`).join('\n'), ephemeral: true });
            return;
        }
        // Delete the role
        await role.delete();
        await interaction.reply({ content: `Deleted role ${roleName}.`, ephemeral: true });
    }
}
