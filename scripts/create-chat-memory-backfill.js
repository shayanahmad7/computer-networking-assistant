// One-time backfill: embed all past chat messages into chat_memory
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const OpenAI = require('openai');

const MONGODB_URI = process.env.MONGODB_URI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('Missing MONGODB_URI or OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const MODEL = 'text-embedding-3-small';

async function embed(text) {
  const input = text.replace(/\n/g, ' ');
  const resp = await openai.embeddings.create({ model: MODEL, input });
  return resp.data[0].embedding;
}

async function main() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');
  const threads = db.collection('chat_threads');
  const chatMemory = db.collection('chat_memory');

  const cursor = threads.find({});
  let processed = 0;
  while (await cursor.hasNext()) {
    const t = await cursor.next();
    const threadId = t.sessionId;
    const chapter = t.chapter;
    if (!Array.isArray(t.messages) || t.messages.length === 0) continue;

    for (let i = 0; i < t.messages.length; i++) {
      const m = t.messages[i];
      const exists = await chatMemory.findOne({ threadId, turn: i + 1 });
      if (exists) continue;
      const emb = await embed(m.content);
      await chatMemory.insertOne({
        threadId,
        role: m.role,
        turn: i + 1,
        content: m.content,
        embedding: emb,
        createdAt: m.timestamp || new Date(),
      });
    }

    processed += 1;
    console.log(`Backfilled thread ${threadId} (${chapter})`);
  }

  console.log(`Done. Threads processed: ${processed}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


