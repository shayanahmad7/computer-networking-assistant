// Structured ingestion for Chapter 1: structure-aware chunking with metadata
// 1) Clean and parse PDF
// 2) Build breadcrumbs (section/subsection/problem/subpart)
// 3) Token-bounded chunks (~600-800 tokens) with 15% overlap, content-aware
// 4) Optional contextual titles per chunk
// 5) Embed with OpenAI text-embedding-3-small (1536 dims) or 3-large if configured
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { MongoClient } = require('mongodb');
const OpenAI = require('openai');
const { encoding_for_model } = require('@dqbd/tiktoken');

const MONGODB_URI = process.env.MONGODB_URI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large';

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('❌ Missing MONGODB_URI or OPENAI_API_KEY');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function cleanPdfText(raw) {
  // Normalize whitespace, remove page headers/footers heuristically
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/-\n/g, '') // dehyphenate line breaks
    .trim();
}

function splitIntoParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

function detectStructure(paragraph) {
  // Very light heuristics for headings/problems/subparts
  // Headings like: 1., 1.1, 1.2.3 Title
  const headingMatch = paragraph.match(/^\s*(\d+(?:\.\d+)*)(?:\s+|\.)/);
  const problemMatch = paragraph.match(/\bP\s*([0-9]+)\b/i);
  const reviewMatch = paragraph.match(/\bR\s*([0-9]+)\b/i);
  const subpartMatch = paragraph.match(/\((?:[a-z])\)|\b(?:a\)|b\)|c\)|d\)|e\))\b/i);
  return {
    heading: headingMatch ? headingMatch[1] : null,
    problemId: problemMatch ? `P${problemMatch[1]}` : (reviewMatch ? `R${reviewMatch[1]}` : null),
    subpart: subpartMatch ? subpartMatch[0].replace(/[()\s]/g, '').replace('|','').toLowerCase().charAt(0) : null,
  };
}

function tokenize(text, enc) {
  return enc.encode(text);
}

function detokenize(tokens, enc) {
  return enc.decode(tokens);
}

function buildChunks(paragraphs, maxTokens = 700, overlapRatio = 0.15) {
  const enc = encoding_for_model('gpt-4o-mini'); // compatible tokenizer
  const chunks = [];
  let buffer = [];
  let bufferTokens = 0;
  let lastMeta = { breadcrumbs: [], problemId: null, subpart: null };

  const overlapTokens = Math.floor(maxTokens * overlapRatio);

  for (const p of paragraphs) {
    const meta = detectStructure(p);
    const tks = tokenize(p, enc);
    const pTokens = tks.length;
    const pushChunk = () => {
      if (buffer.length === 0) return;
      const content = buffer.join('\n\n');
      chunks.push({ content, meta: { ...lastMeta } });
      // overlap tail tokens
      if (overlapTokens > 0) {
        let kept = [];
        let count = 0;
        // keep from the end until overlapTokens
        for (let i = buffer.length - 1; i >= 0 && count < overlapTokens; i--) {
          const tokens = tokenize(buffer[i], enc);
          kept.unshift(buffer[i]);
          count += tokens.length;
        }
        buffer = kept;
        bufferTokens = count;
      } else {
        buffer = [];
        bufferTokens = 0;
      }
    };

    // update breadcrumbs/problem context
    if (meta.heading) {
      lastMeta.breadcrumbs = [meta.heading];
    }
    if (meta.problemId) lastMeta.problemId = meta.problemId;
    if (meta.subpart) lastMeta.subpart = meta.subpart;

    if (bufferTokens + pTokens > maxTokens) {
      pushChunk();
    }
    buffer.push(p);
    bufferTokens += pTokens;
  }

  if (buffer.length > 0) {
    const content = buffer.join('\n\n');
    chunks.push({ content, meta: { ...lastMeta } });
  }

  enc.free && enc.free();
  return chunks;
}

async function embed(text) {
  const cleaned = text.replace(/\n/g, ' ');
  const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: cleaned });
  return resp.data[0].embedding;
}

async function contextualTitle(text) {
  // Optional: short 1-2 sentence summary title using GPT-4o-mini
  try {
    const sys = 'Write a 1-2 sentence, factual summary title for the provided passage. No fluff.';
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: sys }, { role: 'user', content: text.slice(0, 2000) }],
      temperature: 0.2,
      max_tokens: 80,
    });
    return res.choices[0]?.message?.content?.trim() || '';
  } catch {
    return '';
  }
}

async function main() {
  const pdfPath = path.join(process.cwd(), 'public', 'bookchapters', 'chapter 1.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.error('❌ PDF not found at', pdfPath);
    process.exit(1);
  }

  const data = await pdf(fs.readFileSync(pdfPath));
  const text = cleanPdfText(data.text);
  const paragraphs = splitIntoParagraphs(text);

  const chunks = buildChunks(paragraphs, 700, 0.15);
  console.log(`Chunks: ${chunks.length}`);

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('computer_networking_assistant');
  const resources = db.collection('resources');
  const embeddingsCol = db.collection('embeddings');

  // Clear existing (optional)
  await resources.deleteMany({});
  await embeddingsCol.deleteMany({});

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const title = await contextualTitle(c.content);
    const id = `${i}-${Date.now()}`;
    const doc = {
      id,
      content: c.content,
      title,
      breadcrumbs: c.meta.breadcrumbs || [],
      problemId: c.meta.problemId || null,
      subpart: c.meta.subpart || null,
      createdAt: new Date(),
    };
    const emb = await embed(`${title ? title + '\n' : ''}${c.content}`);
    await Promise.all([
      resources.insertOne(doc),
      embeddingsCol.insertOne({
        id: `${id}-emb`,
        resourceId: id,
        content: c.content,
        title,
        breadcrumbs: c.meta.breadcrumbs || [],
        problemId: c.meta.problemId || null,
        subpart: c.meta.subpart || null,
        embedding: emb,
        createdAt: new Date(),
      })
    ]);
    if (i % 25 === 0) console.log(`Ingested ${i}/${chunks.length}`);
  }

  await client.close();
  console.log('✅ Structured ingestion complete.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});


