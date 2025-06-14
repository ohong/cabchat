import 'dotenv/config';

import { common, graph } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

const minimist = require('minimist');

const { InworldError } = common;
const { Graph, CustomNode, CustomInputDataType, CustomOutputDataType } = graph;

class ReverseTextNode extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process(inputs: string[]) {
    return inputs[0].split('').reverse().join('');
  }
}

const usage = `
Usage:
    yarn node-custom-reverse "Hello, world"
Description:
    This example demonstrates how to create a custom node that reverses a string.
    The node is synchronous and will return the reversed string immediately.
`;

run();

async function run() {
  const { prompt } = parseArgs();

  const customNode = new ReverseTextNode(v4()).build();
  const graph = new Graph(v4());
  graph.addNode(customNode);
  graph.setStartNode(customNode);
  graph.setEndNode(customNode);

  const outputStream = await graph.execute(prompt, v4());
  const result = (await outputStream.next()).data;

  console.log(`Reversed text: ${result}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  customNode.destroy();
}

function parseArgs(): {
  prompt: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const prompt = argv._?.join(' ') || '';

  if (!prompt) {
    console.error('No string provided');
    console.log(usage);
    process.exit(1);
  }

  return { prompt };
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
