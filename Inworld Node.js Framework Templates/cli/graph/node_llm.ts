import 'dotenv/config';

import { common, graph, telemetry } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';
const minimist = require('minimist');
import { DEFAULT_LLM_MODEL_NAME, TEXT_CONFIG } from '../constants';
const { InworldError } = common;
const { Graph, NodeFactory } = graph;

const usage = `
Usage:
    yarn node-llm "Hello, how are you?" \n
    --modelName=<model-name>[optional, default=${DEFAULT_LLM_MODEL_NAME}] \n
    --provider=<service-provider>[optional, default=inworld]`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs();

  // Initialize telemetry
  telemetry.init({
    appName: 'NodeLLMTemplate',
    appVersion: '1.0.0',
    apiKey,
  });

  const llmNode = await NodeFactory.createRemoteLLMNode({
    id: v4(),
    llmConfig: { provider, modelName, apiKey },
    executionConfig: {
      textGenerationConfig: TEXT_CONFIG,
    },
    stream: true,
  });

  const graph = new Graph(v4());
  graph.addNode(llmNode);
  graph.setStartNode(llmNode);
  graph.setEndNode(llmNode);

  const outputStream = await graph.execute(
    [
      {
        role: 'user',
        content: prompt,
      },
    ],
    'Conversation Graph',
  );
  const textStream = (await outputStream.next()).data as any;

  let result = '';
  let resultCount = 0;

  let chunk = await textStream.next();

  while (!chunk.done) {
    result += chunk.text;
    resultCount++;

    chunk = await textStream.next();
  }

  console.log(`Result count: ${resultCount}`);
  console.log(`Result: ${result}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  llmNode.destroy();
  telemetry.shutdown();
}

function parseArgs(): {
  prompt: string;
  modelName: string;
  provider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }
  const prompt = argv._?.join(' ') || '';
  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || 'inworld';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!prompt) {
    throw new Error(`You need to provide a prompt.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { prompt, modelName, provider, apiKey };
}

function done() {
  telemetry.shutdown();
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
  telemetry.shutdown();
  process.exit(1);
});
