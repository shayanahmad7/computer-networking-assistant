import OpenAI from "openai";
import { getCollections } from "../db/mongodb";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const embeddingModelName = process.env.EMBED_MODEL || "text-embedding-3-large";

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
  const inputs = chunks.map((c) => c.replace(/\n/g, " "));
  const resp = await openai.embeddings.create({
    model: embeddingModelName,
    input: inputs,
  });
  return resp.data.map((d, i) => ({ content: chunks[i], embedding: d.embedding as unknown as number[] }));
};

export const generateEmbedding = async (value: string): Promise<number[]> => {
  const input = value.replace(/\n/g, " ");
  const resp = await openai.embeddings.create({
    model: embeddingModelName,
    input,
  });
  return resp.data[0].embedding as unknown as number[];
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

    // Always run vector search when embeddings exist, but also run a precise lexical search
    let fused: Array<{ resourceId?: string; name: string; score: number }> = [];
    if (embeddingCount > 0) {
      console.log('[EMBEDDING] Using VECTOR SEARCH (True RAG)');
      const userQueryEmbedded = await generateEmbedding(userQuery);
      let vectorResults: Array<{ content: string; resourceId?: string; score: number }> = [];
      try {
        console.log('[EMBEDDING] Using Atlas Vector Search (REAL vector search)');
        vectorResults = await embeddings.aggregate<{ content: string; resourceId?: string; score: number }>([
          {
            $vectorSearch: {
              queryVector: userQueryEmbedded,
              path: "embedding",
              numCandidates: 200,
              limit: Math.max(limit, 8),
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
        console.log('[EMBEDDING] Vector candidates:', vectorResults.length);
      } catch (vectorError: unknown) {
        const msg = vectorError instanceof Error ? vectorError.message : 'Unknown error';
        console.error('[EMBEDDING] ❌ Atlas Vector Search failed:', msg);
      }

      // Lexical search (regex) with problem-id boosting (e.g., P1, R1)
      const explicitIds = Array.from(new Set((userQuery.match(/\b[PR]\d+\b/gi) || []).map(s => s.toUpperCase())));
      const regexTerms = userQuery
        .toLowerCase()
        .split(/\s+/)
        .filter(term => term.length > 2)
        .join('|');
      const idPattern = explicitIds.length > 0 ? explicitIds.join('|') : '';
      const combined = [idPattern, regexTerms].filter(Boolean).join('|');

      let textResults: Array<{ content: string; id?: string }> = [];
      if (combined) {
        const tr = await resources.find({ content: { $regex: combined, $options: 'i' } })
          .limit(Math.max(limit, 12))
          .toArray();
        textResults = tr.map((r: { content: string; id?: string; _id?: { toString?: () => string } }) => ({
          content: r.content,
          id: r.id || r._id?.toString?.()
        }));
        console.log('[EMBEDDING] Text candidates:', textResults.length);
      }

      // If query contains explicit IDs (e.g., P1, R3), run a strong anchored match to pull exact statements
      if (explicitIds.length > 0) {
        const idAnchors = explicitIds.map(id => id.split('').join('\\s*'));
        const strongExpr = `(^|\\n|\\r)\\s*(?:Problem\\s*)?(?:${idAnchors.join('|')})\\s*[\\.:\\-\\)]`;
        const strong = await resources.find({ content: { $regex: strongExpr, $options: 'im' } })
          .limit(limit)
          .toArray();
        if (strong.length > 0) {
          return strong.map((s: { content: string; id?: string; _id?: { toString?: () => string } }) => ({
            name: s.content,
            similarity: 1.0,
            resourceId: s.id || s._id?.toString?.()
          }));
        }
      }

      // Reciprocal Rank Fusion (RRF) with simple weighting (vector 0.6, text 0.4)
      const rankConstant = 60;
      const vectorScores = new Map<string, number>();
      vectorResults.forEach((r, idx) => {
        const key = r.resourceId || `${r.content.slice(0, 50)}_${idx}`;
        const rr = 1 / (idx + 1 + rankConstant);
        const weighted = 0.6 * rr;
        vectorScores.set(key, (vectorScores.get(key) || 0) + weighted);
      });

      const textScores = new Map<string, { score: number; content: string }>();
      textResults.forEach((r, idx) => {
        const key = r.id || `${r.content.slice(0, 50)}_${idx}`;
        const rr = 1 / (idx + 1 + rankConstant);
        // Boost if explicit problem ids are present
        const containsId = explicitIds.some(id => r.content.toUpperCase().includes(id));
        const weight = containsId ? 0.8 : 0.4;
        const weighted = weight * rr;
        textScores.set(key, { score: (textScores.get(key)?.score || 0) + weighted, content: r.content });
      });

      const fusedMap = new Map<string, { score: number; content: string }>();
      // Bring in vector results
      vectorResults.forEach((r, idx) => {
        const key = r.resourceId || `${r.content.slice(0, 50)}_${idx}`;
        fusedMap.set(key, { score: (fusedMap.get(key)?.score || 0) + (vectorScores.get(key) || 0), content: r.content });
      });
      // Merge text results
      for (const [key, val] of textScores.entries()) {
        const existing = fusedMap.get(key);
        fusedMap.set(key, { score: (existing?.score || 0) + val.score, content: existing?.content || val.content });
      }

      fused = Array.from(fusedMap.entries())
        .sort((a, b) => b[1].score - a[1].score)
        .slice(0, limit)
        .map(([key, v]) => ({ resourceId: key, name: v.content, score: v.score }));

      if (fused.length > 0) {
        return fused.map(r => ({ name: r.name, similarity: r.score, resourceId: r.resourceId }));
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

// (cosineSimilarity helper removed — not used)

// Function to create the Atlas Vector Search index programmatically
export async function createVectorSearchIndex() {
  try {
    // Provide the index definition for reference/logging
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
