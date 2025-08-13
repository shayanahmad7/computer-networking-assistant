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

    // Create intelligent system prompt
    const systemPrompt = `You are an expert AI tutor for Chapter 1 of "Computer Networking: A Top-Down Approach" by Kurose and Ross.

You are knowledgeable, patient, and educational. Your role is to:
- Help students understand computer networking concepts
- Provide clear explanations with examples
- Guide learning progressively
- Be encouraging and supportive
- Connect concepts to real-world applications

Key Chapter 1 topics include: Internet structure, protocols, network edge/core, packet/circuit switching, delays, throughput, protocol layers, and network security basics.

${contextText ? `Here's relevant content from Chapter 1 that may help answer the question:

${contextText}

Use this context when relevant, but you can also draw from your general networking knowledge to provide comprehensive explanations.` : 'No specific Chapter 1 content was found for this query, but provide helpful networking guidance based on your knowledge of Chapter 1 concepts.'}`;

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
