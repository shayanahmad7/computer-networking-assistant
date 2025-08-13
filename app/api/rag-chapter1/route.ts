import OpenAI from 'openai';
import { findRelevantContent } from "@/lib/ai/embedding";
import { getCollections } from "@/lib/db/mongodb";
import { nanoid } from "@/lib/utils";

// Next.js API route configuration
export const maxDuration = 30; // Allow up to 30 seconds for AI processing
export const runtime = 'nodejs'; // Use Node.js runtime for OpenAI SDK compatibility
export const dynamic = 'force-dynamic'; // Disable static optimization for dynamic responses

// Initialize OpenAI client
// SECURITY: API key is securely loaded from environment variables
// No secrets are hardcoded in this file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * RAG-powered chat endpoint for Chapter 1 of Computer Networking
 * 
 * This endpoint:
 * 1. Receives user messages
 * 2. Searches MongoDB for relevant Chapter 1 content
 * 3. Uses OpenAI to generate educational responses
 * 4. Returns intelligent tutoring responses
 * 
 * SECURITY: All sensitive data (API keys, DB URIs) are in environment variables
 */
export async function POST(req: Request) {
  try {
    // Parse incoming message data
    const input: { messages: Array<{ role: 'user'|'assistant'; content: string }>; threadId?: string|null } = await req.json();
    const lastMessage = input.messages[input.messages.length - 1];
    const userQuery = lastMessage?.content || '';
    const threadId = input.threadId || nanoid();
    
    console.log('[RAG-CHAPTER1] User query:', userQuery);

    // Load thread history and persist the new user message
    const { threads, chatMemory, threadSummaries } = await getCollections();
    await threads.updateOne(
      { sessionId: threadId, chapter: 'chapter1' },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'user', content: userQuery, timestamp: new Date() } }
      },
      { upsert: true }
    );

    const threadDoc = await threads.findOne({ sessionId: threadId, chapter: 'chapter1' });
    const turnIndex = (threadDoc?.messages?.length || 0) + 1;
    const history = (threadDoc?.messages || []).slice(-12); // keep recent turns for chronology

    // Retrieve long-term memory: top N prior exchanges semantically related to this query
    // Embed user query and search chat_memory using Atlas Vector Search (if memory exists)
    let memoryContext = '';
    try {
      const priorCount = await chatMemory.countDocuments({ threadId });
      if (priorCount > 0) {
        const queryVec = await (await import('@/lib/ai/embedding')).generateEmbedding(userQuery);
        const memoryHits = await chatMemory.aggregate<{
          content: string;
          role: 'user'|'assistant';
          score: number;
        }>([
          {
            $vectorSearch: {
              queryVector: queryVec,
              path: 'embedding',
              numCandidates: 100,
              limit: 6,
              index: 'chat_memory_index',
              filter: { threadId }
            }
          },
          { $project: { _id: 0, content: 1, role: 1, score: { $meta: 'vectorSearchScore' } } }
        ]).toArray();
        if (memoryHits.length > 0) {
          memoryContext = memoryHits.map(h => `[${h.role}] ${h.content}`).join('\n');
        }
      }
    } catch (e) {
      console.log('[RAG-CHAPTER1] Memory retrieval skipped:', e);
    }

    // Search for relevant Chapter 1 content (vector + lexical hybrid)
    const searchResults = await findRelevantContent(userQuery, 4);
    console.log('[RAG-CHAPTER1] Found', searchResults.length, 'relevant results');

    // Prepare context from search results
    let contextText = '';
    if (searchResults.length > 0) {
      contextText = searchResults.map(r => r.name).join('\n\n');
    }

    // Create focused tutoring system prompt
    const systemPrompt = `You are an expert AI tutor for Chapter 1 of the textbook "Computer Networking: A Top-Down Approach" (Kurose & Ross).

Teaching policy:
- Only teach content from Chapter 1. Do not introduce material from later chapters or external sources unless the user explicitly asks for it.
- When the user mentions an explicit problem identifier (e.g., P1, P2, R1), first restate the exact problem statement verbatim if it appears in the provided context. Then guide the student through the reasoning, step-by-step.
- If the question is broad, offer to walk through Chapter 1 concepts in order (an interactive textbook experience).
- Never say you "don’t have access". If the exact text isn’t present, ask a short clarifying question or answer with the best Chapter 1 knowledge you have.
- Prefer concise, structured explanations, with small examples.
- When relevant, name the concept and relate it back to Chapter 1 sections.
- If the user asks for "next parts" of a problem, you must look in the provided context for the subsequent subparts (e.g., parts c, d, e) and continue in order. If they are not present, explicitly say which parts are not available and ask if you should proceed with general guidance.
- Math formatting: render inline math with $...$ and display math with $$...$$. Avoid other delimiters like [ ... ].

Key Chapter 1 topics include: Internet structure, protocols, network edge/core, packet vs. circuit switching, delay/throughput, protocol layers, and basic security.

${contextText ? `Context extracted from Chapter 1:

${contextText}

Use this context as authoritative for wording and definitions.` : 'No specific Chapter 1 passages were found for this query. Answer using only Chapter 1 knowledge.'}`;

    const summaryDoc = await threadSummaries.findOne({ threadId, chapter: 'chapter1' });
    const summaryBlock = summaryDoc?.summary ? `\n\nConversation summary (so far):\n${summaryDoc.summary}` : '';
    const memoryBlock = memoryContext
      ? `\n\nRelevant prior conversation excerpts:\n${memoryContext}`
      : '';

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt + summaryBlock + memoryBlock },
        ...history.map(m => ({ role: m.role, content: m.content } as { role: 'user'|'assistant'; content: string })),
        { role: "user", content: userQuery }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try rephrasing your question.';
    
    console.log('[RAG-CHAPTER1] Response generated, length:', aiResponse.length);

    // Save assistant message
    await threads.updateOne(
      { sessionId: threadId, chapter: 'chapter1' },
      {
        $set: { updatedAt: new Date() },
        $push: { messages: { role: 'assistant', content: aiResponse, timestamp: new Date() } }
      }
    );

    // Store chat memory embeddings for long-term retrieval
    try {
      const items = [
        { role: 'user' as const, content: userQuery },
        { role: 'assistant' as const, content: aiResponse }
      ];
      const embeddings = await Promise.all(items.map(async (it) => ({
        role: it.role,
        content: it.content,
        embedding: await (await import('@/lib/ai/embedding')).generateEmbedding(it.content)
      })));
      const docs = embeddings.map((e, idx) => ({
        threadId,
        role: e.role,
        turn: turnIndex + idx,
        content: e.content,
        embedding: e.embedding,
        createdAt: new Date()
      }));
      await chatMemory.insertMany(docs);
    } catch (e) {
      console.log('[RAG-CHAPTER1] Memory write skipped:', e);
    }

    return Response.json({
      content: aiResponse,
      searchResults: searchResults.length,
      hasContext: contextText.length > 0,
      threadId
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RAG-CHAPTER1] Error:', error);
    return Response.json(
      { error: 'Failed to process request', details: message },
      { status: 500 }
    );
  }
}

// Fetch a thread's messages
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');
  if (!threadId) {
    return Response.json({ error: 'threadId is required' }, { status: 400 });
  }
  const { threads } = await getCollections();
  const thread = await threads.findOne({ sessionId: threadId, chapter: 'chapter1' });
  return Response.json({ messages: thread?.messages || [] });
}
