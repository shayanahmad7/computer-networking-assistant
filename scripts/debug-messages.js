require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function debugMessages() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');

  console.log('=== DEBUGGING MESSAGES STRUCTURE ===\n');

  // Check RAG messages (chat_threads collection)
  console.log('1. RAG Messages (chat_threads collection):');
  const chatThreadsCollection = db.collection('chat_threads');
  const ragChat = await chatThreadsCollection.findOne({}, { sort: { updatedAt: -1 } });

  if (ragChat) {
    console.log('RAG Chat ID:', ragChat._id);
    console.log('Messages count:', ragChat.messages?.length || 0);
    console.log('Messages structure:');
    ragChat.messages?.forEach((msg, idx) => {
      console.log(`  Message ${idx + 1}:`);
      console.log(`    Role: ${msg.role}`);
      console.log(`    Content length: ${msg.content?.length || 0}`);
      console.log(`    Has timestamp: ${!!msg.timestamp}`);
      console.log(`    Content preview: ${msg.content?.substring(0, 50)}...`);
      console.log('');
    });
  }

  // Check Standard messages (messages collection)
  console.log('2. Standard Messages (messages collection):');
  const messagesCollection = db.collection('messages');
  const standardChat = await messagesCollection.findOne({}, { sort: { createdAt: -1 } });

  if (standardChat) {
    console.log('Standard Chat ID:', standardChat._id);
    console.log('Thread ID:', standardChat.threadId);
    console.log('Messages count:', standardChat.messages?.length || 0);
    console.log('Messages structure:');
    standardChat.messages?.forEach((msg, idx) => {
      console.log(`  Message ${idx + 1}:`);
      console.log(`    Role: ${msg.role}`);
      console.log(`    Content length: ${msg.content?.length || 0}`);
      console.log(`    Has timestamp: ${!!msg.timestamp}`);
      console.log(`    Content preview: ${msg.content?.substring(0, 50)}...`);
      console.log('');
    });
  }

  // Check if there are chats with missing or incomplete messages
  console.log('3. Checking for incomplete chats:');

  const allRAGChats = await chatThreadsCollection.find({}).toArray();
  const incompleteRAG = allRAGChats.filter(chat => !chat.messages || chat.messages.length === 0);
  console.log(`RAG chats with no messages: ${incompleteRAG.length}`);

  const allStandardChats = await messagesCollection.find({}).toArray();
  const incompleteStandard = allStandardChats.filter(chat => !chat.messages || chat.messages.length === 0);
  console.log(`Standard chats with no messages: ${incompleteStandard.length}`);

  // Check for chats with only user messages (no AI responses)
  const userOnlyRAG = allRAGChats.filter(chat =>
    chat.messages && chat.messages.length > 0 &&
    !chat.messages.some(msg => msg.role === 'assistant')
  );
  console.log(`RAG chats with only user messages: ${userOnlyRAG.length}`);

  const userOnlyStandard = allStandardChats.filter(chat =>
    chat.messages && chat.messages.length > 0 &&
    !chat.messages.some(msg => msg.role === 'assistant')
  );
  console.log(`Standard chats with only user messages: ${userOnlyStandard.length}`);

  await client.close();
}

debugMessages().catch(console.error);
