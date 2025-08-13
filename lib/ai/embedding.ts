import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";
import { getCollections } from "../db/mongodb";
import { nanoid } from "../utils";

const embeddingModel = openai.embedding("text-embedding-3-small");

// Generate chunks from input text
const generateChunks = (input: string): string[] => {
  return input
    .trim()
    .split(/(?<=[.!?])\s+/) // Split on sentence endings
    .filter((chunk) => chunk.trim().length > 0)
    .map(chunk => chunk.trim());
};

export const generateEmbeddings = async (
  value: string,
): Promise<Array<{ embedding: number[]; content: string }>> => {
  const chunks = generateChunks(value);
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  return embeddings.map((e, i) => ({ content: chunks[i], embedding: e }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replace(/\n/g, " ");
  const { embedding } = await embed({
    model: embeddingModel,
    value: input,
  });
  return embedding;
};

// MongoDB Atlas Vector Search implementation
export const findRelevantContent = async (userQuery: string, limit: number = 4) => {
  console.log('[EMBEDDING] Searching for:', userQuery);

  try {
    const { embeddings, resources } = await getCollections();

    // Check if we have embeddings for true RAG
    const embeddingCount = await embeddings.countDocuments();
    const resourceCount = await resources.countDocuments();
    console.log('[EMBEDDING] Embeddings available:', embeddingCount);
    console.log('[EMBEDDING] Resources available:', resourceCount);

    if (embeddingCount > 0) {
      console.log('[EMBEDDING] Using VECTOR SEARCH (True RAG)');
      
      // Generate embedding for user query
      const userQueryEmbedded = await generateEmbedding(userQuery);

      try {
        // Use REAL Atlas Vector Search
        console.log('[EMBEDDING] Using Atlas Vector Search (REAL vector search)');
        const vectorResults = await embeddings.aggregate([
          {
            $vectorSearch: {
              queryVector: userQueryEmbedded,
              path: "embedding",
              numCandidates: 100,
              limit: limit,
              index: "embedding_index"
            }
          },
          {
            $project: {
              _id: 0,
              content: 1,
              resourceId: 1,
              score: { $meta: "vectorSearchScore" }
            }
          }
        ]).toArray();

        if (vectorResults.length > 0) {
          console.log('[EMBEDDING] ✅ Atlas Vector Search successful:', vectorResults.length, 'results');
          console.log(`[EMBEDDING] Top similarity scores: ${vectorResults.slice(0, 3).map(r => r.score.toFixed(4)).join(', ')}`);
          return vectorResults.map(result => ({
            name: result.content,
            similarity: result.score,
            resourceId: result.resourceId
          }));
        } else {
          throw new Error('Vector search returned no results');
        }
      } catch (vectorError) {
        console.error('[EMBEDDING] ❌ Atlas Vector Search failed:', vectorError.message);
        throw new Error(`Vector search failed: ${vectorError.message}. Make sure the embedding_index exists in Atlas.`);
      }
    }

    // Fallback to text search if no embeddings
    console.log('[EMBEDDING] No embeddings found, using TEXT SEARCH fallback');
    const searchTerms = userQuery.toLowerCase().split(' ').filter(term => term.length > 2);
    const regexPattern = searchTerms.join('|');

    const textResults = await resources.find({
      content: { $regex: regexPattern, $options: 'i' }
    }).limit(limit).toArray();

    console.log('[EMBEDDING] Text search results:', textResults.length);

    return textResults.map(result => ({
      name: result.content,
      similarity: 0.7, // Lower similarity for text matches
      resourceId: result.id || result._id?.toString()
    }));

  } catch (error) {
    console.error('[EMBEDDING] Error in findRelevantContent:', error);
    return [];
  }
};

// Helper function for cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Function to create the Atlas Vector Search index programmatically
export async function createVectorSearchIndex() {
  try {
    const collections = await getCollections();
    
    const indexDefinition = {
      name: "embedding_index",
      definition: {
        mappings: {
          dynamic: false,
          fields: {
            embedding: {
              type: "knnVector",
              dimensions: 1536, // text-embedding-3-small dimensions
              similarity: "cosine"
            }
          }
        }
      }
    };
    
    // Note: This requires MongoDB Atlas API or manual creation in Atlas UI
    console.log('Vector search index definition:', JSON.stringify(indexDefinition, null, 2));
    console.log('Please create this index in Atlas UI or use Atlas API');
    
    return indexDefinition;
  } catch (error) {
    console.error('Error creating vector search index:', error);
    throw error;
  }
}
