import { AssistantResponse } from 'ai';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

async function cancelActiveRuns(threadId: string) {
  const runs = await openai.beta.threads.runs.list(threadId);
  const cancellableRuns = runs.data.filter(run => ['queued', 'in_progress'].includes(run.status));

  for (const run of cancellableRuns) {
    try {
      const updatedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
      if (['queued', 'in_progress'].includes(updatedRun.status)) {
        await openai.beta.threads.runs.cancel(threadId, run.id);
        console.log(`Successfully cancelled run ${run.id}`);
      } else {
        console.log(`Run ${run.id} is already in ${updatedRun.status} status, no need to cancel`);
      }
    } catch (error) {
      console.error(`Failed to cancel run ${run.id}:`, error);
    }
  }
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const input: {
      threadId: string | null;
      message: string;
    } = await req.json();

    // Create a thread if needed
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    try {
      // Cancel any active runs before adding a new message
      await cancelActiveRuns(threadId);

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
      return new Response(JSON.stringify({ error: 'An error occurred while processing the request' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Error in POST /api/assistant:', error);
    return new Response(JSON.stringify({ error: 'An error occurred while processing the request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

