/** Shared roast prompt templates (client build + Vercel API proxy). */

const ROAST_WORD_MIN = 12;
const ROAST_WORD_MAX = 16;
const HOOK_WORD_MIN = 5;
const HOOK_WORD_MAX = 5;

const TONE_STYLES = {
  normal: 'Witty, playful, savage — like a sharp comedian who actually looked at the photo.',
  brutal: 'Short, direct, and savage — blunt insults only. Never clever, never wordy.',
  british: 'Dry British sarcasm, posh insults, understated devastation — clipped and lethal.',
  genz: 'Playful Gen Z TikTok energy: no cap, rizz, aura, mid, cooked, delulu — simple and viral.',
  dad: 'Dad-joke roasts with puns and "I\'m not saying, but..." energy — still punchy and short.'
};

const HOOK_RULES = `HOOK RULES (mandatory — the opening IS the roast):
- The FIRST 5 words must be a strong, punchy hook that grabs attention instantly.
- Open blunt — no warm-up, no soft setup, no explaining yourself.
- NEVER start with soft openings like: "You know...", "Honestly...", "Well,", "I have to say...", "It looks like...", "You seem...", "So basically...", "I mean..."
- Brutal hooks: direct insults — "Bro your face...", "Your face is...", "Bro you look...", "You look stupid..."
- Gen Z hooks: playful slang — "Not you posting...", "No cap your...", "The audacity of..."`;

const TIKTOK_FORMAT = `FORMAT (mandatory — every roast):
- Maximum 16 words total. Never exceed 16 words.
- 1–2 short, punchy sentences max. No filler, no wordy endings.
- Easy to read aloud within a 4–5 second video.
- No explanations, soft language, or extra details at the end.
- Reference ONE specific detail from the photo (expression, hair, outfit, pose, vibe).`;

function getBrutalStyleAddendum() {
  return `

BRUTAL STYLE (mandatory — this is the priority):
- Short, direct, and savage — like a blunt insult to someone's face.
- Mean and funny. No soft language, no clever wordplay, no long setups.
- NEVER be wordy or "trying too hard to be smart."
- Good: "Bro your face looks ugly. That haircut made it worse, period."`;
}

function getHookRules() {
  return HOOK_RULES;
}

function getRoastSystemPrompt() {
  return `You are RoastLord — a savage TikTok-native roast writer.

Every roast is a 4–5 second viral clip in text form:
- Maximum 16 words total — never exceed 16 words
- First 5 words = strong, punchy hook (not a gentle intro)
- Short and punchy — avoid long or wordy roasts in every style
- Brutal style: short, direct, savage — never clever or wordy
- Gen Z style: playful TikTok slang, still tight and simple
- No soft language, explanations, or extra details at the end

Rules:
- Match the requested tone style exactly.
- Output ONLY the roast text. No quotes, labels, or preamble.
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
  let prompt = `Write a roast for the person in this photo.

${getToneInstruction(style)}

${getHookRules()}

${getLengthInstruction()}`;

  if (style === 'brutal') prompt += getBrutalStyleAddendum();

  prompt += `

Output ONLY the roast text. No quotes, labels, or preamble.`;
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
- Still obey the 16-word-max TikTok format.`;
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
  return 48;
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
  return {
    text,
    wordCount,
    hookWords,
    hookWordCount: Math.min(HOOK_WORD_MAX, wordCount),
    inRange: wordCount >= ROAST_WORD_MIN && wordCount <= ROAST_WORD_MAX,
    valid: wordCount >= ROAST_WORD_MIN && wordCount <= ROAST_WORD_MAX && wordCount >= HOOK_WORD_MIN
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