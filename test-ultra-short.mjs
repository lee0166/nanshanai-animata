/* eslint-disable no-undef */
/**
 * Ultra-Short Script Parsing Test
 *
 * This script tests the parseUltraShortScript functionality
 * to verify it works correctly with short texts (<500 chars).
 */

import { createScriptParser } from './services/scriptParser.ts';

// Test script - approximately 150 characters
const testScript = `《重逢》

咖啡厅里，小雨坐在窗边发呆。门铃响起，她抬头，看见阿杰走进来。

阿杰：好久不见。

小雨愣住，眼眶微红。

小雨：你...回来了？

阿杰点头，在她对面坐下。

阿杰：我回来了，再也不走了。

两人相视而笑，窗外阳光正好。`;

console.log('========================================');
console.log('Ultra-Short Script Parsing Test');
console.log('========================================');
console.log(`Script length: ${testScript.length} characters`);
console.log(`Threshold: <500 characters`);
console.log(`Expected path: ULTRA-SHORT PATH`);
console.log('========================================\n');

// Progress callback to track progress updates
const onProgress = (stage, progress, message) => {
  console.log(`[Progress] Stage: ${stage}, Progress: ${progress}%, Message: ${message}`);
};

async function runTest() {
  const startTime = Date.now();

  try {
    console.log('Creating script parser...');
    const parser = createScriptParser({
      useCache: false,
      useDramaRules: false,
    });

    console.log('\nStarting parse...\n');
    const result = await parser.parseScript(
      'test-script-id',
      'test-project-id',
      testScript,
      onProgress
    );

    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('Parse Result');
    console.log('========================================');
    console.log(`Duration: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
    console.log(`Stage: ${result.stage}`);
    console.log(`Progress: ${result.progress}%`);
    console.log(`\nMetadata:`);
    console.log(`  Title: ${result.metadata?.title || 'N/A'}`);
    console.log(`  Synopsis: ${result.metadata?.synopsis || 'N/A'}`);
    console.log(`  Characters: ${result.metadata?.characterCount || 0}`);
    console.log(`  Scenes: ${result.metadata?.sceneCount || 0}`);
    console.log(`\nCharacters (${result.characters?.length || 0}):`);
    result.characters?.forEach((char, i) => {
      console.log(`  ${i + 1}. ${char.name} - ${char.role}`);
    });
    console.log(`\nScenes (${result.scenes?.length || 0}):`);
    result.scenes?.forEach((scene, i) => {
      console.log(`  ${i + 1}. ${scene.name}`);
    });
    console.log(`\nShots (${result.shots?.length || 0}):`);
    result.shots?.forEach((shot, i) => {
      console.log(`  ${i + 1}. [${shot.sceneName}] ${shot.description?.substring(0, 50)}...`);
    });

    console.log('\n========================================');
    console.log('Test Result: SUCCESS');
    console.log('========================================');

    // Validate results
    const checks = {
      hasMetadata: !!result.metadata,
      hasTitle: !!result.metadata?.title,
      hasCharacters: (result.characters?.length || 0) > 0,
      hasScenes: (result.scenes?.length || 0) > 0,
      hasShots: (result.shots?.length || 0) > 0,
      isCompleted: result.stage === 'completed',
    };

    console.log('\nValidation Checks:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${passed ? '✓' : '✗'} ${check}`);
    });

    const allPassed = Object.values(checks).every(v => v);
    console.log(`\n${allPassed ? '✓ All checks passed!' : '✗ Some checks failed!'}`);
  } catch (error) {
    console.error('\n========================================');
    console.error('Test Result: FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

runTest();
