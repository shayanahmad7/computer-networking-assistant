// Fast batch embedding script with detailed progress logging
require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const OpenAI = require('openai');
const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const MONGODB_URI = process.env.MONGODB_URI;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!MONGODB_URI || !OPENAI_API_KEY) {
  console.error('❌ Missing MONGODB_URI or OPENAI_API_KEY in .env.local');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function generateId() {
  return Math.random().toString(36).substr(2, 10);
}

function generateChunks(input, maxChunkSize = 1000) {
  console.log('📝 Starting text chunking...');
  
  const paragraphs = input
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 50);
  
  console.log(`📊 Found ${paragraphs.length} paragraphs`);
  
  const chunks = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkSize) {
      chunks.push(paragraph);
    } else {
      const sentences = paragraph.split(/(?<=[.!?])\s+/);
      let currentChunk = '';
      
      for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= maxChunkSize) {
          currentChunk += (currentChunk ? ' ' : '') + sentence;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = sentence;
        }
      }
      
      if (currentChunk) chunks.push(currentChunk);
    }
  }
  
  const finalChunks = chunks.filter(chunk => chunk.length > 30);
  console.log(`✅ Generated ${finalChunks.length} chunks (filtered from ${chunks.length})`);
  console.log(`📏 Average chunk size: ${Math.round(finalChunks.reduce((sum, chunk) => sum + chunk.length, 0) / finalChunks.length)} characters`);
  
  return finalChunks;
}

async function batchEmbeddings(chunks, batchSize = 100) {
  console.log(`\n🚀 Starting BATCH embedding generation...`);
  console.log(`📦 Processing ${chunks.length} chunks in batches of ${batchSize}`);
  
  const allEmbeddings = [];
  const totalBatches = Math.ceil(chunks.length / batchSize);
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    
    console.log(`\n🔄 Processing batch ${batchNum}/${totalBatches} (${batch.length} chunks)`);
    console.log(`📍 Chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)}`);
    
    try {
      const startTime = Date.now();
      
      // Clean inputs for embedding
      const cleanInputs = batch.map(chunk => chunk.replace(/\n/g, " ").trim());
      
      console.log(`⚡ Sending batch to OpenAI...`);
      
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: cleanInputs,
      });
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      
      console.log(`✅ Batch ${batchNum} completed in ${duration}s`);
      console.log(`📊 Generated ${response.data.length} embeddings`);
      
      // Combine chunks with their embeddings
      for (let j = 0; j < batch.length; j++) {
        allEmbeddings.push({
          content: batch[j],
          embedding: response.data[j].embedding
        });
      }
      
      console.log(`💾 Total embeddings so far: ${allEmbeddings.length}/${chunks.length}`);
      
      // Small delay between batches to be nice to the API
      if (batchNum < totalBatches) {
        console.log(`⏱️  Waiting 1 second before next batch...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.log(`❌ Error in batch ${batchNum}:`, error.message);
      
      // If batch fails, try individual chunks
      console.log(`🔄 Trying individual chunks for batch ${batchNum}...`);
      for (const chunk of batch) {
        try {
          const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk.replace(/\n/g, " ").trim(),
          });
          allEmbeddings.push({
            content: chunk,
            embedding: response.data[0].embedding
          });
          console.log(`✅ Individual chunk processed`);
        } catch (chunkError) {
          console.log(`❌ Skipping chunk due to error:`, chunkError.message);
        }
      }
    }
  }
  
  console.log(`\n🎉 BATCH EMBEDDING COMPLETE!`);
  console.log(`✅ Successfully generated ${allEmbeddings.length}/${chunks.length} embeddings`);
  
  return allEmbeddings;
}

async function ingestChapter1() {
  const totalStartTime = Date.now();
  console.log('🚀 Starting Chapter 1 PDF ingestion...');
  
  try {
    // Step 1: Read PDF
    console.log('\n📖 STEP 1: Reading PDF...');
    const pdfPath = path.join(process.cwd(), 'public', 'bookchapters', 'chapter 1.pdf');
    console.log(`📂 PDF path: ${pdfPath}`);
    
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }
    
    const startPdf = Date.now();
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    const pdfTime = ((Date.now() - startPdf) / 1000).toFixed(1);
    
    console.log(`✅ PDF parsed in ${pdfTime}s`);
    console.log(`📄 Pages: ${data.numpages}`);
    console.log(`📝 Characters: ${data.text.length.toLocaleString()}`);
    
    // Step 2: Clean text
    console.log('\n🧹 STEP 2: Cleaning text...');
    let cleanText = data.text
      .replace(/\f/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    console.log(`✅ Text cleaned: ${cleanText.length.toLocaleString()} characters`);
    
    // Step 3: Generate chunks
    console.log('\n✂️  STEP 3: Generating chunks...');
    const chunks = generateChunks(cleanText);
    
    // Step 4: Connect to MongoDB
    console.log('\n🔌 STEP 4: Connecting to MongoDB...');
    const mongoStart = Date.now();
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const mongoTime = ((Date.now() - mongoStart) / 1000).toFixed(1);
    
    console.log(`✅ Connected to MongoDB in ${mongoTime}s`);
    
    const db = client.db('computer_networking_assistant');
    const resourcesCollection = db.collection('resources');
    const embeddingsCollection = db.collection('embeddings');
    
    // Clear existing data
    console.log('\n🧹 STEP 5: Clearing existing data...');
    const deleteStart = Date.now();
    await resourcesCollection.deleteMany({});
    await embeddingsCollection.deleteMany({});
    const deleteTime = ((Date.now() - deleteStart) / 1000).toFixed(1);
    console.log(`✅ Data cleared in ${deleteTime}s`);
    
    // Step 6: Generate embeddings (FAST!)
    console.log('\n🧠 STEP 6: Generating embeddings (BATCH MODE)...');
    const embeddingStart = Date.now();
    const embeddingData = await batchEmbeddings(chunks, 50); // Smaller batches for stability
    const embeddingTime = ((Date.now() - embeddingStart) / 1000).toFixed(1);
    
    console.log(`✅ All embeddings generated in ${embeddingTime}s!`);
    
    // Step 7: Store in MongoDB
    console.log('\n💾 STEP 7: Storing in MongoDB...');
    const storeStart = Date.now();
    
    let successCount = 0;
    
    for (let i = 0; i < embeddingData.length; i++) {
      const item = embeddingData[i];
      
      try {
        const resourceId = generateId();
        
        // Store resource and embedding together
        await Promise.all([
          resourcesCollection.insertOne({
            id: resourceId,
            content: item.content,
            source: 'chapter1.pdf',
            createdAt: new Date()
          }),
          embeddingsCollection.insertOne({
            id: generateId(),
            resourceId: resourceId,
            content: item.content,
            embedding: item.embedding,
            source: 'chapter1.pdf',
            createdAt: new Date(),
          })
        ]);
        
        successCount++;
        
        if (i % 50 === 0 || i === embeddingData.length - 1) {
          console.log(`💾 Stored ${i + 1}/${embeddingData.length} items to MongoDB`);
        }
        
      } catch (error) {
        console.log(`❌ Error storing item ${i + 1}:`, error.message);
      }
    }
    
    await client.close();
    const storeTime = ((Date.now() - storeStart) / 1000).toFixed(1);
    const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);
    
    console.log(`✅ Storage completed in ${storeTime}s`);
    
    console.log('\n🎉 PDF INGESTION COMPLETE!');
    console.log(`⚡ Total time: ${totalTime} seconds`);
    console.log(`✅ Successfully processed: ${successCount}/${embeddingData.length} items`);
    console.log(`📚 Resources stored: ${successCount}`);
    console.log(`🧠 Embeddings stored: ${successCount}`);
    console.log(`📊 Average processing speed: ${(embeddingData.length / parseFloat(totalTime)).toFixed(1)} items/second`);
    console.log('\n🚀 TRUE RAG SYSTEM IS NOW READY WITH REAL BOOK CONTENT!');
    console.log('💡 Test at: http://localhost:3000/rag-chapter1');
    
  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message);
    console.error(error.stack);
  }
}

ingestChapter1();
