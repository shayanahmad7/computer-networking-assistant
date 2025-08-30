require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

async function countChats() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');
  const collection = db.collection('chat_threads');

  const totalCount = await collection.countDocuments();
  console.log(`Total chats in database: ${totalCount}`);

  // Get distinct chapters
  const chapters = await collection.distinct('chapter');
  console.log(`Chapters found: ${chapters.join(', ')}`);

  // Count by chapter
  for (const chapter of chapters) {
    const count = await collection.countDocuments({ chapter });
    console.log(`Chapter ${chapter}: ${count} chats`);
  }

  // Get recent chats
  const recentChats = await collection
    .find({})
    .sort({ updatedAt: -1 })
    .limit(5)
    .toArray();

  console.log('\nRecent chats:');
  recentChats.forEach((chat, index) => {
    console.log(`${index + 1}. Chapter ${chat.chapter}: ${chat.messages?.length || 0} messages, Updated: ${chat.updatedAt}`);
  });

  await client.close();
}

countChats().catch(console.error);
