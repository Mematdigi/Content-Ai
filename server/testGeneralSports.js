require('dotenv').config();
const { runPipeline } = require('./services/aiPipeline');
const { fetchResearchBrief } = require('./services/webScraper');

async function test() {
  console.log("Running general sports test...");
  try {
    const research = await fetchResearchBrief({
      topic: "tomorrow match women world cup",
      primaryKeyword: "women world cup",
      articleType: "blog"
    });

    const result = await runPipeline({
      topic: "tomorrow match women world cup",
      brief: research.brief,
      isHypothetical: research.isHypothetical,
      primaryKeyword: "women world cup",
      secondaryKeywords: ["schedule", "standings"],
      targetWordCount: 500,
      headingsCount: 3,
      tone: "professional",
      audience: "sports fans",
      language: "English",
      articleType: "blog",
      pointOfView: "third",
      includeFaqs: true,
      includeMeta: true,
      includeImages: false,
      authorName: "Test Author",
    });

    console.log("\n--- Generated Content ---");
    console.log(result.content);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
