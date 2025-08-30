// Simple test to check assistant message storage
const testData = {
  messages: [
    {
      role: "user",
      content: "Hello, can you help me with Chapter 1?"
    }
  ],
  threadId: "test-thread-" + Date.now()
};

console.log("Test data:", JSON.stringify(testData, null, 2));

// Simulate what the API would do
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/assistant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    console.log("API Response:", result);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testAPI();
