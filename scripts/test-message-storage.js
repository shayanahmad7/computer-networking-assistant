require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function testMessageStorage() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');
  const collection = db.collection('messages');

  console.log('=== TESTING MESSAGE STORAGE ===\n');

  // Get all message threads
  const threads = await collection.find({}).toArray();
  console.log(`Found ${threads.length} message threads\n`);

  // Analyze each thread
  for (let i = 0; i < Math.min(threads.length, 5); i++) {
    const thread = threads[i];
    console.log(`Thread ${i + 1}: ${thread.threadId}`);
    console.log(`Messages count: ${thread.messages?.length || 0}`);

    if (thread.messages && thread.messages.length > 0) {
      console.log('Messages:');
      thread.messages.forEach((msg, idx) => {
        console.log(`  ${idx + 1}. [${msg.role}] "${msg.content?.substring(0, 50)}${msg.content?.length > 50 ? '...' : ''}"`);
        console.log(`      Timestamp: ${msg.timestamp}`);
      });
    }

    // Count user vs assistant messages
    const userMessages = thread.messages?.filter(m => m.role === 'user') || [];
    const assistantMessages = thread.messages?.filter(m => m.role === 'assistant') || [];

    console.log(`  User messages: ${userMessages.length}`);
    console.log(`  Assistant messages: ${assistantMessages.length}`);
    console.log('');
  }

  // Summary
  console.log('=== SUMMARY ===');
  let totalUser = 0;
  let totalAssistant = 0;
  let totalMessages = 0;

  threads.forEach(thread => {
    const userCount = thread.messages?.filter(m => m.role === 'user').length || 0;
    const assistantCount = thread.messages?.filter(m => m.role === 'assistant').length || 0;

    totalUser += userCount;
    totalAssistant += assistantCount;
    totalMessages += userCount + assistantCount;
  });

  console.log(`Total threads: ${threads.length}`);
  console.log(`Total messages: ${totalMessages}`);
  console.log(`Total user messages: ${totalUser}`);
  console.log(`Total assistant messages: ${totalAssistant}`);

  if (totalAssistant === 0) {
    console.log('\n❌ WARNING: No assistant messages found! This is the issue.');
  }

  await client.close();
}

testMessageStorage().catch(console.error);
