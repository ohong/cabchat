import 'dotenv/config';

import * as fs from 'fs';
const WavDecoder = require('wav-decoder');

import { common, graph } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';
const minimist = require('minimist');

const { InworldError } = common;
const { Graph, NodeFactory } = graph;

const usage = `
Usage:
    yarn node-stt \n
    --audioFilePath=<path-to-audio-file>[required, expected to be wav format]`;

run();

async function run() {
  const { audioFilePath, apiKey } = parseArgs();

  const audioData = await WavDecoder.decode(fs.readFileSync(audioFilePath));
  const sttNode = await NodeFactory.createRemoteSTTNode({
    id: v4(),
    sttConfig: { apiKey },
  });
  const graph = new Graph(v4());

  graph.addNode(sttNode);
  graph.setStartNode(sttNode);
  graph.setEndNode(sttNode);

  const outputStream = await graph.execute(
    {
      data: audioData.channelData[0],
      sampleRate: audioData.sampleRate,
    },
    v4(),
  );

  let result = '';
  let resultCount = 0;
  let chunk = await outputStream.next();

  while (!chunk.done) {
    result += chunk.data;
    resultCount++;

    chunk = await outputStream.next();
  }

  console.log(`Result count: ${resultCount}`);
  console.log(`Result: ${result}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  sttNode.destroy();
}

function parseArgs(): {
  audioFilePath: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const audioFilePath = argv.audioFilePath || '';
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!audioFilePath) {
    throw new Error(`You need to provide a audioFilePath.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { audioFilePath, apiKey };
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
      stack: err.stack,
    });
  } else {
    console.error(err);
  }
  process.exit(1);
});
