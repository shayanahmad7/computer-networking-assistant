# **Computer Networking Assistant**

A powerful AI-driven assistant designed to help users learn **Computer Networking** with an integrated textbook and interactive chat interface. This assistant leverages the **OpenAI API** to provide meaningful explanations, guidance, and support for all networking topics.

---

## **Features**

- **Interactive Learning**: Engage in a natural language conversation with the assistant.
- **Textbook-Powered**: Pre-fed with a comprehensive computer networking textbook for in-depth learning.
- **Streaming Responses**: Real-time, dynamic responses for seamless interaction.
- **User-Friendly Interface**: A simple chat-based UI for easy accessibility.

---

## **Tech Stack**

- **Frontend**: React with Next.js (App Router).
- **Backend**: API routes with OpenAI Assistants API.
- **Streaming Support**: Real-time interactions using OpenAI's thread streaming capabilities.

---

## **Prerequisites**

Before running the project, ensure the following are installed:

1. **Node.js** (v16 or higher)
2. **npm** or **yarn**
3. A valid **OpenAI API Key** and **Assistant ID**.

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

### **3. Set Up Environment Variables**

Create a `.env.local` file in the root of the project and add the following:

```env
OPENAI_API_KEY=your-openai-api-key
ASSISTANT_ID=your-assistant-id
```

Replace `your-openai-api-key` and `your-assistant-id` with the respective credentials.

---

## **Running the Project**

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

## **Deployment**

## **Usage**

1. Open the project in your browser.
2. Type your questions about computer networking (e.g., _"What is the difference between TCP and UDP?"_).
3. The assistant will provide detailed, streaming responses, guiding you through your learning.

---

## **Project Structure**

```
computer-networking-assistant/
├── app/
│   ├── api/
│   │   └── assistant/
│   │       └── route.ts      # API route for assistant interactions
│   ├── components/
│   │   └── Chat.tsx          # Chat component for the UI
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
