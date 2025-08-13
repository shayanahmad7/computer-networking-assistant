// Create Atlas Vector Search index for the RAG system
// Primary path: MongoDB Node driver helper (recommended by docs)
// Fallback: Atlas Admin API with HTTP Digest Auth
require('dotenv').config({ path: '.env.local' });

const https = require('https');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// Use the API keys from environment (no hardcoded values)
const PUBLIC_KEY = process.env.ATLAS_PUBLIC_KEY;
const PRIVATE_KEY = process.env.ATLAS_PRIVATE_KEY;
const EMBED_MODEL = process.env.EMBED_MODEL || 'text-embedding-3-large';

if (!PUBLIC_KEY || !PRIVATE_KEY) {
  console.error('❌ Missing ATLAS_PUBLIC_KEY or ATLAS_PRIVATE_KEY in environment');
  console.log('💡 Add ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY to your .env.local');
}
const MONGODB_URI = process.env.MONGODB_URI;

// Extract cluster name from MongoDB URI
function getClusterName(uri) {
  const match = uri.match(/@([^.]+)/);
  const clusterName = match ? match[1] : null;
  if (clusterName && clusterName.toLowerCase() === 'cluster0') {
    return 'Cluster0';
  }
  return clusterName;
}

function dimsForModel(model) {
  // Verified per OpenAI docs: text-embedding-3-small=1536, text-embedding-3-large=3072
  if (model === 'text-embedding-3-large') return 3072;
  if (model === 'text-embedding-3-small') return 1536;
  // Default to 1536 if unknown
  return 1536;
}

// Create HTTP Digest Auth header
function createDigestAuth(method, path, username, password, realm, nonce, qop = 'auth') {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${path}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"`;
}

// Make authenticated request to Atlas API using HTTP Digest Auth (per Atlas Admin API requirements)
function makeAtlasRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'cloud.mongodb.com',
      path: path,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const firstReq = https.request(options, (res) => {
      if (res.statusCode === 401 && res.headers['www-authenticate']) {
        const authHeader = res.headers['www-authenticate'];
        const realmMatch = authHeader.match(/realm="([^"]+)"/);
        const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
        if (realmMatch && nonceMatch) {
          const realm = realmMatch[1];
          const nonce = nonceMatch[1];
          const authOptions = {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': createDigestAuth(method, path, PUBLIC_KEY, PRIVATE_KEY, realm, nonce)
            }
          };
          const authReq = https.request(authOptions, (authRes) => {
            let body = '';
            authRes.on('data', chunk => body += chunk);
            authRes.on('end', () => {
              try {
                const parsed = body ? JSON.parse(body) : {};
                if (authRes.statusCode >= 200 && authRes.statusCode < 300) {
                  resolve(parsed);
                } else {
                  reject(new Error(`HTTP ${authRes.statusCode}: ${JSON.stringify(parsed, null, 2)}`));
                }
              } catch (e) {
                reject(new Error(`Parse error: ${body}`));
              }
            });
          });
          authReq.on('error', reject);
          if (data) authReq.write(JSON.stringify(data));
          authReq.end();
        } else {
          reject(new Error('Could not parse authentication challenge'));
        }
      } else {
        reject(new Error(`Unexpected response: ${res.statusCode}`));
      }
    });
    firstReq.on('error', reject);
    firstReq.end();
  });
}

// Discover the Atlas projectId that contains the given cluster
async function findProjectIdForCluster(clusterName) {
  const groups = await makeAtlasRequest('/api/atlas/v2/groups', 'GET');
  if (!groups || !groups.results || groups.results.length === 0) {
    throw new Error('No Atlas projects returned for the provided API key');
  }
  for (const project of groups.results) {
    try {
      const clusters = await makeAtlasRequest(`/api/atlas/v2/groups/${project.id}/clusters`, 'GET');
      const found = (clusters?.results || []).find(c => c.name === clusterName);
      if (found) {
        return project.id;
      }
    } catch (_) {}
  }
  throw new Error(`Could not find cluster "${clusterName}" in any accessible project for this API key`);
}

async function createVectorSearchIndex() {
  console.log('🚀 Creating Vector Search Index...');

  const clusterName = getClusterName(MONGODB_URI);
  if (!clusterName) throw new Error('Could not extract cluster name from MONGODB_URI');
  console.log(`🎯 Cluster Name: ${clusterName}`);

// Preferred: Node driver helper (create or update)
console.log('🔌 Using MongoDB Node driver to create or update indexes');
const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db('computer_networking_assistant');
const embeddingsCol = db.collection('embeddings');
const chatMemoryCol = db.collection('chat_memory');
const numDimensions = dimsForModel(EMBED_MODEL);
console.log(`🧠 Embedding model: ${EMBED_MODEL} → dims=${numDimensions}`);

// Embeddings index
const embeddingIndexName = 'embedding_index';
const embeddingDef = { fields: [{ type: 'vector', path: 'embedding', numDimensions, similarity: 'cosine' }] };
const embExisting = await embeddingsCol.listSearchIndexes(embeddingIndexName).toArray();
if (embExisting.length > 0) {
  console.log('ℹ️ embedding_index exists. Requesting update...');
  await embeddingsCol.updateSearchIndex(embeddingIndexName, embeddingDef);
  console.log('🔄 embedding_index update requested (rebuild will occur in background).');
} else {
  const created = await embeddingsCol.createSearchIndex({ name: embeddingIndexName, type: 'vectorSearch', definition: embeddingDef });
  console.log(`🎉 embedding_index creation started: ${created}`);
}

// Chat memory index
const memIndexName = 'chat_memory_index';
const memDef = { fields: [{ type: 'vector', path: 'embedding', numDimensions, similarity: 'cosine' }] };
const memExisting = await chatMemoryCol.listSearchIndexes(memIndexName).toArray();
if (memExisting.length > 0) {
  console.log('ℹ️ chat_memory_index exists. Requesting update...');
  await chatMemoryCol.updateSearchIndex(memIndexName, memDef);
  console.log('🔄 chat_memory_index update requested (rebuild will occur in background).');
} else {
  const memCreated = await chatMemoryCol.createSearchIndex({ name: memIndexName, type: 'vectorSearch', definition: memDef });
  console.log(`🎉 chat_memory_index creation started: ${memCreated}`);
}

await client.close();
console.log('✅ Index operations submitted. Atlas may take a minute to finish building.');
console.log('💡 Next: npm run rag:ingest-structured');
return { name: embeddingIndexName };
}

createVectorSearchIndex().catch(console.error);


