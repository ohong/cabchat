import 'dotenv/config';

import { common, graph, TextStreamIterator } from '@inworld/framework-nodejs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';
const minimist = require('minimist');
const { InworldError } = common;
const { Graph, NodeFactory } = graph;

const usage = `
Usage:
    yarn node-text-chunking "This is a long text that needs to be chunked" \n
    OR \n
    yarn node-text-chunking --file=path/to/your/text/file.txt`;

run();

async function run() {
  const { text } = parseArgs();

  // Create a text chunking node
  const textChunkingNode = NodeFactory.createTextChunkingNode({
    id: v4(),
  });

  // Create and set up the graph
  const graph = new Graph(v4());
  graph.addNode(textChunkingNode);
  graph.setStartNode(textChunkingNode);
  graph.setEndNode(textChunkingNode);

  // Create input text data and execute
  const outputStream = await graph.execute(text, v4());
  const textStream = (await outputStream.next()).data as TextStreamIterator;

  // Process the results
  let chunk = await textStream.next();
  let resultCount = 0;
  const chunks: string[] = [];

  while (!chunk.done) {
    chunks.push(chunk.text);
    resultCount++;
    chunk = await textStream.next();
  }

  // Output results
  console.log(`Input text length: ${text.length} characters`);
  console.log(`Number of chunks: ${resultCount}`);
  console.log('Chunks:');
  chunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1} (${chunk.length} characters):`);
    console.log(chunk);
  });

  // Cleanup
  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  textChunkingNode.destroy();
}

function parseArgs(): {
  text: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  let text = '';

  if (argv.file) {
    const filePath = path.resolve(argv.file);
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      text = fs.readFileSync(filePath, 'utf-8');
      console.log(`Reading input from file: ${filePath}`);
    } catch (error) {
      throw new Error(`Error reading file: ${error.message}\n${usage}`);
    }
  } else {
    // If no text is provided, use a sample text to demonstrate chunking
    text =
      argv._?.join(' ') ||
      'This is a sample sentence. Here is another one! And a third one? Finally, the last sentence.';
  }

  if (!text) {
    throw new Error(
      `You need to provide text to chunk or a file path.\n${usage}`,
    );
  }

  return { text };
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
