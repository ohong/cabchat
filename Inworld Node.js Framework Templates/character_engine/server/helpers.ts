import { primitives } from '@inworld/framework-nodejs';
const { renderJinja } = primitives.llm;

import {
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  DEFAULT_VOICE_ID,
} from '../constants';
import { PromptInput } from './types';

const getPromptData = ({
  agent,
  messages,
  userName,
  userQuery,
}: PromptInput) => ({
  agent_profile: {
    name: agent.name,
    description: agent.description,
    long_term_motivation: agent.motivation,
  },
  event_history: messages.map((m) => ({
    agent_speech: {
      agent_name: m.role === 'user' ? userName : agent.name,
      utterance: m.content,
    },
  })),
  user_name: userName,
  user_query: userQuery,
});

export const parseEnvironmentVariables = () => {
  if (!process.env.INWORLD_API_KEY) {
    throw new Error('INWORLD_API_KEY env variable is required');
  }

  if (!process.env.VAD_MODEL_PATH) {
    throw new Error('VAD_MODEL_PATH env variable is required');
  }

  return {
    apiKey: process.env.INWORLD_API_KEY,
    llmModelName: process.env.LLM_MODEL_NAME || DEFAULT_LLM_MODEL_NAME,
    llmProvider: process.env.LLM_PROVIDER || DEFAULT_PROVIDER,
    voiceId: process.env.VOICE_ID || DEFAULT_VOICE_ID,
    vadModelPath: process.env.VAD_MODEL_PATH,
    // Because the env variable is optional and it's a string, we need to convert it to a boolean safely
    graphVisualizationEnabled:
      (process.env.GRAPH_VISUALIZATION_ENABLED || '').toLowerCase().trim() ===
      'true',
  };
};

export const preparePrompt = async (
  promptTemplate: string,
  promptInput: PromptInput,
) => {
  return renderJinja(promptTemplate, getPromptData(promptInput));
};
