import 'dotenv/config';

import { common, core, primitives } from '@inworld/framework-nodejs';

import {
  DEFAULT_EMBEDDER_MODEL_NAME,
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  TEXT_CONFIG,
} from '../constants';

const minimist = require('minimist');
const { TextEmbedderFactory } = primitives.embedder;
const { History } = core;
const { LLMFactory } = primitives.llm;
const { MemoryFactory, MemorySnapshot } = primitives.memory;
const { InworldError } = common;

const usage = `
Usage:
    yarn basic-memory \n
    --promptTemplate=<prompt-template>[optional, default is 'memory/rolling_summary.jinja'] \n
    --modelNameLLM=<model-name>[optional, used for remote LLM, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --modelNameEmbedder=<model-name>[optional, used for remote embedding, default=${DEFAULT_EMBEDDER_MODEL_NAME}] \n
    --provider=<service-provider>[optional, used for remote embedding, default=${DEFAULT_PROVIDER}]`;

const events = [
  {
    name: 'Mike',
    utterance: 'Hello, how are you?',
  },
  {
    name: 'Jack',
    utterance: "Hi, I'm good, tell me about your dog.",
  },
  {
    name: 'Mike',
    utterance: 'I have a dog, his name is Max.',
  },
  {
    name: 'Jack',
    utterance: 'Nice, what color is he?',
  },
];

run();

async function run() {
  const { modelNameLLM, modelNameEmbedder, provider, apiKey } = parseArgs();

  const embedder = await TextEmbedderFactory.createRemote({
    modelName: modelNameEmbedder,
    provider,
    apiKey,
  });
  const llm = await LLMFactory.createRemote({
    modelName: modelNameLLM,
    provider,
    apiKey,
  });
  const history = new History(events);
  const rollingSummaryConfig = {
    textGenerationConfig: TEXT_CONFIG,
  };
  const flashMemoryConfig = {
    nHistoryTurns: 10,
    textGenerationConfig: TEXT_CONFIG,
  };
  const longTermMemoryConfig = {
    textGenerationConfig: TEXT_CONFIG,
  };

  // Create memory factory and memory instance
  const memoryFactory = new MemoryFactory();
  const memory = await memoryFactory.createMemory({
    llm,
    embedder,
    rollingSummary: rollingSummaryConfig,
    flashMemory: flashMemoryConfig,
    longTermMemory: longTermMemoryConfig,
    returnRollingSummary: true,
  });

  const memorySnapshot = new MemorySnapshot({
    rollingSummary: {
      turnsSinceLastUpdate: 8,
      summarizedText: '',
    },
  });

  console.log('Updating memory with events...');
  const updatedSnapshot = await memory.update(history, memorySnapshot);
  console.log('Memory updated successfully');

  console.log('Retrieving memory...');
  const retrievedMemories = await memory.get(history, updatedSnapshot);

  console.log('Retrieved memories:');
  for (const memory of retrievedMemories) {
    console.log(`- ${memory}`);
  }

  embedder.destroy();
  llm.destroy();
  history.destroy();
  memorySnapshot.destroy();
  updatedSnapshot.destroy();
  memory.destroy();
  done();
}

function parseArgs(): {
  apiKey: string;
  modelNameLLM: string;
  modelNameEmbedder: string;
  provider: string;
  promptTemplate: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const apiKey = process.env.INWORLD_API_KEY || '';
  const provider = argv.provider || DEFAULT_PROVIDER;
  const modelNameLLM = argv.modelNameLLM || DEFAULT_LLM_MODEL_NAME;
  const modelNameEmbedder =
    argv.modelNameEmbedder || DEFAULT_EMBEDDER_MODEL_NAME;
  const promptTemplate =
    argv.promptTemplate ||
    `${__dirname}/../prompts/memory/rolling_summary.jinja`;

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { apiKey, modelNameLLM, modelNameEmbedder, provider, promptTemplate };
}

function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', (err: Error) => {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: err.context,
    });
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
