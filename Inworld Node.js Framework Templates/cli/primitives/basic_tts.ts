import 'dotenv/config';

import { common, device, primitives } from '@inworld/framework-nodejs';
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_VOICE_ID, Modes, SAMPLE_RATE } from '../constants';

const minimist = require('minimist');
const wavEncoder = require('wav-encoder');
const { TTSFactory, SpeechSynthesisConfig } = primitives.tts;
const { DeviceRegistry, DeviceType } = device;
const { InworldError } = common;

const usage = `
Usage:
    yarn basic-tts "Hello, how are you?" \n
    --mode=remote|local[optional, default=remote] \n
    --modelPath=<path-to-model>[optional, required for local mode] \n
    --promptsPath=<path-to-prompts-directory>[optional, required for local mode] \n
    --voiceName=<voice-id>[optional, used for remote mode, ${DEFAULT_VOICE_ID} will be used by default]`;

const OUTPUT_DIRECTORY = path.join(
  __dirname,
  '..',
  '..',
  'data-output',
  'tts_samples',
);
const OUTPUT_PATH = path.join(OUTPUT_DIRECTORY, 'basic_tts_output.wav');

run();

async function run() {
  const { mode, text, modelPath, promptsPath, voiceName, apiKey } = parseArgs();

  let tts;
  let speechSynthesisConfig = SpeechSynthesisConfig.getDefault();

  if (mode === Modes.LOCAL) {
    const found = DeviceRegistry.getAvailableDevices().find(
      (d) => d.getType() === DeviceType.CUDA,
    );

    tts = await TTSFactory.createLocal({
      modelPath,
      promptsPath,
      synthesisConfig: speechSynthesisConfig,
      device: found,
    });
  } else {
    tts = await TTSFactory.createRemote({
      apiKey,
      synthesisConfig: speechSynthesisConfig,
    });
  }

  const stream = await tts.synthesizeSpeech(voiceName, text);
  let allAudioData: number[] = [];
  let chunk = await stream.next();

  while (!chunk.done) {
    // Concatenate the audio data
    allAudioData = allAudioData.concat(Array.from(chunk.audio));
    chunk = await stream.next();
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

  console.log(`Audio saved to ${OUTPUT_PATH}`);

  tts.destroy();
}

function parseArgs(): {
  text: string;
  mode: Modes;
  modelPath: string;
  promptsPath: string;
  voiceName: string;
  apiKey: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const mode = argv.mode === Modes.LOCAL ? Modes.LOCAL : Modes.REMOTE;
  const text = argv._?.join(' ') || '';
  const modelPath = argv.modelPath || '';
  const promptsPath = argv.promptsPath || '';
  const voiceName = argv.voiceName || DEFAULT_VOICE_ID;
  const apiKey = process.env.INWORLD_API_KEY || '';

  if (!text) {
    throw new Error(`You need to provide text.\n${usage}`);
  }

  if (mode === Modes.REMOTE) {
    if (!apiKey) {
      throw new Error(
        `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
      );
    }
  } else if (!modelPath) {
    throw new Error(
      `You need to specify a model path for local mode.\n${usage}`,
    );
  }

  return { text, mode, modelPath, voiceName, promptsPath, apiKey };
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
