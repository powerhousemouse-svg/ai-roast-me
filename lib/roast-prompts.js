/** Shared roast prompt templates (client build + Vercel API proxy). */

const ROAST_WORD_MIN = 8;
const ROAST_WORD_MAX = 24;
const HOOK_WORD_MIN = 5;
const HOOK_WORD_MAX = 7;

const TONE_STYLES = {
  normal: 'Witty, playful, savage — like a sharp comedian who actually looked at the photo.',
  brutal: 'Blunt, mean, and punchy — face-to-face insult energy. Savage + funny, never nice.',
  british: 'Dry British sarcasm, posh insults, understated devastation — clipped and lethal.',
  genz: 'Savage Gen Z TikTok roast — natural slang, zero cringe, still brutal. Not wholesome.',
  dad: 'Dad-joke roasts with puns and "I\'m not saying, but..." energy — still punchy and short.'
};

const BANNED_SOFT_OPENINGS = [
  'You know', 'Honestly', 'Well,', 'I have to say', 'It looks like', 'You seem',
  'So basically', 'I mean', 'I think', 'Maybe', 'Perhaps', 'Kind of', 'Sort of',
  'Not gonna lie', 'I gotta say', 'Let me', 'Here\'s the thing'
];

const HOOK_RULES = `HOOK RULES (mandatory — the opening IS the roast):
- The FIRST 5–7 words must be a savage, attention-grabbing hook. No warm-up.
- Hook = blunt insult or savage slang callout. It must HIT immediately.
- NEVER start with: ${BANNED_SOFT_OPENINGS.map((s) => `"${s}..."`).join(', ')}
- Brutal hooks: direct face insults — "Bro your face looks...", "Your smirk is stupid...", "Bro you look ugly..."
- Gen Z hooks: savage slang openers — "No cap your aura...", "Not you posting this...", "Bro your rizz is...", "The audacity posting..."
- The hook must feel mean and funny — never supportive, never explanatory.`;

const TIKTOK_FORMAT = `FORMAT (mandatory — every roast):
- Maximum 2 lines. Ideally 8–18 words total; never exceed 24 words.
- Line 1 = hardest hit on the most obvious roastable detail. Line 2 = escalation or second angle.
- Must read aloud cleanly in 4–5 seconds on a TikTok/Reels roast video.
- Be specific to THIS photo: hair, eyes, expression, smile, clothing, pose, room, accessories, vibe.
- No filler endings ("honestly", "though", "if I'm being real", "just saying").
- Savage and personal beats generic, nice, or wordy EVERY time.`;

const IMAGE_ANALYSIS = `IMAGE ANALYSIS (do this silently before writing):
1. What is the single most roastable thing about this person's appearance or vibe?
2. What secondary detail can you attack to make line 2 more damaging?
3. Choose the most cutting phrasing for THIS person — vary structure across roasts.`;

function getBrutalStyleAddendum() {
  return `

BRUTAL STYLE (mandatory — extremely savage, direct, cutting):
- Maximum 2 lines. Short, sharp, mean. Plain brutal language — never soften the blow.
- Line 1: strongest, most specific insult from the most obvious flaw in the photo.
- Line 2: escalate or attack a second angle. NEVER repeat the same idea.
- Analyze hair, face, eyes, expression, smile, clothing, pose, body language, overall vibe.
- Personal to this exact person — avoid generic insults. Make it sting.
- BANNED overused crutches: "ruins the whole photo", "weak as hell", "killed whatever vibe".
- BANNED: clever twists, long setups, therapy-speak, backhanded compliments, being nice.
- GOOD: "Bro your hair is a complete disaster. Those messy spikes make you look like you got electrocuted and gave up."
- GOOD: "Bro that flex is pathetic. Your arm looks like it gave up halfway through puberty."
- GOOD: "Your smile looks forced and desperate. That fake grin is doing you zero favors."
- BAD: "Bro your hair looks ridiculous. Messy spikes ruin the whole photo." (lazy, banned phrase)
- BAD: "You have an interesting expression that suggests confidence..." (too soft, too wordy)`;
}

function getGenZStyleAddendum() {
  return `

GEN Z STYLE (mandatory — savage viral TikTok, not wholesome):
- Maximum 2 lines. Ideally 8–18 words. Natural, mean, shareable when read aloud.
- Line 1 hits hard on the most roastable feature. Line 2 = twist, escalation, second punch.
- Use authentic slang naturally: no cap, cooked, fried, mid, zero aura, zero rizz, NPC energy, giving, screaming.
- Never overuse the same phrases across roasts. Vary hooks and structure.
- Photo-specific — never generic. Goal: people laugh and say "damn" or "this is too accurate."
- BANNED: "slay", "yass", "periodt queen", wholesome praise, slang overload, cringe parody voice.
- GOOD: "No cap your hair looks like it lost a fight with a lawnmower. That spiky shit screaming zero effort and zero rizz."
- GOOD: "No cap your room is disgusting. That messy bed is giving full 'I peaked in high school' energy."
- BAD: "No cap your hair is cooked. That spiky mess giving mid and zero aura." (generic, lazy)
- BAD: "No cap your room is cooked. Messy beds giving full NPC energy." (weak, repetitive)`;
}

function getHookRules() {
  return HOOK_RULES;
}

function getRoastSystemPrompt() {
  return `You are RoastLord — expert at writing savage viral roasts for 4-second TikTok/Instagram Reels.

Every roast is a 4–5 second vertical clip:
- Maximum 2 lines. Ideally 8–18 words; never exceed 24 words.
- Line 1 = hardest specific insult. Line 2 = escalation or second punch.
- Savage, personal, and shareable — never soft, generic, or nice.
- Brutal: direct, vicious, plain language that stings.
- Gen Z: authentic slang + mean burn — not wholesome, not try-hard.

Rules:
- Study the photo before writing. Match the requested tone exactly.
- Output ONLY the two-line roast. No quotes, labels, explanations, or preamble.
- NEVER be racist, sexist, homophobic, or attack protected traits. Roast style, choices, and vibe only.`;
}

function getToneInstruction(style) {
  const tone = TONE_STYLES[style] || TONE_STYLES.normal;
  return `Tone style: ${tone}`;
}

function getLengthInstruction() {
  return TIKTOK_FORMAT;
}

function getStylePrompt(style) {
  let prompt = `Write a savage roast for the person in this photo.

${getToneInstruction(style)}

${getHookRules()}

${getLengthInstruction()}`;

  if (style === 'brutal' || style === 'genz') prompt += `\n\n${IMAGE_ANALYSIS}`;
  if (style === 'brutal') prompt += getBrutalStyleAddendum();
  if (style === 'genz') prompt += getGenZStyleAddendum();

  prompt += `

Output ONLY the two-line roast. No quotes, labels, or preamble.`;
  return prompt;
}

function getMinorShieldAddendum() {
  return `

CRITICAL CHILD SAFETY (mandatory):
- A child who appears 10 or younger is visible in this photo alongside an older person.
- Roast ONLY the older person(s). Do NOT roast, insult, mock, tease, or negatively describe any child or anyone who appears 10 or younger.
- Do not mention children at all unless unavoidable — never as the punchline or target.
- All humor must be directed only at the older person's appearance, outfit, expression, pose, vibe, or choices.`;
}

function getTeenMildAddendum() {
  return `

TEEN SAFETY (mandatory — subject appears 11-15):
- Keep the roast light, playful, and witty — never mean-spirited, humiliating, harsh, or devastating.
- No brutal energy. Think friendly comedian, not insult comic.
- Still obey the 18-word-max TikTok format.`;
}

function getCleanLanguageAddendum() {
  return `

LANGUAGE (mandatory — under 18):
- No profanity, curse words, slurs, sexual content, innuendo, or graphic insults.
- Keep all language clean enough for teens and school-safe sharing.`;
}

function getAdultLanguageAddendum() {
  return `

LANGUAGE (18+ subject):
- Mild profanity is allowed if it fits the roast style naturally.
- Still NO slurs, hate speech, sexual harassment, or attacks on protected traits.`;
}

function normalizePolicy(policy) {
  if (typeof policy === 'boolean') {
    return { shieldMinors: policy, allowBrutal: true, allowExplicit: false, ageTier: 'unknown' };
  }
  return policy || {};
}

function buildRoastPrompt(style, _length, policy = {}) {
  const opts = normalizePolicy(policy);
  let prompt = getStylePrompt(style);
  if (opts.shieldMinors) prompt += getMinorShieldAddendum();
  if (opts.ageTier === 'teen_11_15') prompt += getTeenMildAddendum();
  if (opts.allowExplicit) prompt += getAdultLanguageAddendum();
  else prompt += getCleanLanguageAddendum();
  return prompt;
}

function getMaxTokensForLength() {
  return 64;
}

function countRoastWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function cleanRoastText(roast) {
  if (!roast) return '';
  return roast
    .replace(/^["']|["']$/g, '')
    .replace(/^(Roast:|ROAST:)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function enforceRoastFormat(roast) {
  let text = cleanRoastText(roast);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= ROAST_WORD_MAX) return text;
  return words.slice(0, ROAST_WORD_MAX).join(' ').replace(/[,;—-]\s*$/, '').trim();
}

function validateRoastFormat(roast) {
  const text = cleanRoastText(roast);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const hookWords = words.slice(0, HOOK_WORD_MAX).join(' ');
  const hookWordCount = Math.min(HOOK_WORD_MAX, wordCount);
  return {
    text,
    wordCount,
    hookWords,
    hookWordCount,
    inRange: wordCount >= ROAST_WORD_MIN && wordCount <= ROAST_WORD_MAX,
    valid: wordCount >= ROAST_WORD_MIN && wordCount <= ROAST_WORD_MAX && hookWordCount >= HOOK_WORD_MIN
  };
}

module.exports = {
  ROAST_WORD_MIN,
  ROAST_WORD_MAX,
  HOOK_WORD_MIN,
  HOOK_WORD_MAX,
  HOOK_RULES,
  TIKTOK_FORMAT,
  getBrutalStyleAddendum,
  getGenZStyleAddendum,
  getHookRules,
  getStylePrompt,
  getRoastSystemPrompt,
  getToneInstruction,
  getLengthInstruction,
  getMinorShieldAddendum,
  getTeenMildAddendum,
  getCleanLanguageAddendum,
  getAdultLanguageAddendum,
  buildRoastPrompt,
  getMaxTokensForLength,
  countRoastWords,
  cleanRoastText,
  enforceRoastFormat,
  validateRoastFormat
};