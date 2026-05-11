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
// Hugging Face — Serverless Inference API (OpenAI-compatible, FREE tier)
//
// Uses the HF router chat-completions endpoint introduced in 2024.
// All models listed in MODEL_PRESETS.hf are small enough to run entirely
// on HuggingFace's free infrastructure — NO credits required, just a
// free account token from https://huggingface.co/settings/tokens
// ---------------------------------------------------------------------------
async function callHuggingFace({ apiKey, model, prompt }) {
  // OpenAI-compatible endpoint served by HF's free serverless router
  const endpoint = `https://router.huggingface.co/hf-inference/models/${model}/v1/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // Surface the clearest available error message
    const msg =
      err?.error?.message ??
      err?.error ??
      `Hugging Face API error: ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text === 'string') return text;

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
    // All models below run on HF free serverless infrastructure —
    // no credits needed, only a free HF account token.
    { id: 'HuggingFaceTB/SmolLM2-1.7B-Instruct',   label: 'SmolLM2 1.7B (by HuggingFace — fastest)' },
    { id: 'Qwen/Qwen2.5-1.5B-Instruct',             label: 'Qwen 2.5 1.5B Instruct' },
    { id: 'Qwen/Qwen2.5-3B-Instruct',               label: 'Qwen 2.5 3B Instruct (smarter)' },
    { id: 'microsoft/Phi-3.5-mini-instruct',         label: 'Phi-3.5 Mini (Microsoft, 3.8B)' },
    { id: 'google/gemma-3-1b-it',                    label: 'Gemma 3 1B (Google, lightweight)' },
  ],
};
