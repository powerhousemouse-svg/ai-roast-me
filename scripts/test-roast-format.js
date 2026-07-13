#!/usr/bin/env node
const {
  ROAST_WORD_MAX,
  HOOK_WORD_MIN,
  buildRoastPrompt,
  getRoastSystemPrompt,
  getHookRules,
  getBrutalStyleAddendum,
  getGenZStyleAddendum,
  enforceRoastFormat,
  validateRoastFormat,
  countRoastWords
} = require('../lib/roast-prompts');
const { getFirstLineStyle } = require('../lib/video-timing');

const SOFT_OPENINGS = /^(you know|honestly|well,|i have to say|it looks like|you seem|so basically|maybe|kind of)/i;

const FALLBACK_EXAMPLES = {
  normal: "Not you walking in looking cooked. Your haircut called security and your aura screams mid.",
  brutal: "Bro your smirk is stupid ugly. That face ruins the whole photo, period.",
  british: "Absolutely not, you look like that. Your mirror filed a complaint and won in court.",
  genz: "No cap your aura is cooked. That smile screams mid and zero rizz.",
  dad: "I'm not saying you're mid, but wow. Your reflection filed paperwork and hesitated."
};

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    failed++;
  }
}

console.log('RoastLord TikTok format tests\n');

console.log('Prompt structure:');
const brutalPrompt = buildRoastPrompt('brutal', null, { allowExplicit: true, ageTier: 'adult_18_plus' });
const genzPrompt = buildRoastPrompt('genz', null, { allowExplicit: true, ageTier: 'adult_18_plus' });
assert('system prompt mentions max 18 words', getRoastSystemPrompt().includes('18 words'));
assert('hook rules use 5–7 words', getHookRules().includes('5–7 words'));
assert('brutal prompt includes BRUTAL STYLE addendum', brutalPrompt.includes('BRUTAL STYLE'));
assert('genz prompt includes GEN Z STYLE addendum', genzPrompt.includes('GEN Z STYLE'));
assert('brutal addendum bans soft language', getBrutalStyleAddendum().includes('NEVER soft'));
assert('genz addendum bans slang overload', getGenZStyleAddendum().includes('NEVER stack'));

console.log('\nVideo timing:');
const firstLine = getFirstLineStyle();
assert('first line alpha is 1 at t=0', firstLine.alpha === 1);
assert('first line scale is 1 at t=0', firstLine.scale === 1);

console.log('\nFallback roast examples:');
for (const [style, roast] of Object.entries(FALLBACK_EXAMPLES)) {
  const v = validateRoastFormat(roast);
  console.log(`\n  [${style}] (${v.wordCount}w) "${roast}"`);
  console.log(`    hook: "${v.hookWords}"`);
  assert(`${style} word count <= ${ROAST_WORD_MAX}`, v.wordCount <= ROAST_WORD_MAX);
  assert(`${style} hook has >= ${HOOK_WORD_MIN} words`, v.hookWordCount >= HOOK_WORD_MIN);
  assert(`${style} no soft opening`, !SOFT_OPENINGS.test(v.text));
}

console.log('\nEnforce trim (safety net):');
const longRoast =
  'Your face is doing way too much confidence for someone who clearly peaked in a group chat argument last Tuesday night and never recovered from it honestly.';
const trimmed = enforceRoastFormat(longRoast);
assert(`long roast trimmed to ${ROAST_WORD_MAX} words`, countRoastWords(trimmed) === ROAST_WORD_MAX);
console.log(`    trimmed: "${trimmed}"`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);