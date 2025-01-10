import { AssistantResponse } from 'ai';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Parse the request body
    const input: {
      threadId: string | null;
      message: string;
    } = await req.json();

    // Create a thread if needed
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    // Add a message to the thread
    const createdMessage = await openai.beta.threads.messages.create(threadId, {
      role: 'user',
      content: input.message,
    });

    return AssistantResponse(
      { threadId, messageId: createdMessage.id },
      async ({ forwardStream }) => {
        // Run the assistant on the thread
        const runStream = openai.beta.threads.runs.stream(threadId, {
          assistant_id:
            process.env.ASSISTANT_ID ?? (() => {
              throw new Error('ASSISTANT_ID is not set');
            })(),
        });

        // Forward run status with message deltas
        let runResult = await forwardStream(runStream);

        // Process requires_action states
        while (
          runResult?.status === 'requires_action' &&
          runResult.required_action?.type === 'submit_tool_outputs'
        ) {
          runResult = await forwardStream(
            openai.beta.threads.runs.submitToolOutputsStream(
              threadId,
              runResult.id,
              { tool_outputs: [] } // No tool outputs to process
            )
          );
        }
      }
    );
  } catch (error) {
    console.error('Error in POST /api/assistant:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}