import 'dotenv/config';

import { common, graph } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

import { DEFAULT_LLM_MODEL_NAME, TEXT_CONFIG } from '../../constants';

const minimist = require('minimist');

const { InworldError } = common;
const {
  Graph,
  CustomNode,
  CustomInputDataType,
  CustomOutputDataType,
  NodeFactory,
} = graph;

class CustomNode1 extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process(inputs: string[]) {
    const result = Number(inputs[0]);

    return `Generated number is greater than 50: ${result}`;
  }
}

class CustomNode2 extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process(inputs: string[]) {
    const result = Number(inputs[0]);

    return `Generated number is less or equal to 50: ${result}`;
  }
}

const prompt = `
Generate a random number between 1 and 100.

# OUTPUT FORMAT
Output *ONLY* the single numeric. Do *NOT* include *ANY* other text, formatting, spaces, or special tokens (like <|eot>). The output must be exactly one number and nothing else.
`;

const usage = `
Usage:
    yarn conditional-edges-after-llm
Description:
    This example demonstrates how to create a graph with conditional edges.
    It will generate a random number between 1 and 100.
    If the number is greater than 50, it will go to the custom node 1.
    If the number is less or equal to 50, it will go to the custom node 2.
`;

run();

async function run() {
  const { modelName, provider, apiKey } = parseArgs();

  const llmNode = await NodeFactory.createRemoteLLMNode({
    id: 'llm-node',
    llmConfig: { provider, modelName, apiKey },
    executionConfig: {
      textGenerationConfig: TEXT_CONFIG,
      reportToClient: true,
    },
  });
  const customNode1 = new CustomNode1('custom-node-1').build();
  const customNode2 = new CustomNode2('custom-node-2').build();
  const graph = new Graph(v4());
  graph.addNode(llmNode);
  graph.addNode(customNode1);
  graph.addNode(customNode2);
  graph.addEdge(llmNode, customNode1, {
    condition: (input: string) => Number(input) > 50,
  });
  graph.addEdge(llmNode, customNode2, {
    condition: (input: string) => Number(input) <= 50,
  });
  graph.setStartNode(llmNode);
  graph.setEndNode(customNode1);
  graph.setEndNode(customNode2);

  const outputStream = await graph.execute(
    [
      {
        role: 'user',
        content: prompt,
      },
    ],
    v4(),
  );
  const llmResult = (await outputStream.next()).data;
  console.log(`LLM result: ${llmResult}`);

  const customNodeResult = (await outputStream.next()).data;
  console.log(`Custom node result: ${customNodeResult}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  llmNode.destroy();
  customNode1.destroy();
  customNode2.destroy();
}

function parseArgs(): {
  modelName: string;
  provider: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const modelName = argv.modelName || DEFAULT_LLM_MODEL_NAME;
  const provider = argv.provider || 'inworld';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { modelName, provider, apiKey };
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
