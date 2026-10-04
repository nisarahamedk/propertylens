// Model ids and ranking knobs. Everything model-specific lives here so a
// provider or model change is a one-file edit plus a re-index.

const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

export const MODELS = {
  // Multimodal: embeds text, images, audio and video into one space.
  embedding: env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2',
  // Used for captioning at index time, query parsing and chat.
  flash: env.GEMINI_FLASH_MODEL || 'gemini-flash-latest',
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
  // Absolute floor on the blended cosine. Tune with ingestion/eval.ts.
  minBlended: Number(env.SEARCH_MIN_SCORE ?? 0.25),
  // Drop properties whose best moment is far below the top result.
  relativeCutoff: 0.6,
  maxProperties: 8,
  maxMomentsPerProperty: 3,
};
