import 'dotenv/config';

import { common, graph, TextStreamIterator } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

import { DEFAULT_LLM_MODEL_NAME, TEXT_CONFIG } from '../constants';

const minimist = require('minimist');

const { InworldError } = common;
const {
  Graph,
  CustomNode,
  CustomInputDataType,
  CustomOutputDataType,
  NodeFactory,
} = graph;

class CustomStreamReader extends CustomNode {
  input = CustomInputDataType.TEXT_STREAM;
  output = CustomOutputDataType.TEXT;

  async process(inputs: [TextStreamIterator]) {
    const textStream = inputs[0];

    let result = '';
    let chunk = await textStream.next();

    while (!chunk.done) {
      result += chunk.text;
      chunk = await textStream.next();
    }

    return result;
  }
}

const usage = `
Usage:
    yarn node-custom-llm-stream "Hello, world"
Description:
    This example demonstrates how to create a custom node that streams a LLM response.
    The node is asynchronous and will return the LLM response.
`;

run();

async function run() {
  const { prompt, modelName, provider, apiKey } = parseArgs();

  const llmNode = await NodeFactory.createRemoteLLMNode({
    id: 'llm-node',
    llmConfig: { provider, modelName, apiKey },
    executionConfig: {
      textGenerationConfig: TEXT_CONFIG,
    },
    stream: true,
  });
  const customNode = new CustomStreamReader('custom-node').build();
  const graph = new Graph(v4());
  graph.addNode(llmNode);
  graph.addNode(customNode);
  graph.addEdge(llmNode, customNode);
  graph.setStartNode(llmNode);
  graph.setEndNode(customNode);

  const outputStream = await graph.execute(
    [
      {
        role: 'user',
        content: prompt,
      },
    ],
    v4(),
  );
  const result = (await outputStream.next()).data;

  console.log(`LLM stream result: ${result}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  llmNode.destroy();
  customNode.destroy();
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
    console.error(err);
  }
  process.exit(1);
});
