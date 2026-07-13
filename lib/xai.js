async function callXaiVision(apiKey, { system, userText, imageBase64, temperature = 0.9, maxTokens = 520 }) {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-4.3',
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' }
            }
          ]
        }
      ],
      max_completion_tokens: maxTokens,
      temperature
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.error?.message || `xAI API error: ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = { callXaiVision };