import { MongoClient, Db, Collection } from 'mongodb';

// SECURITY: MongoDB connection string is loaded from environment variables
// No database credentials are hardcoded in this file
const uri = process.env.MONGODB_URI as string;

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

let client: MongoClient;
let db: Db;

// MongoDB Collection Interfaces
// These define the structure of documents stored in MongoDB

// Resource: Stores Chapter 1 textbook content
export interface Resource {
  _id?: string;
  id: string;
  content: string;
  createdAt: Date;
}

// Embedding: Stores vector embeddings for semantic search
export interface Embedding {
  _id?: string;
  id: string;
  resourceId: string;
  content: string;
  embedding: number[];
  createdAt: Date;
}

// ChatThread: Stores chat conversation history (optional feature)
export interface ChatThread {
  _id?: string;
  sessionId: string;
  chapter: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

let resourcesCollection: Collection<Resource>;
let embeddingsCollection: Collection<Embedding>;
let threadsCollection: Collection<ChatThread>;

export async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');
  }

  if (!db) {
    db = client.db('computer_networking_assistant'); // Clean database for ingestion
    resourcesCollection = db.collection<Resource>('resources');
    embeddingsCollection = db.collection<Embedding>('embeddings');
    threadsCollection = db.collection<ChatThread>('chat_threads');
    
    // Ensure indexes
    await ensureIndexes();
  }

  return {
    db,
    resourcesCollection,
    embeddingsCollection,
    threadsCollection,
  };
}

async function ensureIndexes() {
  try {
    // Create text search index on resources
    await resourcesCollection.createIndex({ content: 'text' });
    
    // Create compound index for chat threads
    await threadsCollection.createIndex({ sessionId: 1, chapter: 1 });
    
    // Vector search index for embeddings (Atlas Vector Search)
    // This should be created in Atlas UI or via Atlas API
    console.log('Database indexes ensured');
  } catch (error) {
    console.log('Index creation warning (may already exist):', error);
  }
}

export async function getCollections() {
  await connectToDatabase();
  return {
    resources: resourcesCollection,
    embeddings: embeddingsCollection,
    threads: threadsCollection,
  };
}
