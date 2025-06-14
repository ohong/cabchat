import 'dotenv/config';

import { common, core, primitives } from '@inworld/framework-nodejs';

import { DEFAULT_LLM_MODEL_NAME, Modes, TEXT_CONFIG } from '../constants';

const minimist = require('minimist');
const { LLMFactory } = primitives.llm;
const { DeviceRegistry, DeviceType } = core;
const { InworldError } = common;

const usage = `
Usage:
    yarn basic-llm "Hello, how are you?" \n
    --mode=remote|local[optional, default=remote] \n
    --modelPath=<path-to-model>[optional, required for local mode] \n
    --modelName=<model-name>[optional, required for remote mode, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=inworld]`;

run();

async function run() {
  const { mode, prompt, modelPath, modelName, provider, apiKey } = parseArgs();

  let llm;

  if (mode === Modes.LOCAL) {
    const found = DeviceRegistry.getAvailableDevices().find(
      (d) => d.getType() === DeviceType.CUDA,
    );
    llm = await LLMFactory.createLocal({ modelPath, device: found });
  } else {
    llm = await LLMFactory.createRemote({ provider, modelName, apiKey });
  }

  const messages = [
    {
      role: 'user',
      content: prompt,
    },
  ];

  const response = await llm.generateText({ messages, config: TEXT_CONFIG });

  let responseText = '';
  let chunk = await response.next();

  while (!chunk.done) {
    responseText += chunk.text;
    chunk = await response.next();
  }

  console.log(`Response: ${responseText}`);

  llm.destroy();
}

function parseArgs(): {
  prompt: string;
  mode: Modes;
  modelPath: string;
  modelName: string;
  provider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode === Modes.LOCAL ? Modes.LOCAL : Modes.REMOTE;
  const prompt = argv._?.join(' ') || '';
  const modelPath = argv.modelPath || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || 'inworld';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  if (mode === Modes.REMOTE) {
    if (!apiKey) {
      throw new Error(
        `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      );
    }
  } else if (!modelPath) {
    throw new Error(
      `You need to specify a model path for local mode.\n${usage}`,
    );
  }

  return { prompt, mode, modelPath, modelName, provider, apiKey };
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
