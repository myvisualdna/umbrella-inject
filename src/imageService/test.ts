/**
 * Test script for Image Service
 * 
 * This script tests the image service flow with a sample keyword
 */

import "dotenv/config";
import { processArticleWithImage } from "./orchestrator";

/**
 * Test the image service with a sample ChatGPT response
 */
async function testImageService() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 Testing Image Service");
  console.log("=".repeat(80) + "\n");

  // Simulate a ChatGPT response with a test imageKeyword
  const mockChatGPTResponse = JSON.stringify({
    title: "Test Article Title",
    tickerTitle: "Test Article Title",
    excerpt: "This is a test excerpt for the article.",
    body: "This is the body of the test article. It contains multiple paragraphs to simulate a real article.",
    imageKeyword: "technology", // Test keyword - replace with actual keyword from ChatGPT in production
    tags: ["Artificial Intelligence", "Technology", "Innovation"], // Test tags array
  });

  // Test with different categories
  const categories = ["politics", "entertainment", null];

  for (const category of categories) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📂 Testing with category: ${category || "none"}`);
    console.log("=".repeat(80) + "\n");

    const result = await processArticleWithImage(mockChatGPTResponse, category);

    if (result) {
      console.log("\n" + "=".repeat(80));
      console.log("✅ Final Merged Object:");
      console.log(JSON.stringify(result, null, 2));
      console.log("=".repeat(80) + "\n");
    } else {
      console.log("❌ Failed to process article\n");
    }

    // Add delay between tests
    if (category !== categories[categories.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

// Run the test
void testImageService();

