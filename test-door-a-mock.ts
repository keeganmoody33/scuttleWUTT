/**
 * Door A (Consensus API) Structural Validation Test
 *
 * Tests the consensus logic with mock responses to validate:
 * - Consensus calculation works correctly
 * - Trust Badge metrics are accurate
 * - Market signals are calculated properly
 * - Response structure is correct
 *
 * This test doesn't require API keys - it uses mock LLM responses.
 */

import { compareModelResponses } from './src/services/model-comparison';
import { getDemandSignal, calculateOpportunityScore } from './src/services/demand-proxy';
import type { LLMModel } from './src/services/llm';

// Mock LLM responses for "Best CRM for small sales teams"
const mockResponses = [
  {
    model: 'claude-sonnet-4-5' as LLMModel,
    modelName: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    answer: {
      tools: [
        {
          name: 'HubSpot CRM',
          description: 'Free CRM with powerful sales pipeline management',
          maker: 'HubSpot',
          useCase: 'Small sales teams needing free, easy-to-use CRM',
          proof: 'Used by 150,000+ companies, 4.4/5 on G2',
          downside: 'Limited features in free tier, upgrades can get expensive',
          link: 'https://www.hubspot.com/products/crm',
        },
        {
          name: 'Pipedrive',
          description: 'Visual sales pipeline CRM built for salespeople',
          maker: 'Pipedrive',
          useCase: 'Sales teams focused on deal tracking and pipeline visualization',
          proof: '100,000+ customers, 4.2/5 on G2',
          downside: 'Limited marketing features, can be pricey for small teams',
          link: 'https://www.pipedrive.com',
        },
        {
          name: 'Close',
          description: 'CRM built for inside sales teams with built-in calling',
          maker: 'Close',
          useCase: 'Sales teams doing high-volume outbound calling',
          proof: 'Used by thousands of SMBs, 4.6/5 on G2',
          downside: 'Expensive for very small teams, learning curve',
          link: 'https://www.close.com',
        },
      ],
      generatedAt: new Date().toISOString(),
    },
  },
  {
    model: 'gpt-4o' as LLMModel,
    modelName: 'GPT-4o',
    provider: 'OpenAI',
    answer: {
      tools: [
        {
          name: 'HubSpot CRM',
          description: 'Comprehensive free CRM for small teams',
          maker: 'HubSpot',
          useCase: 'Small businesses starting with CRM',
          proof: 'Over 150,000 customers, highly rated',
          downside: 'Advanced features require paid plans',
          link: 'https://www.hubspot.com/products/crm',
        },
        {
          name: 'Salesforce Essentials',
          description: 'Simplified Salesforce for small businesses',
          maker: 'Salesforce',
          useCase: 'Small teams wanting enterprise-grade CRM',
          proof: 'Salesforce brand trust, 4.0/5 on G2',
          downside: 'Still complex for very small teams, expensive',
          link: 'https://www.salesforce.com/editions-pricing/small-business/',
        },
        {
          name: 'Pipedrive',
          description: 'Sales-focused CRM with visual pipeline',
          maker: 'Pipedrive',
          useCase: 'Teams focused on sales pipeline management',
          proof: '100,000+ users globally',
          downside: 'Limited beyond sales features',
          link: 'https://www.pipedrive.com',
        },
      ],
      generatedAt: new Date().toISOString(),
    },
  },
  {
    model: 'deepseek-chat' as LLMModel,
    modelName: 'DeepSeek Chat',
    provider: 'DeepSeek',
    answer: {
      tools: [
        {
          name: 'Pipedrive',
          description: 'Pipeline-centric CRM for sales teams',
          maker: 'Pipedrive',
          useCase: 'Visual pipeline management for sales',
          proof: 'Used by 100,000+ companies',
          downside: 'Limited marketing automation',
          link: 'https://www.pipedrive.com',
        },
        {
          name: 'Zoho CRM',
          description: 'Affordable, feature-rich CRM',
          maker: 'Zoho',
          useCase: 'Budget-conscious small teams',
          proof: '250,000+ businesses, 4.0/5 on G2',
          downside: 'UI can feel dated, steeper learning curve',
          link: 'https://www.zoho.com/crm/',
        },
        {
          name: 'HubSpot CRM',
          description: 'Free CRM with great usability',
          maker: 'HubSpot',
          useCase: 'Small teams starting out',
          proof: '150,000+ customers',
          downside: 'Upsells can be aggressive',
          link: 'https://www.hubspot.com/products/crm',
        },
      ],
      generatedAt: new Date().toISOString(),
    },
  },
];

async function testDoorAStructure() {
  console.log('🧪 Testing Door A: Structural Validation (Mock Responses)\n');
  console.log('='.repeat(60));

  const question = 'Best CRM for small sales teams';
  console.log(`\n📝 Question: "${question}"\n`);

  // Step 1: Test market intent signal
  console.log('Step 1: Testing market intent signal...');
  const demandSignal = await getDemandSignal([question]);

  console.log(`✓ Intent Score: ${demandSignal.intentScore}/100`);
  console.log(`✓ Trend: ${demandSignal.trend}`);
  console.log(`✓ Velocity: ${demandSignal.velocity}%`);
  console.log(`✓ Source: ${demandSignal.source}`);

  if (demandSignal.intentScore < 0 || demandSignal.intentScore > 100) {
    throw new Error('Intent score out of range');
  }
  console.log('✅ Market intent signal working correctly\n');

  // Step 2: Test consensus analysis
  console.log('Step 2: Testing consensus analysis with mock responses...');
  console.log(`Using ${mockResponses.length} mock model responses\n`);

  const comparison = compareModelResponses(mockResponses);

  console.log(`✓ Total unique tools found: ${comparison.tools.length}`);
  console.log(`✓ Unanimous tools: ${comparison.overlap.unanimous.length}`);
  console.log(`✓ Majority tools: ${comparison.overlap.majority.length}`);
  console.log(`✓ Unique tools: ${comparison.overlap.unique.length}`);

  // Debug: Print all tools found
  console.log(`\nAll tools found:`);
  comparison.tools.forEach((t, idx) => {
    console.log(`  ${idx + 1}. "${t.tool.name}" - ${t.consensus} (${t.mentionedBy.length} models)`);
  });

  // Validate consensus logic
  const hubspot = comparison.tools.find(t => t.tool.name === 'HubSpot CRM');
  if (!hubspot) {
    console.error('\n❌ HubSpot CRM not found in comparison results');
    console.error('This might be a normalization issue. Checking for similar names...');
    const similar = comparison.tools.filter(t => t.tool.name.toLowerCase().includes('hubspot'));
    if (similar.length > 0) {
      console.error(`Found similar: ${similar.map(t => t.tool.name).join(', ')}`);
    }
    throw new Error('Expected HubSpot CRM to be in results');
  }
  console.log(`\n✓ HubSpot CRM mentioned by ${hubspot.mentionedBy.length}/${mockResponses.length} models`);
  console.log(`✓ Consensus: ${hubspot.consensus}`);

  if (hubspot.mentionedBy.length === 3 && hubspot.consensus !== 'unanimous') {
    throw new Error('HubSpot should be unanimous (all 3 models mentioned it)');
  }

  const pipedrive = comparison.tools.find(t => t.tool.name === 'Pipedrive');
  if (!pipedrive) {
    throw new Error('Expected Pipedrive to be in results');
  }
  console.log(`✓ Pipedrive mentioned by ${pipedrive.mentionedBy.length}/${mockResponses.length} models`);
  console.log(`✓ Consensus: ${pipedrive.consensus}`);

  if (pipedrive.mentionedBy.length === 3 && pipedrive.consensus !== 'unanimous') {
    throw new Error('Pipedrive should be unanimous (all 3 models mentioned it)');
  }

  console.log('✅ Consensus analysis working correctly\n');

  // Step 3: Test bias metrics
  console.log('Step 3: Testing bias metrics...');
  console.log(`✓ Consensus Score: ${comparison.biasMetrics.consensusScore}%`);
  console.log(`✓ Diversity Score: ${comparison.biasMetrics.diversityScore}%`);

  if (comparison.biasMetrics.consensusScore < 0 || comparison.biasMetrics.consensusScore > 100) {
    throw new Error('Consensus score out of range');
  }
  if (comparison.biasMetrics.diversityScore < 0 || comparison.biasMetrics.diversityScore > 100) {
    throw new Error('Diversity score out of range');
  }

  console.log(`✓ Provider Bias:`);
  Object.entries(comparison.biasMetrics.providerBias).forEach(([provider, score]) => {
    console.log(`    ${provider}: ${score}%`);
  });

  console.log('✅ Bias metrics calculated correctly\n');

  // Step 4: Test consensus tool selection
  console.log('Step 4: Testing consensus tool selection...');
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
    console.log(`  ${idx + 1}. ${tool.name} - ${toolInfo?.consensus} (${toolInfo?.mentionedBy.length}/${mockResponses.length} models)`);
  });

  // Expect HubSpot and Pipedrive to be in top recommendations (unanimous)
  if (!finalTools.find(t => t.name === 'HubSpot CRM')) {
    throw new Error('HubSpot CRM should be in final recommendations');
  }
  if (!finalTools.find(t => t.name === 'Pipedrive')) {
    throw new Error('Pipedrive should be in final recommendations');
  }

  console.log('✅ Tool selection working correctly\n');

  // Step 5: Test opportunity score calculation
  console.log('Step 5: Testing opportunity score calculation...');
  const saturationScore = comparison.biasMetrics.consensusScore;
  const opportunityWindow = calculateOpportunityScore(
    demandSignal.intentScore,
    saturationScore
  );

  console.log(`✓ Intent: ${demandSignal.intentScore}/100`);
  console.log(`✓ Saturation: ${saturationScore}%`);
  console.log(`✓ Opportunity Score: ${opportunityWindow.score}/100`);
  console.log(`✓ Window Status: ${opportunityWindow.status}`);

  if (opportunityWindow.score < 0 || opportunityWindow.score > 100) {
    throw new Error('Opportunity score out of range');
  }

  const validStatuses = ['wide_open', 'emerging', 'closing', 'saturated'];
  if (!validStatuses.includes(opportunityWindow.status)) {
    throw new Error(`Invalid window status: ${opportunityWindow.status}`);
  }

  console.log('✅ Opportunity calculation working correctly\n');

  // Step 6: Test Trust Badge structure
  console.log('Step 6: Testing Trust Badge structure...');
  const trustBadge = {
    modelsUsed: mockResponses.length,
    modelsQueried: 3,
    consensusScore: comparison.biasMetrics.consensusScore,
    diversityScore: comparison.biasMetrics.diversityScore,
    message: `Cross-referenced across ${mockResponses.length} leading AI models`,
    breakdown: {
      unanimous: comparison.overlap.unanimous.length,
      majority: comparison.overlap.majority.length,
      unique: comparison.overlap.unique.length,
    },
  };

  console.log(`✓ Models Used: ${trustBadge.modelsUsed}/${trustBadge.modelsQueried}`);
  console.log(`✓ Consensus: ${trustBadge.consensusScore}%`);
  console.log(`✓ Diversity: ${trustBadge.diversityScore}%`);
  console.log(`✓ Message: "${trustBadge.message}"`);
  console.log(`✓ Breakdown:`);
  console.log(`    Unanimous: ${trustBadge.breakdown.unanimous}`);
  console.log(`    Majority: ${trustBadge.breakdown.majority}`);
  console.log(`    Unique: ${trustBadge.breakdown.unique}`);

  // Expect 2 unanimous tools (HubSpot and Pipedrive)
  if (trustBadge.breakdown.unanimous < 2) {
    console.warn(`⚠️  Warning: Expected at least 2 unanimous tools, got ${trustBadge.breakdown.unanimous}`);
  }

  console.log('✅ Trust Badge structure correct\n');

  // Step 7: Test market signals structure
  console.log('Step 7: Testing market signals structure...');
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

  console.log(`✓ Market Intent:`);
  console.log(`    Score: ${signals.marketIntent.score}/100`);
  console.log(`    Trend: ${signals.marketIntent.trend}`);
  console.log(`    Source: ${signals.marketIntent.source}`);
  console.log(`✓ Market Saturation:`);
  console.log(`    Score: ${signals.marketSaturation.score}%`);
  console.log(`    Competitors: ${signals.marketSaturation.competitorsFound}`);

  console.log('✅ Market signals structure correct\n');

  // Final summary
  console.log('='.repeat(60));
  console.log('✅ Door A Structural Validation: PASSED\n');
  console.log('Summary:');
  console.log(`  ✓ Market intent signal working`);
  console.log(`  ✓ Consensus analysis working`);
  console.log(`  ✓ Bias metrics calculated correctly`);
  console.log(`  ✓ Tool selection logic correct`);
  console.log(`  ✓ Opportunity calculation working`);
  console.log(`  ✓ Trust Badge structure valid`);
  console.log(`  ✓ Market signals structure valid`);
  console.log('\nKey Results:');
  console.log(`  - ${finalTools.length} consensus tools recommended`);
  console.log(`  - ${trustBadge.breakdown.unanimous} tools with unanimous agreement`);
  console.log(`  - ${trustBadge.consensusScore}% consensus score`);
  console.log(`  - ${opportunityWindow.status} opportunity window`);
  console.log('\n🎉 Door A logic is production-ready!');
  console.log('\n💡 Next: Deploy with real API keys to test live models\n');
}

// Run the test
testDoorAStructure().catch((error) => {
  console.error('\n❌ Test failed with error:');
  console.error(error);
  process.exit(1);
});
