import 'dotenv/config';

import {
  AudioResponse,
  common,
  graph,
  primitives,
  TTSOutputStreamIterator,
} from '@inworld/framework-nodejs';
import * as fs from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');

const { InworldError } = common;
const { Graph, NodeFactory } = graph;
const { SpeechSynthesisConfig } = primitives.tts;
import {
  DEFAULT_TTS_MODEL_ID,
  DEFAULT_VOICE_ID,
  SAMPLE_RATE,
} from '../constants';

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  '..',
  'data-output',
  'tts_samples',
);
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'node_tts_output.wav');

const usage = `
Usage:
    yarn node-tts "Hello, how are you?" \n
    --modelId=<model-id>[optional, ${DEFAULT_TTS_MODEL_ID} will be used by default] \n
    --voiceName=<voice-id>[optional, ${DEFAULT_VOICE_ID} will be used by default]`;

run();

async function run() {
  const { text, modelId, voiceName, apiKey } = parseArgs();

  const synthesisConfig = {
    ...SpeechSynthesisConfig.getDefault(),
    ...(modelId && { modelId }),
  };
  const ttsNode = await NodeFactory.createRemoteTTSNode({
    id: 'tts-node',
    ttsConfig: {
      apiKey,
      synthesisConfig,
    },
    executionConfig: {
      speakerId: voiceName,
      synthesisConfig,
    },
  });

  const graph = new Graph(v4());
  graph.addNode(ttsNode);
  graph.setStartNode(ttsNode);
  graph.setEndNode(ttsNode);

  const outputStream = await graph.execute(text, v4());
  const ttsStream = (await outputStream.next()).data as TTSOutputStreamIterator;

  let initialText = '';
  let resultCount = 0;
  let allAudioData: number[] = [];

  let chunk: AudioResponse = await ttsStream.next();

  while (!chunk.done) {
    initialText += chunk.text;
    allAudioData = allAudioData.concat(Array.from(chunk.audio.data));
    resultCount++;

    chunk = await ttsStream.next();
  }

  console.log(`Result count: ${resultCount}`);
  console.log(`Initial text: ${initialText}`);

  // Create a single audio object with all the data
  const audio = {
    sampleRate: SAMPLE_RATE, // default sample rate
    channelData: [new Float32Array(allAudioData)],
  };

  // Encode and write all the audio data to a single file
  const buffer = await wavEncoder.encode(audio);
  if (!fs.existsSync(OUTPUT_DIRECTORY)) {
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, Buffer.from(buffer));

  console.log(`Audio saved to ${OUTPUT_PATH}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  ttsNode.destroy();
}

function parseArgs(): {
  text: string;
  modelId: string;
  voiceName: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const text = argv._?.join(' ') || '';
  const modelId = argv.modelId || DEFAULT_TTS_MODEL_ID;
  const voiceName = argv.voiceName || DEFAULT_VOICE_ID;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text.\n${usage}`);
  }

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { text, modelId, voiceName, apiKey };
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
