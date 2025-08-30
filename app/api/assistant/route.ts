import { AssistantResponse } from 'ai';
import OpenAI from 'openai';
import { MongoClient, Db } from 'mongodb';



interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  userId?: string;
  assistantId?: string;
}





const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const uri = process.env.MONGODB_URI || ''; // MongoDB connection string
const client = new MongoClient(uri);
let db: Db | null = null;

// Ensure MongoDB connection
async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db('computer_networking_assistant');
  }
}

// Get collection name based on assistant ID
function getCollectionName(assistantId: string): string {
  // Try to find by environment variable name pattern
  for (const [envKey, collectionName] of Object.entries({
    'ASSISTANT1_ID': 'chapter1_messages',
    'ASSISTANT2_ID': 'chapter2_messages',
    'ASSISTANT3_ID': 'chapter3_messages',
    'ASSISTANT4_ID': 'chapter4_messages',
    'ASSISTANT5_ID': 'chapter5_messages',
    'ASSISTANT6_ID': 'chapter6_messages',
    'ASSISTANT7_ID': 'chapter7_messages',
    'ASSISTANT8_ID': 'chapter8_messages',
  })) {
    if (process.env[envKey] === assistantId) {
      return collectionName;
    }
  }

  // Fallback: try to extract chapter number from assistant ID
  const chapterMatch = assistantId.match(/(\d+)/);
  if (chapterMatch) {
    return `chapter${chapterMatch[1]}_messages`;
  }

  // Default fallback
  return 'messages';
}

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

async function cancelActiveRuns(threadId: string) {
  const runs = await openai.beta.threads.runs.list(threadId);
  const cancellableRuns = runs.data.filter((run) => ['queued', 'in_progress'].includes(run.status));

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

async function saveMessageToDatabase(threadId: string, role: 'user' | 'assistant', content: string, assistantId?: string, userId?: string) {
  await connectToDatabase();

  const collectionName = assistantId ? getCollectionName(assistantId) : 'messages';
  const collection = db!.collection(collectionName);

  const message: ChatMessage = {
    role,
    content,
    timestamp: new Date(),
    ...(userId && { userId }),
    ...(assistantId && { assistantId })
  };

  console.log(`[DATABASE] Saving ${role} message to collection: ${collectionName}`);
  console.log(`[DATABASE] Thread: ${threadId}, User: ${userId || 'unknown'}`);

  try {
    const result = await collection.updateOne(
      { threadId },
      {
        $set: {
          lastUpdated: new Date(),
          ...(userId && { userId }),
          ...(assistantId && { assistantId })
        },
        $push: { messages: message },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { upsert: true }
    );

    console.log(`[DATABASE] Message saved successfully to ${collectionName}`);
    return result;
  } catch (error) {
    console.error(`[DATABASE] Error saving ${role} message to ${collectionName}:`, error);
    throw error;
  }
}

export async function POST(req: Request) {
  try {
    // Parse the request body
    const input: {
      threadId: string | null;
      message: string;
      assistantId: string;
      userId?: string; // Optional user ID
    } = await req.json();

    console.log(`[ASSISTANT] Processing request for assistant: ${input.assistantId}`);
    console.log(`[ASSISTANT] User ID: ${input.userId || 'not provided'}`);
    console.log(`[ASSISTANT] Thread ID: ${input.threadId || 'new thread'}`);
    console.log(`[ASSISTANT] User message: "${input.message.substring(0, 100)}..."`);



    // Create a thread if needed
    const threadId = input.threadId ?? (await openai.beta.threads.create({})).id;

    try {
      // Cancel any active runs before adding a new message
      await cancelActiveRuns(threadId);

      // Add user message to the thread and save it to the database
      console.log(`[ASSISTANT] Saving user message to database...`);
      const createdMessage = await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: input.message,
      });
      await saveMessageToDatabase(threadId, 'user', input.message, input.assistantId, input.userId);

      return AssistantResponse(
        { threadId, messageId: createdMessage.id },
        async ({ forwardStream }) => {
          // Run the assistant on the thread
          const runStream = openai.beta.threads.runs.stream(threadId, {
            assistant_id: input.assistantId,
          });

          // Forward run status with message deltas
          let runResult = await forwardStream(runStream);

          // Save assistant responses to the database
          if (runResult?.status === 'completed') {
            console.log(`[ASSISTANT] Run completed! Getting messages generated by this run...`);

            // Get messages from the specific run (only new messages generated by this run)
            const runMessages = await openai.beta.threads.runs.steps.list(threadId, runResult.id);
            console.log(`[ASSISTANT] Found ${runMessages.data.length} steps in this run`);

            let assistantMessagesSaved = 0;

            // Process each step to find assistant messages
            for (const step of runMessages.data) {
              if (step.type === 'message_creation' && step.step_details && 'message_creation' in step.step_details && step.step_details.message_creation?.message_id) {
                const messageId = step.step_details.message_creation.message_id;
                console.log(`[ASSISTANT] Processing message from run step: ${messageId}`);

                try {
                  // Get the specific message created in this run
                  const message = await openai.beta.threads.messages.retrieve(threadId, messageId);

                  if (message.role === 'assistant') {
                    // Handle OpenAI message content format
                    let content = '';
                    if (message.content && message.content.length > 0) {
                      for (const contentBlock of message.content) {
                        if (contentBlock.type === 'text' && contentBlock.text?.value) {
                          content += contentBlock.text.value;
                        }
                      }
                    }

                    if (content.trim()) {
                      console.log(`[ASSISTANT] Saving assistant message (${content.length} chars) from run ${runResult.id}`);
                      await saveMessageToDatabase(threadId, 'assistant', content, input.assistantId, input.userId);
                      assistantMessagesSaved++;
                    } else {
                      console.log(`[ASSISTANT] Empty assistant message from run step, skipping`);
                    }
                  }
                } catch (error) {
                  console.error(`[ASSISTANT] Error retrieving message ${messageId}:`, error);
                }
              }
            }

            console.log(`[ASSISTANT] Saved ${assistantMessagesSaved} new assistant messages from this run`);
          } else {
            console.log(`[ASSISTANT] Run failed with status: ${runResult?.status}`);
          }

          // Process requires_action states
          while (
            runResult?.status === 'requires_action' &&
            runResult.required_action?.type === 'submit_tool_outputs'
          ) {
            runResult = await forwardStream(
              openai.beta.threads.runs.submitToolOutputsStream(
                threadId,
                runResult.id,
                { tool_outputs: [] }
              )
            );
          }
        }
      );
    } catch (error) {
      console.error('Error in POST /api/assistant:', error);
      return new Response(
        JSON.stringify({ error: 'An error occurred while processing the request' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/assistant:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred while processing the request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
