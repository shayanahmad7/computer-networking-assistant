require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testAdminData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');

  console.log('=== TESTING ADMIN DATA ===\n');

  // Test RAG chats (chat_threads collection)
  console.log('1. RAG Chats (chat_threads collection):');
  const chatThreadsCollection = db.collection('chat_threads');
  const ragChats = await chatThreadsCollection.find({}).limit(3).toArray();
  console.log(`Found ${await chatThreadsCollection.countDocuments()} RAG chats`);

  ragChats.forEach((chat, index) => {
    console.log(`  RAG Chat ${index + 1}:`);
    console.log(`    Session: ${chat.sessionId}`);
    console.log(`    Chapter: ${chat.chapter}`);
    console.log(`    Messages: ${chat.messages?.length || 0}`);
    console.log(`    Created: ${chat.createdAt}`);
    console.log('');
  });

  // Test Standard chats (messages collection)
  console.log('2. Standard Chats (messages collection):');
  const messagesCollection = db.collection('messages');
  const standardChats = await messagesCollection.find({}).limit(3).toArray();
  console.log(`Found ${await messagesCollection.countDocuments()} standard chats`);

  standardChats.forEach((chat, index) => {
    console.log(`  Standard Chat ${index + 1}:`);
    console.log(`    Thread ID: ${chat.threadId}`);
    console.log(`    Messages: ${chat.messages?.length || 0}`);
    console.log(`    Created: ${chat.createdAt}`);
    console.log('');
  });

  console.log('=== SUMMARY ===');
  console.log(`Total RAG chats: ${await chatThreadsCollection.countDocuments()}`);
  console.log(`Total Standard chats: ${await messagesCollection.countDocuments()}`);
  console.log(`Total chats: ${await chatThreadsCollection.countDocuments() + await messagesCollection.countDocuments()}`);

  await client.close();
}

testAdminData().catch(console.error);
