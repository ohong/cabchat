import 'dotenv/config';

import { common, graph, primitives } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

import {
  DEFAULT_EMBEDDER_MODEL_NAME,
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  INTENTS,
} from '../constants';

const minimist = require('minimist');

const { InworldError } = common;
const { TextEmbedderFactory } = primitives.embedder;
const { LLMFactory } = primitives.llm;
const {
  Intent,
  IntentCompilerFactory,
  EmbeddingMatcherConfig,
  LLMMatcherConfig,
} = primitives.intent;

const { Graph, NodeFactory } = graph;

const usage = `
Usage (Matches input text against hardcoded intents):
    yarn node-intent "hello" \n
    --embedder-modelName=<model-name>[optional, used for embedding, default=${DEFAULT_EMBEDDER_MODEL_NAME}] \n
    --embedder-provider=<service-provider>[optional, used for embedding, default=${DEFAULT_PROVIDER}] \n
    --llm-modelName=<model-name>[optional, used for embedding, default=${DEFAULT_EMBEDDER_MODEL_NAME}] \n
    --llm-provider=<service-provider>[optional, used for embedding, default=${DEFAULT_PROVIDER}]`;

run();

async function run() {
  const {
    text,
    embedderModelName,
    embedderProvider,
    llmModelName,
    llmProvider,
    apiKey,
  } = parseArgs();

  const textEmbedder = await TextEmbedderFactory.createRemote({
    modelName: embedderModelName,
    provider: embedderProvider,
    apiKey,
  });

  const llm = await LLMFactory.createRemote({
    modelName: llmModelName,
    provider: llmProvider,
    apiKey,
  });

  const intentObjects = INTENTS.map((intent) => new Intent(intent));
  const compiler = await IntentCompilerFactory.create(textEmbedder);
  const compiledIntents = await compiler.compileIntents(intentObjects);

  const intentNode = await NodeFactory.createIntentNode({
    id: v4(),
    executionConfig: {
      matcherConfig: {
        compiledIntents,
        topNIntents: 3,
        embeddingMatcherConfig: EmbeddingMatcherConfig.getDefaultValues(),
        llmMatcherConfig: LLMMatcherConfig.getDefaultValues(),
      },
    },
    textEmbedder,
    llm,
  });

  const graph = new Graph(v4());
  graph.addNode(intentNode);
  graph.setStartNode(intentNode);
  graph.setEndNode(intentNode);

  const outputStream = await graph.execute(text, v4());
  const result = (await outputStream.next()).data as string;

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  intentNode.destroy();
  llm.destroy();
  textEmbedder.destroy();

  const resultObject = JSON.parse(result);

  console.log(
    `Intent matching result: ${JSON.stringify(resultObject, null, 2)}`,
  );
}

function parseArgs(): {
  text: string;
  embedderModelName: string;
  embedderProvider: string;
  llmModelName: string;
  llmProvider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const text = argv._?.join(' ') || '';
  const embedderModelName =
    argv.embedderModelName || DEFAULT_EMBEDDER_MODEL_NAME;
  const embedderProvider = argv.embedderProvider || DEFAULT_PROVIDER;
  const llmModelName = argv.llmModelName || DEFAULT_LLM_MODEL_NAME;
  const llmProvider = argv.llmProvider || DEFAULT_PROVIDER;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(`You need to set INWORLD_API_KEY environment variable.`);
  }

  return {
    text,
    embedderModelName,
    embedderProvider,
    llmModelName,
    llmProvider,
    apiKey,
  };
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
