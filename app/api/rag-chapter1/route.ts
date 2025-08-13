import OpenAI from 'openai';
import { findRelevantContent } from "@/lib/ai/embedding";

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
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];
    const userQuery = lastMessage?.content || '';
    
    console.log('[RAG-CHAPTER1] User query:', userQuery);

    // Search for relevant Chapter 1 content using MongoDB text search
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

Key Chapter 1 topics include: Internet structure, protocols, network edge/core, packet vs. circuit switching, delay/throughput, protocol layers, and basic security.

${contextText ? `Context extracted from Chapter 1:

${contextText}

Use this context as authoritative for wording and definitions.` : 'No specific Chapter 1 passages were found for this query. Answer using only Chapter 1 knowledge.'}`;

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const aiResponse = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try rephrasing your question.';
    
    console.log('[RAG-CHAPTER1] Response generated, length:', aiResponse.length);

    return Response.json({
      content: aiResponse,
      searchResults: searchResults.length,
      hasContext: contextText.length > 0
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
