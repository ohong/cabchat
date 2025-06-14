export enum Modes {
  LOCAL = 'local',
  REMOTE = 'remote',
}

export const DEFAULT_TTS_MODEL_ID = 'v3';
export const DEFAULT_VOICE_ID = 'Ronald';
export const DEFAULT_LLM_MODEL_NAME = 'meta-llama/Llama-3.1-70b-Instruct';
export const DEFAULT_EMBEDDER_MODEL_NAME = 'BAAI/bge-large-en-v1.5';
export const DEFAULT_PROVIDER = 'inworld';
export const SAMPLE_RATE = 24000;
export const TEXT_CONFIG = {
  maxNewTokens: 2500,
  maxPromptLength: 100,
  repetitionPenalty: 1,
  topP: 1,
  temperature: 1,
};

export const INTENTS = [
  {
    name: 'greeting',
    phrases: [
      'Hello',
      'Hi there',
      'Hey',
      'Good morning',
      'Good afternoon',
      'Good evening',
    ],
  },
  {
    name: 'farewell',
    phrases: [
      'Goodbye',
      'Bye',
      'See you later',
      'Take care',
      'Have a good day',
    ],
  },
  {
    name: 'help',
    phrases: [
      'I need help',
      'Can you help me?',
      'Could you assist me?',
      'Help please',
      'Support needed',
    ],
  },
];

export const DEFAULT_TOP_K = 2;
export const DEFAULT_THRESHOLD = 0.5;
export const DEFAULT_KNOWLEDGE_QUERY = 'How often are the Olympics held?';
export const KNOWLEDGE_RECORDS = [
  'The Olympics are staged every four years.',
  'Our solar system includes the Sun, eight planets, five officially named dwarf planets, hundreds of moons, and thousands of asteroids and comets.',
  'Nightingales have an astonishingly rich repertoire, able to produce over 1000 different sounds, compared with just 340 by skylarks and about 100 by blackbirds.',
];
export const KNOWLEDGE_COMPILE_CONFIG = {
  parsingConfig: {
    maxCharsPerChunk: 200,
    maxChunksPerDocument: 100,
  },
};
