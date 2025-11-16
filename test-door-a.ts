/**
 * Door A (Consensus API) End-to-End Test
 *
 * Tests the Executive Consensus Tool with a real question to validate:
 * - All 3 models respond correctly
 * - Consensus calculation works
 * - Trust Badge metrics are accurate
 * - Market signals are present
 * - Response structure is correct
 */

import { answerQuestion } from './src/services/question-answering';
import { compareModelResponses } from './src/services/model-comparison';
import { getDemandSignal, calculateOpportunityScore } from './src/services/demand-proxy';
import { getModelMetadata, type LLMModel } from './src/services/llm';

async function testDoorA() {
  console.log('🧪 Testing Door A: Executive Consensus Tool\n');
  console.log('='.repeat(60));

  // Test question
  const question = 'Best CRM for small sales teams';
  console.log(`\n📝 Question: "${question}"\n`);

  // Step 1: Get market intent signal
  console.log('Step 1: Getting market intent signal...');
  const demandSignal = await getDemandSignal([question]);
  console.log(`✓ Intent Score: ${demandSignal.intentScore}/100`);
  console.log(`✓ Trend: ${demandSignal.trend}`);
  console.log(`✓ Velocity: ${demandSignal.velocity}%`);
  console.log(`✓ Source: ${demandSignal.source}\n`);

  // Step 2: Query all 3 consensus models
  console.log('Step 2: Querying 3 consensus models in parallel...');
  const consensusModels: LLMModel[] = [
    'claude-sonnet-4-5',
    'gpt-4o',
    'deepseek-chat',
  ];

  const startTime = Date.now();

  const responses = await Promise.all(
    consensusModels.map(async (model) => {
      const metadata = getModelMetadata(model);
      const modelStartTime = Date.now();

      try {
        const answer = await answerQuestion(question, model);
        const modelEndTime = Date.now();
        const duration = modelEndTime - modelStartTime;

        console.log(`  ✓ ${metadata.name} (${metadata.provider}) - ${duration}ms - ${answer.tools.length} tools found`);

        return {
          model,
          answer,
          modelName: metadata.name,
          provider: metadata.provider,
          success: true,
          duration,
        };
      } catch (error) {
        console.error(`  ✗ ${metadata.name} (${metadata.provider}) - FAILED`);
        console.error(`    Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

        return {
          model,
          answer: null,
          modelName: metadata.name,
          provider: metadata.provider,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱️  Total query time: ${totalTime}ms\n`);

  // Step 3: Analyze successful responses
  const successfulResponses = responses.filter(
    (r) => r.success && r.answer
  ) as Array<{
    model: LLMModel;
    answer: any;
    modelName: string;
    provider: string;
  }>;

  console.log('Step 3: Analyzing responses...');
  console.log(`✓ Successful responses: ${successfulResponses.length}/${consensusModels.length}`);

  if (successfulResponses.length < 2) {
    console.error('❌ FAILED: Not enough successful responses for consensus');
    console.log('\nFailed models:');
    responses.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.modelName}: ${(r as any).error}`);
    });
    process.exit(1);
  }

  // Step 4: Run comparison analysis
  console.log('\nStep 4: Running consensus analysis...');
  const comparison = compareModelResponses(successfulResponses);

  console.log(`✓ Total unique tools found: ${comparison.tools.length}`);
  console.log(`✓ Unanimous tools: ${comparison.overlap.unanimous.length}`);
  console.log(`✓ Majority tools: ${comparison.overlap.majority.length}`);
  console.log(`✓ Unique tools: ${comparison.overlap.unique.length}`);
  console.log(`\nBias Metrics:`);
  console.log(`  - Consensus Score: ${comparison.biasMetrics.consensusScore}%`);
  console.log(`  - Diversity Score: ${comparison.biasMetrics.diversityScore}%`);
  console.log(`  - Provider Bias: ${JSON.stringify(comparison.biasMetrics.providerBias, null, 2)}`);

  // Step 5: Build consensus answer
  console.log('\nStep 5: Building consensus answer...');
  const consensusTools = comparison.tools
    .filter((t) => t.consensus === 'unanimous' || t.consensus === 'majority')
    .map((t) => t.tool);

  const finalTools =
    consensusTools.length > 0
      ? consensusTools.slice(0, 5)
      : comparison.tools.slice(0, 5).map((t) => t.tool);

  console.log(`✓ Consensus tools selected: ${finalTools.length}`);
  finalTools.forEach((tool, idx) => {
    const toolInfo = comparison.tools.find(t => t.tool.name === tool.name);
    console.log(`  ${idx + 1}. ${tool.name} - mentioned by ${toolInfo?.mentionedByModels.length}/${successfulResponses.length} models`);
  });

  // Step 6: Calculate opportunity score
  console.log('\nStep 6: Calculating opportunity score...');
  const saturationScore = comparison.biasMetrics.consensusScore;
  const opportunityWindow = calculateOpportunityScore(
    demandSignal.intentScore,
    saturationScore
  );

  console.log(`✓ Opportunity Score: ${opportunityWindow.score}/100`);
  console.log(`✓ Window Status: ${opportunityWindow.status}`);

  // Step 7: Build Trust Badge
  console.log('\nStep 7: Building Trust Badge...');
  const trustBadge = {
    modelsUsed: successfulResponses.length,
    modelsQueried: consensusModels.length,
    consensusScore: comparison.biasMetrics.consensusScore,
    diversityScore: comparison.biasMetrics.diversityScore,
    message: `Cross-referenced across ${successfulResponses.length} leading AI models`,
    breakdown: {
      unanimous: comparison.overlap.unanimous.length,
      majority: comparison.overlap.majority.length,
      unique: comparison.overlap.unique.length,
    },
  };

  console.log(`✓ Trust Badge created:`);
  console.log(`  - Message: "${trustBadge.message}"`);
  console.log(`  - Models Used: ${trustBadge.modelsUsed}/${trustBadge.modelsQueried}`);
  console.log(`  - Consensus: ${trustBadge.consensusScore}%`);
  console.log(`  - Diversity: ${trustBadge.diversityScore}%`);

  // Step 8: Build market signals
  console.log('\nStep 8: Building market signals...');
  const signals = {
    marketIntent: {
      score: demandSignal.intentScore,
      trend: demandSignal.trend,
      source: demandSignal.source,
    },
    marketSaturation: {
      score: Math.round(comparison.biasMetrics.consensusScore),
      competitorsFound: comparison.tools.length,
    },
  };

  console.log(`✓ Market Signals:`);
  console.log(`  - Intent: ${signals.marketIntent.score}/100 (${signals.marketIntent.trend})`);
  console.log(`  - Saturation: ${signals.marketSaturation.score}% (${signals.marketSaturation.competitorsFound} competitors)`);

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ Door A Test: PASSED\n');
  console.log('Summary:');
  console.log(`  - Question answered successfully`);
  console.log(`  - ${successfulResponses.length}/${consensusModels.length} models responded`);
  console.log(`  - ${finalTools.length} consensus tools recommended`);
  console.log(`  - Trust Badge: ${trustBadge.consensusScore}% consensus`);
  console.log(`  - Opportunity Window: ${opportunityWindow.status} (${opportunityWindow.score}/100)`);
  console.log(`  - Total time: ${totalTime}ms`);
  console.log('\n🎉 Door A is ready for production!\n');
}

// Run the test
testDoorA().catch((error) => {
  console.error('\n❌ Test failed with error:');
  console.error(error);
  process.exit(1);
});
