// Model ids and ranking knobs. Everything model-specific lives here so a
// provider or model change is a one-file edit plus a re-index.

const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

const DEFAULT_FLASH_CHAIN = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

/** GEMINI_FLASH_MODELS sets the whole list; GEMINI_FLASH_MODEL only moves one model to the front. */
function flashChain(): string[] {
  if (env.GEMINI_FLASH_MODELS) return env.GEMINI_FLASH_MODELS.split(',').map(m => m.trim()).filter(Boolean);
  const first = env.GEMINI_FLASH_MODEL?.trim();
  return first ? [first, ...DEFAULT_FLASH_CHAIN.filter(m => m !== first)] : DEFAULT_FLASH_CHAIN;
}

export const MODELS = {
  // Multimodal: embeds text, images, audio and video into one space.
  embedding: env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
  // Used for captioning at index time, query parsing and chat. Pinned rather
  // than an alias so the model cannot change between indexing and serving.
  // Flash-Lite matched full Flash on scene notes in testing, and its free tier
  // (500 requests/day) fits a full index; full Flash allows only 20/day.
  flash: flashChain()[0],
  // Tried in order when a model is out of quota or overloaded. Each model has
  // its own quota. The embedding model cannot rotate: vectors from different
  // models live in different spaces.
  flashChain: flashChain(),
};

/** Matryoshka-truncated output size. Vectors are re-normalised after truncation. */
export const EMBEDDING_DIMS = 768;

export const SEGMENT = {
  length: 30, // seconds; the embedding model accepts up to 80s of video with audio
  step: 25,   // 5s overlap so a room is not split across two windows
  minTail: 8, // drop a trailing window shorter than this
};

export const RANKING = {
  // Blend of the two cosine similarities used for the displayed match score.
  visualWeight: 0.6,
  speechWeight: 0.4,
  // Reciprocal rank fusion weights for ordering (visual, speech, keyword).
  rrf: { k: 60, visual: 1.0, speech: 0.8, keyword: 0.5 },
  // Absolute floor on the blended cosine. Tune with ingestion/eval.ts. On the
  // 65-tour index, the best tour for queries naming something no tour has
  // scored 0.585-0.638, and for common features 0.646-0.713.
  minBlended: Number(env.SEARCH_MIN_SCORE ?? 0.64),
  // Floor on the cosine between the query and one room's still. Higher than a
  // clip's floor because a single frame of a matching room stands out further.
  minStill: Number(env.SEARCH_MIN_STILL ?? 0.64),
  // A query word counts as distinctive if it appears in fewer than this share of
  // scenes. Scenes containing every distinctive query word pass the floor.
  distinctiveDocShare: 0.25,
  // Drop properties whose best moment is far below the top result.
  relativeCutoff: 0.6,
  maxProperties: 8,
  // Homes shown when the filters match but nothing clears the floor.
  closestProperties: 3,
  maxMomentsPerProperty: 3,
};
