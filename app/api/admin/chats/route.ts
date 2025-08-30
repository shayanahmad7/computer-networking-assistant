import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const ADMIN_PASSWORD = 'Professor6097';



interface ChatThread {
  _id?: string;
  sessionId: string;
  chapter: string;
  assistantType?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export async function GET(request: NextRequest) {
  try {
    // Check password authentication
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    if (!password || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Connect to MongoDB
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('computer_networking_assistant');

    // Fetch chats from all collections
    const chatThreadsCollection = db.collection<ChatThread>('chat_threads');

    // Get all chapter message collections
    const chapterCollections = [
      'chapter1_messages',
      'chapter2_messages',
      'chapter3_messages',
      'chapter4_messages',
      'chapter5_messages',
      'chapter6_messages',
      'chapter7_messages',
      'chapter8_messages',
      'messages' // fallback for old format
    ];

    // Get RAG chats (stored in chat_threads with chapter)
    const ragChats = await chatThreadsCollection
      .find({})
      .sort({ updatedAt: -1 })
      .toArray();

    // Get all chapter assistant chats
    const allChapterChats = [];
    for (const collectionName of chapterCollections) {
      try {
        const collection = db.collection(collectionName);
        const chats = await collection.find({}).sort({ lastUpdated: -1 }).toArray();
        console.log(`Found ${chats.length} chats in ${collectionName}`);

        // Add collection info to each chat
        chats.forEach(chat => {
          chat.collectionName = collectionName;
        });

        allChapterChats.push(...chats);
      } catch (error) {
        console.log(`Collection ${collectionName} not found or error:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.log(`Found ${ragChats.length} RAG chats and ${allChapterChats.length} chapter assistant chats`);

    await client.close();

    // Format the response
    const chapterNames: { [key: string]: string } = {
      '1': 'Computer Networks and the Internet',
      '2': 'Application Layer',
      '3': 'Transport Layer',
      '4': 'Network Layer',
      '5': 'Link Layer and LANs',
      '6': 'Wireless and Mobile Networks',
      '7': 'Multimedia Networking',
      '8': 'Security in Computer Networks'
    };

    const formattedRAGChats = ragChats.map(chat => {
      // Handle missing chapter field for RAG chats
      const chapter = chat.chapter || '1'; // Default to chapter 1 if missing
      // Clean up chapter name by removing 'chapter' prefix if it exists
      const cleanChapter = chapter.replace('chapter', '');



      return {
        id: chat._id,
        sessionId: chat.sessionId,
        userId: chat.sessionId, // Use sessionId as userId for now
        chapter: cleanChapter,
        chapterName: chapterNames[cleanChapter] || `Chapter ${cleanChapter}`,
        assistantType: 'Custom RAG',
        messageCount: chat.messages?.length || 0,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        firstMessage: chat.messages?.[0]?.content ?
          (chat.messages[0].content.substring(0, 100) + (chat.messages[0].content.length > 100 ? '...' : '')) :
          'No messages',
        lastMessage: chat.messages?.[chat.messages.length - 1]?.content ?
          (chat.messages[chat.messages.length - 1].content.substring(0, 100) + (chat.messages[chat.messages.length - 1].content.length > 100 ? '...' : '')) :
          'No messages',
        messages: (chat.messages || []).map(msg => ({
          role: msg.role,
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString()
        }))
      };
    });

    // Format chapter assistant chats
    const formattedChapterChats = allChapterChats.map(chat => {
      const messages = chat.messages || [];
      const collectionName = chat.collectionName || 'messages';

      // Extract chapter number from collection name
      const chapterMatch = collectionName.match(/chapter(\d+)_messages/);
      const chapterNumber = chapterMatch ? chapterMatch[1] : '1';
      const chapterNameFull = chapterNames[chapterNumber] || `Chapter ${chapterNumber}`;

      return {
        id: chat._id,
        sessionId: chat.threadId || 'unknown',
        userId: chat.userId || chat.threadId || 'unknown',
        chapter: chapterNumber,
        chapterName: chapterNameFull,
        assistantType: collectionName === 'messages' ? 'OpenAI Assistant (Legacy)' : 'OpenAI Assistant',
        collectionName: collectionName,
        messageCount: messages.length,
        createdAt: chat.createdAt || chat.lastUpdated || new Date(),
        updatedAt: chat.lastUpdated || chat.createdAt || new Date(),
        firstMessage: messages[0]?.content ?
          (messages[0].content.substring(0, 100) + (messages[0].content.length > 100 ? '...' : '')) :
          'No messages',
        lastMessage: messages[messages.length - 1]?.content ?
          (messages[messages.length - 1].content.substring(0, 100) + (messages[messages.length - 1].content.length > 100 ? '...' : '')) :
          'No messages',
        messages: messages.map((msg: { role: string; content?: string; timestamp?: Date; userId?: string }) => ({
          role: msg.role,
          content: msg.content || '',
          timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
          userId: msg.userId || chat.userId
        }))
      };
    });

    const allChats = [...formattedRAGChats, ...formattedChapterChats];

    return NextResponse.json({
      success: true,
      chats: allChats,
      total: allChats.length
    });

  } catch (error) {
    console.error('Error fetching admin chats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
