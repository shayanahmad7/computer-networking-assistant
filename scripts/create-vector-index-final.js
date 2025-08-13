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
const PROJECT_ID = '67825a60f6c8ca0856ca4d0f'; // From the previous output

if (!PUBLIC_KEY || !PRIVATE_KEY) {
  console.error('❌ Missing ATLAS_PUBLIC_KEY or ATLAS_PRIVATE_KEY in environment');
  console.log('💡 Add ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY to your .env.local');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

// Extract cluster name from MongoDB URI
function getClusterName(uri) {
  const match = uri.match(/@([^.]+)/);
  // MongoDB Atlas cluster names are case sensitive - usually "Cluster0" not "cluster0"
  const clusterName = match ? match[1] : null;
  
  // Try common variations
  if (clusterName && clusterName.toLowerCase() === 'cluster0') {
    return 'Cluster0'; // Capital C is common default
  }
  
  return clusterName;
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
        // Official docs use application/json; custom vendor versions are optional
        // https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    // First request to get the WWW-Authenticate header
    const firstReq = https.request(options, (res) => {
      if (res.statusCode === 401 && res.headers['www-authenticate']) {
        // Parse the WWW-Authenticate header
        const authHeader = res.headers['www-authenticate'];
        const realmMatch = authHeader.match(/realm="([^"]+)"/);
        const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
        
        if (realmMatch && nonceMatch) {
          const realm = realmMatch[1];
          const nonce = nonceMatch[1];
          
          // Create the authenticated request
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
  // List all projects available to the API key
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
    } catch (err) {
      // Continue searching other projects
    }
  }

  throw new Error(`Could not find cluster "${clusterName}" in any accessible project for this API key`);
}

async function createVectorSearchIndex() {
  console.log('🚀 Creating Vector Search Index with proper Digest Auth...');
  console.log(`📝 Using Public Key: ${PUBLIC_KEY}`);
  
  const clusterName = getClusterName(MONGODB_URI);
  if (!clusterName) {
    throw new Error('Could not extract cluster name from MONGODB_URI');
  }
  console.log(`🎯 Cluster Name: ${clusterName}`);
  
  // Primary method: use MongoDB Node driver helper to create the index (per docs)
  // https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-type/
  try {
    console.log('🔌 Connecting with MongoDB Node driver to create the index...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('computer_networking_assistant');
    const collection = db.collection('embeddings');

    const indexModel = {
      name: 'embedding_index',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 1536,
            similarity: 'cosine'
          }
        ]
      }
    };

    const result = await collection.createSearchIndex(indexModel);
    console.log(`🎉 Vector Search Index creation started. Name: ${result}`);
    console.log('⏳ Polling until the index becomes queryable...');

    let queryable = false;
    while (!queryable) {
      const cursor = collection.listSearchIndexes(result);
      const indexes = await cursor.toArray();
      if (indexes.length && indexes[0]?.queryable) {
        queryable = true;
        break;
      }
      await new Promise(r => setTimeout(r, 5000));
    }

    await client.close();
    console.log('✅ TRUE RAG IS NOW ENABLED! Index is Active and queryable.');
    console.log('🌐 Test at: http://localhost:3000/rag-chapter1');
    return { name: result };
  } catch (driverErr) {
    console.error('❌ Driver-based index creation failed:', driverErr.message);
    console.log('🔁 Falling back to Atlas Admin API (Digest Auth)...');
  }

  // Fallback: Use Atlas Admin API (Digest Auth) if driver helper failed
  // Discover the project ID for the given cluster
  console.log('🔎 Discovering Atlas project for the given cluster...');
  const PROJECT_ID = await findProjectIdForCluster(clusterName);
  console.log(`🏢 Project ID: ${PROJECT_ID}`);

  const indexDefinition = {
    database: 'computer_networking_assistant',
    collectionName: 'embeddings',
    type: 'vectorSearch',
    name: 'embedding_index',
    definition: {
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: 1536,
          similarity: 'cosine'
        }
      ]
    }
  };

  const path = `/api/atlas/v2/groups/${PROJECT_ID}/clusters/${clusterName}/search/indexes`;
  
  try {
    const result = await makeAtlasRequest(path, 'POST', indexDefinition);
    console.log('🎉 Vector Search Index created successfully!');
    console.log(`📊 Index ID: ${result.indexID}`);
    console.log(`📛 Index Name: ${result.name}`);
    console.log(`🏗️ Index Status: ${result.status}`);
    console.log('\n✅ TRUE RAG IS NOW ENABLED!');
    console.log('🚀 Run: node scripts/fast-batch-ingest.js');
    console.log('🌐 Then test at: http://localhost:3000/rag-chapter1');
    return result;
  } catch (error) {
    console.error('❌ Failed to create vector search index:', error.message);
    throw error;
  }
}

createVectorSearchIndex().catch(console.error);
