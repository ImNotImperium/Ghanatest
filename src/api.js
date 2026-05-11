/**
 * api.js — AI Generation Utility
 *
 * Supports two free backends, selected by the `provider` argument:
 *   "gemini"  → Google Gemini 1.5 Flash (free tier, no credit card needed)
 *               Get key: https://aistudio.google.com/app/apikey
 *   "hf"      → Hugging Face Inference API (free tier)
 *               Get key: https://huggingface.co/settings/tokens
 *
 * Usage:
 *   import { generateContent } from './api';
 *   const text = await generateContent({ provider, apiKey, model, prompt });
 */

// ---------------------------------------------------------------------------
// Gemini — Google Generative Language REST API
// ---------------------------------------------------------------------------
async function callGemini({ apiKey, model, prompt }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? `Gemini API error: ${response.status}`
    );
  }

  const data = await response.json();
  // Navigate the nested response shape
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// Hugging Face — Inference API (text-generation task)
// ---------------------------------------------------------------------------
async function callHuggingFace({ apiKey, model, prompt }) {
  const endpoint = `https://api-inference.huggingface.co/models/${model}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 512,
        temperature: 0.8,
        return_full_text: false,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error ?? `Hugging Face API error: ${response.status}`
    );
  }

  const data = await response.json();

  // HF returns an array of generated sequences
  if (Array.isArray(data) && data[0]?.generated_text !== undefined) {
    return data[0].generated_text;
  }

  // Some models wrap the result differently
  if (data?.generated_text) return data.generated_text;

  throw new Error('Unexpected response shape from Hugging Face API.');
}

// ---------------------------------------------------------------------------
// Public entry-point
// ---------------------------------------------------------------------------

/**
 * @param {Object} params
 * @param {'gemini'|'hf'} params.provider  - Which backend to use
 * @param {string}        params.apiKey    - API key for the selected provider
 * @param {string}        params.model     - Model identifier string
 * @param {string}        params.prompt    - User's prompt text
 * @returns {Promise<string>}              - The generated text
 */
export async function generateContent({ provider, apiKey, model, prompt }) {
  if (!apiKey?.trim()) throw new Error('Please enter a valid API key.');
  if (!prompt?.trim()) throw new Error('Prompt cannot be empty.');

  if (provider === 'gemini') return callGemini({ apiKey, model, prompt });
  if (provider === 'hf') return callHuggingFace({ apiKey, model, prompt });

  throw new Error(`Unknown provider: "${provider}"`);
}

// ---------------------------------------------------------------------------
// Model presets exposed to the UI
// ---------------------------------------------------------------------------
export const MODEL_PRESETS = {
  gemini: [
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (fast, free)' },
    { id: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro (powerful, free tier)' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (latest)' },
  ],
  hf: [
    { id: 'mistralai/Mistral-7B-Instruct-v0.2',  label: 'Mistral 7B Instruct' },
    { id: 'HuggingFaceH4/zephyr-7b-beta',         label: 'Zephyr 7B Beta' },
    { id: 'tiiuae/falcon-7b-instruct',             label: 'Falcon 7B Instruct' },
  ],
};
