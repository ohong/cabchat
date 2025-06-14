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
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'node_custom_tts_output.wav');

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');

const { InworldError } = common;
const {
  Graph,
  CustomNode,
  CustomInputDataType,
  CustomOutputDataType,
  NodeFactory,
} = graph;

const { SpeechSynthesisConfig } = primitives.tts;

class CustomStreamReader extends CustomNode {
  input = CustomInputDataType.TTS_STREAM;
  output = CustomOutputDataType.JSON;

  async process(inputs: [TTSOutputStreamIterator]) {
    const ttsStream = inputs[0];

    let initialText = '';
    let allAudioData: number[] = [];

    let chunk: AudioResponse = await ttsStream.next();

    while (!chunk.done) {
      initialText += chunk.text;
      allAudioData = allAudioData.concat(Array.from(chunk.audio.data));
      chunk = await ttsStream.next();
    }

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

    return { initialText, audio: OUTPUT_PATH };
  }
}

const usage = `
Usage:
    yarn node-custom-tts-stream "Hello, how are you?" \n
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
    id: v4(),
    ttsConfig: {
      apiKey,
      synthesisConfig,
    },
    executionConfig: {
      speakerId: voiceName,
      synthesisConfig,
    },
  });
  const customNode = new CustomStreamReader('custom-node').build();
  const graph = new Graph(v4());
  graph.addNode(ttsNode);
  graph.addNode(customNode);
  graph.addEdge(ttsNode, customNode);
  graph.setStartNode(ttsNode);
  graph.setEndNode(customNode);

  const outputStream = await graph.execute(text, v4());
  const result = (await outputStream.next()).data as string;
  const { initialText, audio } = JSON.parse(result);

  console.log(`TTS initial text: ${initialText}`);
  console.log(`TTS stream audio: ${audio}`);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  ttsNode.destroy();
  customNode.destroy();
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
    });
  } else {
    console.error(err);
  }
  process.exit(1);
});
