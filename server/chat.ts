import type { ChatRequest } from '../types';
import { generateStream, getApiKey } from './gemini';
import { loadStore } from './store';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const SYSTEM =
  'You are a real estate assistant answering questions about one property from its video tour. ' +
  'Use only the listing facts and the scene notes provided. If the answer is not there, say you cannot tell from the tour and suggest what to ask the agent. ' +
  'Cite the moment for every claim drawn from a scene with its start time in square brackets, like [1:25]. ' +
  'Keep answers short: two to five sentences or a brief list.';

/** Builds the full grounding context. A tour is at most a few minutes, so every scene fits. */
export function buildContext(youtubeId: string, currentTime?: number): string | null {
  const property = loadStore().byProperty.get(youtubeId);
  if (!property) return null;
  const facts = [
    `Name: ${property.name}`,
    `Address: ${property.address}`,
    `Beds: ${property.beds || 'unknown'}, Baths: ${property.baths || 'unknown'}, Size: ${property.sqft ? property.sqft + ' sq ft' : 'unknown'}`,
    property.price ? `Listed price: ${property.price}` : null,
    property.description ? `Listing blurb: ${property.description}` : null,
  ].filter(Boolean);

  const scenes = property.segments.map(s => {
    const here = currentTime !== undefined && currentTime >= s.start && currentTime < s.end ? ' (viewer is watching this now)' : '';
    return `[${fmt(s.start)}–${fmt(s.end)}] ${s.room}${here}\nSeen: ${s.caption}\nFeatures: ${s.features.join(', ')}\nSaid: ${s.transcript || '(no speech)'}`;
  });
  return `LISTING\n${facts.join('\n')}\n\nSCENES\n${scenes.join('\n\n')}`;
}

export async function* chat(req: ChatRequest): AsyncGenerator<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    yield 'Chat needs a Gemini API key on the server. Set GEMINI_API_KEY and restart.';
    return;
  }
  const context = buildContext(req.youtubeId, req.currentTime);
  if (!context) {
    yield 'I could not find that property.';
    return;
  }
  const history = (req.history ?? []).slice(-6).map(t => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: t.text }],
  }));
  yield* generateStream(
    [
      { role: 'user', parts: [{ text: context }] },
      { role: 'model', parts: [{ text: 'Understood. Ask me about this property.' }] },
      ...history,
      { role: 'user', parts: [{ text: req.question }] },
    ],
    apiKey,
    { system: SYSTEM, temperature: 0.3 },
  );
}
