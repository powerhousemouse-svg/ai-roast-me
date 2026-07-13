const { callXaiVision } = require('./xai');

const BLOCK_UNDER_11_MESSAGE =
  'RoastLord cannot roast people who appear under 11. Please upload a photo of someone age 11 or older.';

const BLOCK_MESSAGE = BLOCK_UNDER_11_MESSAGE;

function getAgeCheckSystemPrompt() {
  return `You are a conservative photo safety classifier. Estimate apparent ages of visible people. If unsure whether someone is under 11, classify them as under 11. Output ONLY valid JSON with no markdown fences.`;
}

function getAgeCheckUserPrompt() {
  return `Analyze every visible person in this photo. For each person estimate one bucket:
- "under_11" (appears 10 or younger)
- "age_11_15"
- "age_16_17"
- "age_18_plus"
- "unclear"

Return ONLY this JSON object:
{
  "hasVisiblePeople": boolean,
  "peopleCount": number,
  "subjectAgeBucket": "under_11" | "age_11_15" | "age_16_17" | "age_18_plus" | "unclear",
  "hasChild10OrUnder": boolean,
  "hasPerson11to15": boolean,
  "hasPerson16to17": boolean,
  "hasPerson18Plus": boolean,
  "onlyChildrenUnder11": boolean,
  "confidence": "high" | "medium" | "low",
  "notes": "brief"
}

Rules:
- subjectAgeBucket: apparent age of the PRIMARY subject (main person being photographed — usually largest/central face)
- hasChild10OrUnder: true if ANY person appears 10 or younger
- hasPerson11to15: true if ANY person appears 11-15
- hasPerson16to17: true if ANY person appears 16-17
- hasPerson18Plus: true if ANY person appears 18+
- onlyChildrenUnder11: true ONLY when hasVisiblePeople is true AND every visible person appears 10 or younger
- If no people are visible, set hasVisiblePeople false and other flags false`;
}

function parseAgeCheckResponse(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function makeAllowPolicy(ageTier, shieldMinors = false) {
  const base = { action: 'allow', shieldMinors: Boolean(shieldMinors), ageTier };
  switch (ageTier) {
    case 'teen_11_15':
      return { ...base, allowBrutal: false, allowExplicit: false };
    case 'teen_16_17':
      return { ...base, allowBrutal: true, allowExplicit: false };
    case 'adult_18_plus':
      return { ...base, allowBrutal: true, allowExplicit: true };
    default:
      return { ...base, ageTier: 'unknown', allowBrutal: false, allowExplicit: false, uncertain: true };
  }
}

function getAgePolicy(ageData) {
  if (!ageData) return makeAllowPolicy('unknown');

  if (!ageData.hasVisiblePeople) {
    return makeAllowPolicy('unknown');
  }

  if (ageData.onlyChildrenUnder11) {
    return { action: 'block', code: 'UNDER_11', message: BLOCK_UNDER_11_MESSAGE };
  }

  if (ageData.hasChild10OrUnder) {
    if (ageData.hasPerson18Plus) return makeAllowPolicy('adult_18_plus', true);
    if (ageData.hasPerson16to17) return makeAllowPolicy('teen_16_17', true);
    if (ageData.hasPerson11to15) return makeAllowPolicy('teen_11_15', true);
    return { action: 'block', code: 'UNDER_11', message: BLOCK_UNDER_11_MESSAGE };
  }

  const bucket = ageData.subjectAgeBucket;
  if (bucket === 'under_11') {
    return { action: 'block', code: 'UNDER_11', message: BLOCK_UNDER_11_MESSAGE };
  }
  if (bucket === 'age_11_15') return makeAllowPolicy('teen_11_15');
  if (bucket === 'age_16_17') return makeAllowPolicy('teen_16_17');
  if (bucket === 'age_18_plus') return makeAllowPolicy('adult_18_plus');

  if (ageData.hasPerson18Plus && !ageData.hasPerson11to15) return makeAllowPolicy('adult_18_plus');
  if (ageData.hasPerson16to17 && !ageData.hasPerson11to15) return makeAllowPolicy('teen_16_17');
  if (ageData.hasPerson11to15) return makeAllowPolicy('teen_11_15');

  return makeAllowPolicy('unknown');
}

function resolveRoastStyle(requestedStyle, policy) {
  const allowed = ['normal', 'brutal', 'british', 'genz', 'dad'];
  const style = allowed.includes(requestedStyle) ? requestedStyle : 'normal';
  if (style === 'brutal' && policy && !policy.allowBrutal) return 'normal';
  return style;
}

async function analyzePhotoAge(apiKey, imageBase64) {
  const raw = await callXaiVision(apiKey, {
    system: getAgeCheckSystemPrompt(),
    userText: getAgeCheckUserPrompt(),
    imageBase64,
    temperature: 0.1,
    maxTokens: 320
  });

  const parsed = parseAgeCheckResponse(raw);
  const policy = getAgePolicy(parsed);

  return { raw, parsed, policy };
}

module.exports = {
  BLOCK_MESSAGE,
  BLOCK_UNDER_11_MESSAGE,
  getAgeCheckSystemPrompt,
  getAgeCheckUserPrompt,
  parseAgeCheckResponse,
  getAgePolicy,
  makeAllowPolicy,
  resolveRoastStyle,
  analyzePhotoAge
};