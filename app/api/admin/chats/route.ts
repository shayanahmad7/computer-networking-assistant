import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI as string;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD as string;



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
        messages: (chat.messages || [])
          .sort((a: { timestamp: Date }, b: { timestamp: Date }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .map(msg => ({
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
        messages: messages
          .sort((a: { timestamp?: Date }, b: { timestamp?: Date }) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
          .map((msg: { role: string; content?: string; timestamp?: Date; userId?: string }) => ({
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

// DELETE endpoint for deleting individual chats
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatId, collectionName, password } = body;

    console.log('[DELETE] Attempting to delete chat:', { chatId, collectionName });

    // Verify admin password
    if (!password || password !== ADMIN_PASSWORD) {
      console.log('[DELETE] Unauthorized: Invalid password');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!chatId) {
      console.log('[DELETE] Error: chatId is required');
      return NextResponse.json(
        { error: 'chatId is required' },
        { status: 400 }
      );
    }

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('computer_networking_assistant');
    const { ObjectId } = require('mongodb');

    let deleteResult;
    let targetCollection = 'unknown';

    // Try different deletion strategies based on collection type
    if (collectionName && collectionName !== 'messages') {
      // Delete from chapter-specific collection (e.g., chapter1_messages, chapter2_messages)
      targetCollection = collectionName;
      const collection = db.collection(collectionName);

      if (collectionName.startsWith('chapter') && collectionName.endsWith('_messages')) {
        // For chapter collections, the chatId is the MongoDB _id (ObjectId)
        try {
          if (ObjectId.isValid(chatId)) {
            deleteResult = await collection.deleteOne({ _id: new ObjectId(chatId) });
            console.log(`[DELETE] Tried deleting by ObjectId from ${collectionName}:`, deleteResult.deletedCount);
          } else {
            console.log(`[DELETE] Invalid ObjectId format: ${chatId}`);
            deleteResult = { deletedCount: 0 };
          }
        } catch (e) {
          console.log(`[DELETE] ObjectId conversion failed for ${chatId}:`, e);
          deleteResult = { deletedCount: 0 };
        }
      } else if (collectionName === 'chat_threads') {
        // For RAG collection, the chatId is also the MongoDB _id (ObjectId)
        try {
          if (ObjectId.isValid(chatId)) {
            deleteResult = await collection.deleteOne({ _id: new ObjectId(chatId) });
            console.log(`[DELETE] Tried deleting by ObjectId from ${collectionName}:`, deleteResult.deletedCount);
          } else {
            console.log(`[DELETE] Invalid ObjectId format: ${chatId}`);
            deleteResult = { deletedCount: 0 };
          }
        } catch (e) {
          console.log(`[DELETE] ObjectId conversion failed for ${chatId}:`, e);
          deleteResult = { deletedCount: 0 };
        }
      } else {
        // Generic approach for other collections - try as ObjectId first
        try {
          if (ObjectId.isValid(chatId)) {
            deleteResult = await collection.deleteOne({ _id: new ObjectId(chatId) });
            console.log(`[DELETE] Tried deleting by ObjectId from ${collectionName}:`, deleteResult.deletedCount);
          } else {
            deleteResult = { deletedCount: 0 };
          }
        } catch (e) {
          deleteResult = { deletedCount: 0 };
        }

        // If ObjectId didn't work, try other fields
        if (deleteResult.deletedCount === 0) {
          deleteResult = await collection.deleteOne({ threadId: chatId });
          console.log(`[DELETE] Tried deleting by threadId from ${collectionName}:`, deleteResult.deletedCount);
        }

        if (deleteResult.deletedCount === 0) {
          deleteResult = await collection.deleteOne({ sessionId: chatId });
          console.log(`[DELETE] Tried deleting by sessionId from ${collectionName}:`, deleteResult.deletedCount);
        }
      }

    } else {
      // Try multiple collections for non-specific collectionName
      const collectionsToTry = ['chat_threads', 'messages'];

      for (const collName of collectionsToTry) {
        targetCollection = collName;
        const collection = db.collection(collName);

        // Always try ObjectId first since that's what the frontend passes
        try {
          if (ObjectId.isValid(chatId)) {
            deleteResult = await collection.deleteOne({ _id: new ObjectId(chatId) });
            console.log(`[DELETE] Tried deleting by ObjectId from ${collName}:`, deleteResult.deletedCount);
          } else {
            deleteResult = { deletedCount: 0 };
          }
        } catch (e) {
          deleteResult = { deletedCount: 0 };
        }

        if (deleteResult.deletedCount > 0) break;
      }
    }

    await client.close();

    if (deleteResult && deleteResult.deletedCount > 0) {
      console.log(`[DELETE] ✅ Successfully deleted chat ${chatId} from ${targetCollection}`);
      return NextResponse.json({
        success: true,
        message: 'Chat deleted successfully'
      });
    } else {
      console.log(`[DELETE] ❌ Chat ${chatId} not found in any collection`);
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('[DELETE] Error deleting chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
