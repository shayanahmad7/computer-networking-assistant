const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function getLatestChapter1() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('computer_networking_assistant');
    
    // Check both collections
    const chapter1MessagesCollection = db.collection('chapter1_messages');
    const chatThreadsCollection = db.collection('chat_threads');
    
    // Get documents from chapter1_messages
    const chapter1Docs = await chapter1MessagesCollection.find({})
      .sort({ lastUpdated: -1 })
      .limit(10)
      .toArray();
    
    // Get documents from chat_threads for chapter1
    const chatThreadsDocs = await chatThreadsCollection.find({ chapter: 'chapter1' })
      .sort({ updatedAt: -1 })
      .limit(10)
      .toArray();
    
    console.log(`Found ${chapter1Docs.length} documents in chapter1_messages`);
    console.log(`Found ${chatThreadsDocs.length} documents in chat_threads for chapter1`);
    
    // Use whichever collection has data
    const latestDocs = chapter1Docs.length > 0 ? chapter1Docs : chatThreadsDocs;
    
    if (latestDocs.length === 0) {
      console.log('No documents found in chapter1_messages collection');
      return;
    }
    
    // Create analysis directory
    const analysisDir = 'chapter1-analysis';
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir);
    }
    
    // Save all documents
    fs.writeFileSync(
      path.join(analysisDir, 'latest-10-documents.json'),
      JSON.stringify(latestDocs, null, 2)
    );
    
    // Extract AI responses
    const aiResponses = [];
    
    latestDocs.forEach((doc, docIndex) => {
      console.log(`\nDocument ${docIndex + 1}:`);
      console.log(`  - ID: ${doc._id}`);
      console.log(`  - Last Updated: ${doc.lastUpdated}`);
      console.log(`  - Messages count: ${doc.messages ? doc.messages.length : 0}`);
      
      if (doc.messages && Array.isArray(doc.messages)) {
        doc.messages.forEach((message, msgIndex) => {
          if (message.role === 'assistant' && message.content) {
            console.log(`  - Assistant message ${msgIndex + 1}: ${message.content.substring(0, 100)}...`);
            
            aiResponses.push({
              docIndex: docIndex + 1,
              msgIndex: msgIndex + 1,
              docId: doc._id,
              lastUpdated: doc.lastUpdated,
              content: message.content
            });
          }
        });
      }
    });
    
    // Save AI responses only
    fs.writeFileSync(
      path.join(analysisDir, 'ai-responses.txt'),
      aiResponses.map((resp, index) => 
        `=== RESPONSE ${index + 1} (Doc ${resp.docIndex}, Msg ${resp.msgIndex}) ===\n` +
        `Doc ID: ${resp.docId}\n` +
        `Last Updated: ${resp.lastUpdated}\n` +
        `Content:\n${resp.content}\n` +
        `${'='.repeat(80)}\n`
      ).join('\n')
    );
    
    console.log(`\n📊 ANALYSIS COMPLETE!`);
    console.log(`Found ${aiResponses.length} AI responses from ${latestDocs.length} documents`);
    console.log(`Files saved to: ${analysisDir}/`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

getLatestChapter1();
