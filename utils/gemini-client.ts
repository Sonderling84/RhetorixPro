import { GoogleGenAI } from '@google/genai';

let _cachedKey: string | null = null;

async function fetchKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;
  const res = await fetch('/api/gemini-key');
  if (!res.ok) throw new Error('Gemini Key nicht verfügbar');
  const data = await res.json();
  _cachedKey = data.key;
  return _cachedKey;
}

export async function getGeminiAI(): Promise<GoogleGenAI> {
  const key = await fetchKey();
  return new GoogleGenAI({ apiKey: key });
}
