import { Message, PartialMessage, Channel } from 'discord.js';
import mongoose from 'mongoose';

interface ArchiveResult {
    success: boolean;
    message: string;
    alreadyExists?: boolean;
}

export class Archiver {

    // Schema for general message data
    messageSchema = new mongoose.Schema({
        id: { type: String, unique: true, required: true },
        content: String,
        author: String,
        channel: String,
        guild: String,
        originalTimestamp: Number,
        // Timestamps are Number instead of Date because that's what Discord provides.
        attachments: [String],
        embeds: [String],
        reactions: [String],
        mentions: [String],
        pinned: Boolean,
        type: String,
        editedTimestamps: [Number],
        previousContent: [String],
    });

    MessageModel = mongoose.model('Message', this.messageSchema);

    constructor() {
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('No MongoDB URI found in environment variables.');
        }
        mongoose.connect(mongoUri);
        const db = mongoose.connection;
        db.on('error', console.error.bind(console, 'MongoDB connection error:'));
    }

    async archiveSingle(message: Message | PartialMessage): Promise<ArchiveResult> {

        // Reaction JSON format: {"<:name:id>": [user1, user2], "😍": [user1, user2]}
        const reactionMap: { [key: string]: string[] } = {};
        message.reactions.cache.forEach(reaction => {
            if (reaction && reaction.emoji && reaction.users.cache) {
                reactionMap[reaction.emoji.name!] = reaction.users.cache.map(user => user.username);
            }
        });

        const reactionString = JSON.stringify(reactionMap);
        const messageData = new this.MessageModel({
            id: message.id,
            content: message.content,
            author: message.author?.username,
            channel: message.channel?.id,
            guild: message.guild?.id,
            originalTimestamp: message.createdTimestamp,
            attachments: message.attachments.map(attachment => attachment.url),
            embeds: message.embeds.map(embed => embed.url),
            reactions: reactionString,
            mentions: message.mentions.users.map(user => user.username),
            pinned: message.pinned,
            type: message.type,
            editedTimestamps: message.editedTimestamp ? [message.editedTimestamp] : [],
            // Subsequent edits will be added to this array by the edit event.
            // This should always be an empty array at the time of message creation, but messages edited before the bot was started will have a timestamp here.
            previousContent: [],
            // Subsequent edits will be added to this array by the edit event.
            // Only messages edited after the bot was started can have previous content.
        });
        try {

            await messageData.save();

        } catch (err) {
            let message = 'An unknown error occurred.';
            let alreadyExists = false;
            if (err instanceof Error) {
                message = err.message;
                if (err.name === 'MongoError' && (err as any).code === 11000) {
                    message = 'This message has already been archived.';
                    alreadyExists = true;
                }
            }
            return {
                success: false,
                message,
                alreadyExists,
            };
        }
        return {
            success: true,
            message: 'Message archived successfully.',
            alreadyExists: false,
        };
    }

    async archiveAll(channel: Channel, getEntireHistory: boolean): Promise<ArchiveResult> {
        if (!channel.isTextBased()) {
            return {
                success: false,
                message: 'Channel is not a text channel.',
            };
        }

        const channelName = channel.isDMBased()
            ? (channel?.recipient?.username || 'Unknown DM')
            : channel.name;

        let lastId;
        let archived = 0;

        console.log(`Archiving all messages in channel ${channelName}...`)
        while (true) {
            const options = { limit: 100 };
            if (lastId) {
                (options as any)['before'] = lastId;
            }
            // Fetch the next 100 messages.
            const messages = await channel.messages.fetch(options);
            console.log(`archiveAll: Fetched ${messages.size} messages.`)
            // Archive each message.
            for (const message of messages.values()) {
                const result = await this.archiveSingle(message);
                if (result.success) {
                    archived++;
                }
                if (result.alreadyExists) {
                    console.log(`archiveAll: Message ${message.id} already archived.`);
                    if (getEntireHistory) {
                        continue;
                    } else {
                        return {
                            success: true,
                            message: `${archived} messages archived successfully. Stopped after encountering message ${message.id}, which has already been archived.`,
                        };
                    }
                }
                if (!result.success) {
                    console.log(`archiveAll: Error archiving message ${message.id}: ${result.message}`);
                    continue; // Don't break, just keep going. We want to archive as many messages as possible.
                }
            }
            // If we got less than 100 messages, we're done.
            if (messages.size < 100) {
                break;
            } else {
                // Otherwise, get the last message ID and keep going.
                lastId = messages.last()?.id;
            }
        }
        return {
            success: true,
            message: `${archived} messages archived successfully.`,
        };
    }
}