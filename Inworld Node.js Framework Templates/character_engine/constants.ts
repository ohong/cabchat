export const DEFAULT_VOICE_ID = 'Dennis';
export const DEFAULT_LLM_MODEL_NAME = 'meta-llama/Llama-3.1-70b-Instruct';
export const DEFAULT_PROVIDER = 'inworld';
export const SAMPLE_RATE = 16000;
export const PAUSE_DURATION_THRESHOLD = 1000;
export const FRAME_PER_BUFFER = 1024;
export const TEXT_CONFIG = {
  maxNewTokens: 500,
  maxPromptLength: 1000,
  repetitionPenalty: 1,
  topP: 0.5,
  temperature: 0.1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n'],
};

export const WS_APP_PORT = 4000;
