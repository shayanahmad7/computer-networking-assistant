require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testNewMessageSystem() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');

  console.log('=== TESTING NEW MESSAGE SYSTEM ===\n');

  // Check all chapter collections
  const collections = [
    'chapter1_messages',
    'chapter2_messages',
    'chapter3_messages',
    'chapter4_messages',
    'chapter5_messages',
    'chapter6_messages',
    'chapter7_messages',
    'chapter8_messages',
    'messages' // legacy
  ];

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();

      if (count > 0) {
        console.log(`📁 ${collectionName}: ${count} chats`);

        // Get one sample chat to check structure
        const sampleChat = await collection.findOne({}, { sort: { lastUpdated: -1 } });
        if (sampleChat) {
          console.log(`   Sample: ${sampleChat.threadId}`);
          console.log(`   User ID: ${sampleChat.userId || 'not set'}`);
          console.log(`   Assistant ID: ${sampleChat.assistantId || 'not set'}`);
          console.log(`   Messages: ${sampleChat.messages?.length || 0}`);

          if (sampleChat.messages && sampleChat.messages.length > 0) {
            const userMsgs = sampleChat.messages.filter(m => m.role === 'user').length;
            const assistantMsgs = sampleChat.messages.filter(m => m.role === 'assistant').length;
            console.log(`   User messages: ${userMsgs}, Assistant messages: ${assistantMsgs}`);
          }
          console.log('');
        }
      }
    } catch (error) {
      console.log(`❌ ${collectionName}: Collection doesn't exist or error`);
    }
  }

  // Check RAG collection
  try {
    const ragCollection = db.collection('chat_threads');
    const ragCount = await ragCollection.countDocuments();
    console.log(`📁 chat_threads (RAG): ${ragCount} chats`);

    if (ragCount > 0) {
      const sampleRAG = await ragCollection.findOne({}, { sort: { updatedAt: -1 } });
      if (sampleRAG) {
        console.log(`   Sample RAG: ${sampleRAG.sessionId}`);
        console.log(`   Messages: ${sampleRAG.messages?.length || 0}`);
        console.log('');
      }
    }
  } catch (error) {
    console.log(`❌ chat_threads: Error - ${error.message}`);
  }

  console.log('=== SUMMARY ===');
  let totalChats = 0;
  let totalCollections = 0;

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      if (count > 0) {
        totalChats += count;
        totalCollections++;
      }
    } catch (error) {
      // Collection doesn't exist
    }
  }

  // Add RAG chats
  try {
    const ragCollection = db.collection('chat_threads');
    const ragCount = await ragCollection.countDocuments();
    totalChats += ragCount;
    totalCollections++;
  } catch (error) {
    // RAG collection doesn't exist
  }

  console.log(`Total collections with data: ${totalCollections}`);
  console.log(`Total chats across all collections: ${totalChats}`);

  await client.close();
}

testNewMessageSystem().catch(console.error);
