// Test if assistant messages are being saved
const testMessage = {
  messages: [
    {
      role: "user",
      content: "Hello, this is a test message to check if assistant responses are saved"
    }
  ],
  threadId: null,
  assistantId: process.env.ASSISTANT1_ID || "asst_test_id"
};

console.log("Testing assistant message saving...");
console.log("Test data:", JSON.stringify(testMessage, null, 2));

// Note: This would normally be run with node-fetch or similar
// For now, this is just a template for testing
