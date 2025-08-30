require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function checkChats() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');
  const collection = db.collection('chat_threads');

  const count = await collection.countDocuments();
  console.log('Total chats in database:', count);

  // Get all chapters
  const chapters = await collection.distinct('chapter');
  console.log('Chapters found:', chapters);

  // Count by chapter
  for (const chapter of chapters) {
    const chapterCount = await collection.countDocuments({ chapter });
    console.log(`Chapter ${chapter}: ${chapterCount} chats`);
  }

  // Get a sample
  const sample = await collection.find({}).sort({ updatedAt: -1 }).limit(1).toArray();
  if (sample.length > 0) {
    console.log('Sample chat structure:');
    console.log(JSON.stringify({
      sessionId: sample[0].sessionId,
      chapter: sample[0].chapter,
      messageCount: sample[0].messages?.length || 0,
      createdAt: sample[0].createdAt,
      updatedAt: sample[0].updatedAt,
      firstMessage: sample[0].messages?.[0]?.content?.substring(0, 50) + '...'
    }, null, 2));
  }

  await client.close();
}

checkChats().catch(console.error);
