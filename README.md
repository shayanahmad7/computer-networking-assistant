# Computer Networking Assistant

An AI tutor for the Kurose & Ross book. The app includes two flows:

- Traditional tutors for Chapters 1–8 using the OpenAI Assistants API
- A custom Retrieval-Augmented Generation (RAG) flow for Chapter 1 powered by MongoDB Atlas Vector Search

---

## **Features**

### **Traditional Assistants (Chapters 1-8)**

- **Interactive Learning**: Engage in natural language conversations
- **Textbook-Powered**: Pre-fed with comprehensive networking textbook content
- **Streaming Responses**: Real-time, dynamic responses for seamless interaction
- **Chapter-Specific Tutors**: Dedicated assistants for each chapter

### **RAG-Powered Chapter 1 Tutor** 🆕

- **Retrieval-Augmented Generation**: Combines MongoDB vector search with OpenAI
- **Intelligent Context Retrieval**: Finds relevant textbook content dynamically
- **Smart Fallback**: Provides intelligent responses even without specific content matches
- **Enhanced Educational Experience**: More precise and contextual tutoring

---

## Tech Stack

- Frontend: Next.js (App Router)
- Backend: API routes using the OpenAI Assistants API and a custom RAG endpoint
- Database: MongoDB Atlas with Atlas Vector Search
- Models: `gpt-4o-mini` (generation), `text-embedding-3-small` (1536-dim)
- Streaming: OpenAI Assistants thread streaming for non-RAG pages

---

## Prerequisites

Before running the project, ensure the following are installed:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. A valid OpenAI API Key and Assistant IDs (for chapters)
4. A MongoDB Atlas cluster and connection string

---

## **Getting Started**

### **1. Clone the Repository**

```bash
git clone https://github.com/shayanahmad7/computer-networking-assistant.git
cd computer-networking-assistant
```

### **2. Install Dependencies**

Install all necessary packages:

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env.local` file in the root of the project and add the following:

```env
OPENAI_API_KEY=your-openai-api-key
ASSISTANT1_ID=your-chapter1-assistant-id
ASSISTANT2_ID=your-chapter2-assistant-id
ASSISTANT3_ID=your-chapter3-assistant-id
ASSISTANT4_ID=your-chapter4-assistant-id
ASSISTANT5_ID=your-chapter5-assistant-id
ASSISTANT6_ID=your-chapter6-assistant-id
ASSISTANT7_ID=your-chapter7-assistant-id
ASSISTANT8_ID=your-chapter8-assistant-id
MONGODB_URI=your-mongodb-connection-string
```

**SECURITY NOTE**: Never commit the `.env.local` file to version control. It's already included in `.gitignore`.

Replace the placeholder values with your actual credentials:

- Get OpenAI API key from [OpenAI Platform](https://platform.openai.com/api-keys)
- Create OpenAI Assistants via [OpenAI Assistants API](https://platform.openai.com/assistants)
- Set up MongoDB Atlas and get connection string from [MongoDB Atlas](https://cloud.mongodb.com)

---

## Running the Project

### **Development Mode**

Start the development server:

```bash
npm run dev
```

Visit the application at [http://localhost:3000](http://localhost:3000).

### **Production Mode**

1. Build the project:

   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

---

## Deployment

The application is deployed and available at:

[https://computer-networking-assistant.vercel.app/](https://computer-networking-assistant.vercel.app/)

---

## Navigation & Usage

Pages:

- `/` Chapter 1 (Assistants API)
- `/chapter2` … `/chapter8` Chapters 2–8 (Assistants API)
- `/rag-chapter1` Custom RAG for Chapter 1 (Atlas Vector Search)

What each page does:

- Chapter pages use OpenAI Assistants threads to stream answers specific to the chapter assistant ID
- RAG page embeds/query-retrieves Chapter 1 content from the DB and augments the prompt

### **Traditional Tutors**

- Navigate to chapters 1-8: `/`, `/chapter2`, `/chapter3`, etc.
- Chat with dedicated assistants for each chapter

### RAG Setup (replicate locally)

1. Ensure `.env.local` has `OPENAI_API_KEY` and `MONGODB_URI`
2. Place your Chapter 1 PDF at `public/bookchapters/chapter 1.pdf` (this folder is gitignored)
3. Create the Vector Search index (runs once):
   ```bash
   node scripts/create-vector-index-final.js
   ```
4. Ingest Chapter 1 content and embeddings:
   ```bash
   node scripts/fast-batch-ingest.js
   ```
5. Start the app and visit `/rag-chapter1`

Under the hood:

- `app/api/rag-chapter1/route.ts` builds a system prompt with retrieved chunks
- `lib/ai/embedding.ts` does `$vectorSearch` on `computer_networking_assistant.embeddings` with index `embedding_index`

Example questions:

- _"What is the Internet?"_
- _"Explain packet switching vs circuit switching"_
- _"What are the types of network delays?"_
- _"How do protocols work?"_

---

## Security & Production Readiness

✅ **No Hardcoded Secrets**: All API keys and database URIs are in environment variables
✅ **Secure Environment**: `.env.local` is gitignored and never committed
✅ **Input Validation**: Proper error handling and input sanitization
✅ **Type Safety**: Full TypeScript implementation with proper interfaces
✅ **Clean Dependencies**: No unnecessary packages or vulnerabilities
✅ **Documentation**: Comprehensive code comments and documentation

### Security Checklist

- [ ] Set up environment variables in production deployment
- [ ] Configure MongoDB Atlas IP whitelist
- [ ] Monitor OpenAI API usage and set billing limits
- [ ] Keep dependencies updated (`npm audit`)

---

## Project Structure

```
computer-networking-assistant/
├── app/
│   ├── api/
│   │   └── assistant/
│   │       └── route.ts      # API route for assistant interactions
│   ├── components/
│   │   └── Chat.tsx          # Chat component for Assistants pages
│   │   └── RAGChat.tsx       # Chat component for RAG page
│   ├── rag-chapter1/
│   │   └── page.tsx          # RAG Chapter 1 page
│   ├── api/
│   │   ├── assistant/route.ts       # Assistants API
│   │   └── rag-chapter1/route.ts    # RAG API
├── scripts/
│   ├── create-vector-index-final.js # Create Atlas Vector Search index
│   └── fast-batch-ingest.js         # Parse PDF and store resources + embeddings
│   └── page.tsx              # Main page of the application
├── .env.local                # Environment variables (not tracked in Git)
├── package.json              # Project metadata and dependencies
├── tsconfig.json             # TypeScript configuration
├── README.md                 # Project documentation
```

---

## **Contributing**

Contributions are welcome! If you'd like to contribute:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your message"
   ```
4. Push the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---
