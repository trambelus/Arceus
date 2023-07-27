import { Client, Message, PartialMessage, Channel, Guild, TextChannel, TextBasedChannel } from 'discord.js';
import mongoose from 'mongoose';

export interface ArchiveResult {
    success: boolean;
    message: string;
    alreadyExists?: boolean;
    count?: number;
    channel?: string;
}

function timer(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class Archiver {

    private client: Client;

    // Schema for reaction data
    private reactionSchema = new mongoose.Schema({
        name: String,
        count: Number,
        users: [String],
    });
    // Schema for message content history
    private contentHistorySchema = new mongoose.Schema({
        timestamp: Number,
        content: String,
    });
    // Schema for general message data
    private messageSchema = new mongoose.Schema({
        _id: String,
        id: { type: String, unique: true, required: true },
        content: String,
        originalTimestamp: Number,
        contentHistory: [this.contentHistorySchema],
        // To avoid redundantly storing content, the content history is only populated after the message is edited.
        author: String,
        channel: String,
        guild: String,
        attachments: [String],
        embeds: [String],
        reactions: [this.reactionSchema],
        mentions: [String],
        pinned: Boolean,
        type: String,
        deletedTimestamp: Number,
    });

    private MessageModel = mongoose.model('Message', this.messageSchema);

    // True after the archiver has caught up on archiving messages since the last time it was running.
    private backlogComplete = false;

    // Queue to hold new messages while the archiver is catching up.
    private newMessageQueue: (Message | PartialMessage)[] = [];

    constructor(client: Client) {
        this.client = client;
        // Connect to MongoDB
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('No MongoDB URI found in environment variables.');
        }
        mongoose.connect(mongoUri);
        const db = mongoose.connection;
        db.on('connected', this.onConnected.bind(this));
        db.on('error', console.error.bind(console, 'MongoDB connection error:'));
    }

    onConnected() {
        console.log('MongoDB connection successful. Processing messages sent while the archiver was offline...');
        // Get a list of all unique channels in the database, and process them via archiveChannel.
        this.MessageModel.distinct('channel')?.exec()?.then((channels: string[]) => {
            console.log(`Found ${channels.length} channels in database.`);
            return Promise.all(channels.map(channel => this.client.channels.fetch(channel)));
        }).then((channels: (Channel | null)[]) => {
            console.log(`Fetched ${channels.length} channels.`);
            return Promise.all(channels.map(channel => {
                if (channel) {
                    return this.archiveChannel(channel, true, 100);
                } else {
                    console.log(`Channel with id ${channel} not found during backlog catchup. Skipping...`);
                    return Promise.resolve({
                        success: false,
                        message: 'Channel not found.',
                    });
                }
            }));
        }).then((results: ArchiveResult[]) => {
            // Log any errors.
            for (const result of results) {
                if (!result) return;
                if (!result.success) {
                    console.error(`Error during backlog catchup: ${result.message}`);
                } else if (result.count) {
                    console.log(`Backlog catchup: ${result.count} messages archived in ${result.channel}.`);
                }
            };
        }).catch(err => {
            console.error(`Error during backlog catchup: ${err}`);
        }).finally(() => {
            console.log('Backlog catchup complete.');
            // Process the new message queue.
            this.processNewMessageQueue();
        })
    }

    processNewMessageQueue() {
        console.log(`Processing new message queue. ${this.newMessageQueue.length} messages in queue.`);
        // Archive each message in the queue.
        Promise.all(this.newMessageQueue.map(message => this.archiveSingle(message))).then(results => {
            // Log any errors.
            results.forEach(result => {
                if (!result.success) {
                    console.error(`Error archiving message: ${result.message}`);
                }
            });
        }).catch(err => {
            console.error(`Error processing new message queue: ${err}`);
        }).finally(() => {
            // Clear the queue.
            this.newMessageQueue = [];
            // Set the backlog complete flag to true so that new messages are archived immediately.
            this.backlogComplete = true;
        });
    }

    async processMessage(message: Message | PartialMessage): Promise<ArchiveResult> {
        // Invokes archiveSingle unless the backlog is not yet complete, in which case it adds the message to the queue.
        if (this.backlogComplete) {
            return this.archiveSingle(message);
        }
        this.newMessageQueue.push(message);
        return {
            success: true,
            message: 'Message added to queue.',
        };
    }

    async archiveSingle(message: Message | PartialMessage): Promise<ArchiveResult> {
        
        // Disabling this check for now. The messages are already fetched, so might as well just archive them.
        // const existing = await this.MessageModel.findOne({ id: message.id });
        // if (existing) {
        //     return {
        //         success: false,
        //         message: 'Message already archived.',
        //         alreadyExists: true,
        //     };
        // }

        // If the message is a partial, fetch the full message.
        if (message.partial) {
            console.debug(`archiveSingle: Fetching partial message ${message.id}...`)
            try {
                await message.fetch();
            } catch (err) {
                console.error(`Error fetching partial message ${message.id}: ${err}`);
                return {
                    success: false,
                    message: `Error fetching partial message ${message.id}: ${err}`,
                };
            }
        }

        const messageData = new this.MessageModel({
            _id: message.id,
            id: message.id,
            content: message.content,
            originalTimestamp: message.createdTimestamp,
            contentHistory: [],
            author: message.author?.username,
            channel: message.channel?.id,
            guild: message.guild?.id,
            attachments: message.attachments.map(attachment => attachment.url),
            embeds: message.embeds.map(embed => embed.url),
            reactions: message.reactions.cache.map(reaction => ({
                name: reaction.emoji.name,
                count: reaction.count,
                // users: await reaction.users.fetch().then(users => Array.from(users).map(user => user[1].username)),
            })),
            mentions: message.mentions.users.map(user => user.username),
            pinned: message.pinned,
            type: message.type,
            deletedTimestamp: null,
        });
        try {

            await messageData.save();

        } catch (err) {
            let message = 'An unknown error occurred.';
            let alreadyExists = false;
            if (err instanceof Error) {
                message = err.message;
                if ((err as any).code === 11000) {
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
            message: `Message ${message.id} archived successfully.`,
            alreadyExists: false,
            count: 1,
        };
    }

    async reactionUpdated(message: Message | PartialMessage): Promise<ArchiveResult> {
        const messageData = await this.MessageModel.findOne({ id: message.id });
        if (!messageData) {
            // If the message doesn't exist in the database, just archive it.
            return await this.processMessage(message);
        }
        // If the message does exist, update its reaction data.
        // Update the message first, since the cache is out of date.
        await message.fetch();
        // TODO: look into handling added/removed reactions more finely than just updating the whole list
        // Won't need to fetch the message again if we do this, but the reaction list isn't guaranteed to be as accurate.
        this.MessageModel.updateOne(
            { id: message.id },
            {
                reactions: message.reactions.cache.map(reaction => ({
                    name: reaction.emoji.name,
                    count: reaction.count,
                }))
            },
            { new: true }
        ).exec();
        return {
            success: true,
            message: 'Message successfully updated.',
        }
    }

    async messageUpdated(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<ArchiveResult> {
        const messageData = await this.MessageModel.findOne({ id: newMessage.id });
        if (!messageData) {
            // If the message doesn't exist in the database, just archive it.
            return await this.processMessage(newMessage);
        }
        // If the message does exist, update it.
        // If content history isn't populated yet, add the original message content before the new.
        if (messageData.contentHistory.length === 0) {
            messageData.contentHistory.push({
                timestamp: messageData.originalTimestamp,
                content: messageData.content,
            });
        }
        messageData.contentHistory.push({
            timestamp: newMessage.editedTimestamp,
            content: newMessage.content,
        });
        // Also update the content field.
        messageData.content = newMessage.content!;

        try {
            await messageData.save();
        } catch (err) {
            return {
                success: false,
                message: `Error handling updated message ${newMessage.id}: ${err}`,
            };
        }
        return {
            success: true,
            message: 'Message successfully updated.',
            count: 1,
        };
    }

    async messageDeleted(message: Message | PartialMessage): Promise<ArchiveResult> {
        const messageData = await this.MessageModel.findOne({ id: message.id });
        if (!messageData) {
            return {
                success: false,
                message: 'Message not found in database.',
            };
        }
        // Discord's API doesn't provide a timestamp, so we use the current Unix time.
        messageData.deletedTimestamp = Math.floor(Date.now() / 1000);
        try {
            await messageData.save();
        } catch (err) {
            return {
                success: false,
                message: `Error handling deleted message ${message.id}: ${err}`,
            };
        }
        return {
            success: true,
            message: 'Message successfully marked as deleted.',
        };
    }

    async archiveChannel(channel: Channel, update: boolean, delay: number = 0): Promise<ArchiveResult> {

        if (!channel.isTextBased()) {
            return {
                success: false,
                message: 'Channel is not a text channel.',
            };
        }

        const channelName = channel.isDMBased()
            ? ('DM with ' + (channel?.recipient?.username || 'Unknown user'))
            : channel.isThread()
                ? `thread #${channel.name}`
                : `channel #${channel.name}`;

        let lastId;
        let archived = 0;

        console.log(`Archiving all messages in ${channelName}...`)
        
        // if update is true, get the last message in the database for this channel, and use it as the `after` option.
        // otherwise, leave it unspecified in the first iteration to get the most recent messages, and then use the last ID from the previous iteration as `before`.
        if (update) {
            const lastMessage = await this.MessageModel.findOne({ channel: channel.id }).sort({ originalTimestamp: -1 });
            if (lastMessage) {
                lastId = lastMessage.id;
            }
        }

        while (true) {
            const options = { limit: 100 };
            if (lastId) {
                // in update mode, we scan forwards. in archive mode, we scan backwards.
                if (update) {
                    (options as any)['after'] = lastId;
                } else {
                    (options as any)['before'] = lastId;
                }
            }
            // If delay is set, wait before fetching the next batch of messages.
            if (delay > 0) {
                await timer(delay);
            }
            // Fetch the next 100 messages.
            const messages = await channel.messages.fetch(options);
            console.log(`archiveAll: Fetched ${messages.size} messages.`)
            // For debug purposes: check if message ids are in ascending or descending order, and log this info.
            let lastTimestamp = 0;
            for (const message of messages.values()) {
                if (lastTimestamp === 0) {
                    lastTimestamp = message.createdTimestamp;
                    continue;
                }
                console.debug(`archiveAll: Messages are in ${message.createdTimestamp < lastTimestamp ? 'reverse ' : ''}chronological order; fetch flag is {${update ? 'after' : 'before'}: ${lastId}}.`);
                break;
            }
            // Archive each message.
            for (const message of messages.values()) {
                const result = await this.archiveSingle(message);
                // console.debug(JSON.stringify(result, null, 2))
                if (result.count) {
                    archived += result.count;
                }
                if (result.alreadyExists) {
                    // console.log(`archiveAll: Message ${message.id} already archived.`);
                    continue;
                }
                else if (!result.success) {
                    // Don't log the error if it's just a duplicate message.
                    if (!result.alreadyExists) {
                        console.log(`archiveAll: Error archiving message ${message.id}: ${result.message}`);
                    }
                    continue; // Don't break, just keep going. We want to archive as many messages as possible.
                }
            }
            // If we got less than 100 messages, we're done.
            if (messages.size < 100) {
                break;
            } else {
                // Otherwise, get the last message ID and keep going.
                // In update mode, it's the first message, since we're scanning forwards.
                lastId = update ? messages.first()?.id : messages.last()?.id;
            }
        }
        return {
            success: true,
            message: `${archived} messages archived in current channel.`,
            count: archived,
            channel: channelName,
        };
    }

    async archiveAllInGuild(guild: Guild, update: boolean, delay: number = 0): Promise<ArchiveResult> {
        // Get the guild.
        if (!guild) {
            return {
                success: false,
                message: 'Guild not found.',
            };
        }

        // Get all channels in the guild, including threads.
        const channels: TextBasedChannel[] = [];
        for (const channel of guild.channels.cache.values()) {
            // If the channel is not a text channel, skip it.
            if (!channel.isTextBased()) {
                continue;
            }
            // If the channel has threads, add them to the list of channels to archive.
            if (channel instanceof TextChannel) {
                channels.push(channel);
                const threads = channel.threads.cache.values();
                for (const thread of threads) {
                    if (thread.isTextBased()) {
                        // Pretty sure all threads are text-based, but this will make TypeScript happy.
                        channels.push(thread);
                    }
                }
            }
        }

        let count = 0;
        // Archive each channel.
        for (const channel of channels) {
            // If delay is set, wait before archiving the next channel.
            if (delay > 0) {
                await timer(delay);
            }
            // Archive the channel.
            const result = await this.archiveChannel(channel, update);
            if (!result.success) {
                return result;
            }
            // Add the number of messages archived to the total.
            count += result.count || 0;
        }
        return {
            success: true,
            message: `Archived ${count} messages in ${channels.length} channels.`,
            count: count,
        };
    }
}