import 'dotenv/config';

import { common, graph, primitives } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

import {
  DEFAULT_EMBEDDER_MODEL_NAME,
  DEFAULT_LLM_MODEL_NAME,
  DEFAULT_PROVIDER,
  INTENTS,
} from '../../constants';

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

const {
  CustomNode,
  CustomInputDataType,
  CustomOutputDataType,
  Graph,
  NodeFactory,
} = graph;

class CustomNode1 extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process() {
    return 'It is a greeting';
  }
}

class CustomNode2 extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process() {
    return 'It is a farewell';
  }
}

const usage = `
Usage:
    yarn conditional-edges-after-intent "Hello" \n
    --embedder-modelName=<model-name>[optional, used for embedding, default=${DEFAULT_EMBEDDER_MODEL_NAME}] \n
    --embedder-provider=<service-provider>[optional, used for embedding, default=${DEFAULT_PROVIDER}] \n
    --llm-modelName=<model-name>[optional, used for embedding, default=${DEFAULT_EMBEDDER_MODEL_NAME}] \n
    --llm-provider=<service-provider>[optional, used for embedding, default=${DEFAULT_PROVIDER}]
Description:
    This example demonstrates how to create a graph with conditional edges.
    It will detect intents in the input text and route the execution to different custom nodes based on the detected intent.`;

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
    id: 'intent-node',
    executionConfig: {
      reportToClient: true,
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
  const customNode1 = new CustomNode1('custom-node-1').build();
  const customNode2 = new CustomNode2('custom-node-2').build();
  const graph = new Graph(v4());
  graph.addNode(intentNode);
  graph.addNode(customNode1);
  graph.addNode(customNode2);
  graph.addEdge(intentNode, customNode1, {
    condition: (input: string) =>
      (input &&
        JSON.parse(input)?.intent_matches?.[0]?.intent_name === 'greeting') ??
      false,
  });
  graph.addEdge(intentNode, customNode2, {
    condition: (input: string) =>
      (input &&
        JSON.parse(input)?.intent_matches?.[0]?.intent_name === 'farewell') ??
      false,
  });
  graph.setStartNode(intentNode);
  graph.setEndNode(customNode1);
  graph.setEndNode(customNode2);

  const outputStream = await graph.execute(text, v4());
  const intentResult = (await outputStream.next()).data as string;
  const customNodeResult = (await outputStream.next()).data as string;

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  intentNode.destroy();
  customNode1.destroy();
  customNode2.destroy();
  llm.destroy();
  textEmbedder.destroy();

  console.log(`Intent result: ${intentResult}`);
  console.log(`Custom node result: ${customNodeResult}`);
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
