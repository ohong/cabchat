import { TTSOutputStreamIterator } from '@inworld/framework-nodejs';
import { v4 } from 'uuid';
import { RawData } from 'ws';

const WavEncoder = require('wav-encoder');

import {
  FRAME_PER_BUFFER,
  PAUSE_DURATION_THRESHOLD,
  SAMPLE_RATE,
} from '../../constants';
import {
  AudioInput,
  ChatMessage,
  EVENT_TYPE,
  State,
  TextInput,
} from '../types';
import { InworldApp } from './app';
import { EventFactory } from './event_factory';
import { InworldGraph } from './graph';

export class MessageHandler {
  private SAMPLE_RATE = SAMPLE_RATE;
  private FRAME_PER_BUFFER = FRAME_PER_BUFFER;
  private PAUSE_DURATION_THRESHOLD = PAUSE_DURATION_THRESHOLD;

  private pauseDuration = 0;
  private isCapturingSpeech = false;
  private speechBuffer: number[] = [];

  constructor(
    private inworldApp: InworldApp,
    private send: (data: any) => void,
  ) {}

  async handleMessage(data: RawData, key: string) {
    const message = JSON.parse(data.toString());
    const interactionId = v4();

    switch (message.type) {
      case EVENT_TYPE.TEXT:
        let input = JSON.stringify({
          text: message.text,
          interactionId,
          key,
        } as TextInput);

        await this.executeGraph({
          key,
          input,
          interactionId,
          graph: this.inworldApp.graphWithTextInput,
        });

        break;

      case EVENT_TYPE.AUDIO:
        const audioBuffer: any[] = [];
        for (let i = 0; i < message.audio.length; i++) {
          Object.values(message.audio[i]).forEach((value) => {
            audioBuffer.push(value);
          });
        }

        if (audioBuffer.length >= this.FRAME_PER_BUFFER) {
          const audioChunk = {
            data: this.normalizeAudio(audioBuffer),
            sampleRate: this.SAMPLE_RATE,
          };
          const vadResult =
            await this.inworldApp.vadClient.detectVoiceActivity(audioChunk);

          if (vadResult !== -1) {
            if (!this.isCapturingSpeech) {
              this.isCapturingSpeech = true;
            }

            this.speechBuffer.push(...audioChunk.data);
            this.pauseDuration = 0;
          } else if (this.isCapturingSpeech) {
            this.pauseDuration +=
              (audioChunk.data.length * 2000) / this.SAMPLE_RATE;
            if (this.pauseDuration > this.PAUSE_DURATION_THRESHOLD) {
              this.isCapturingSpeech = false;

              await this.processCapturedSpeech(key, interactionId);
            }
          }
        }
        break;

      case EVENT_TYPE.AUDIO_SESSION_END:
        this.pauseDuration = 0;
        this.isCapturingSpeech = false;

        if (this.speechBuffer.length > 0) {
          await this.processCapturedSpeech(key, interactionId);
        }

        break;
    }
  }

  private normalizeAudio(audioBuffer: number[]): number[] {
    let maxVal = 0;
    // Find maximum absolute value
    for (let i = 0; i < audioBuffer.length; i++) {
      maxVal = Math.max(maxVal, Math.abs(audioBuffer[i]));
    }

    if (maxVal === 0) {
      return audioBuffer;
    }

    // Create normalized copy
    const normalizedBuffer = [];
    for (let i = 0; i < audioBuffer.length; i++) {
      normalizedBuffer.push(audioBuffer[i] / maxVal);
    }

    return normalizedBuffer;
  }

  private async processCapturedSpeech(key: string, interactionId: string) {
    let input: string | null = null;

    try {
      input = JSON.stringify({
        audio: {
          data: this.speechBuffer,
          sampleRate: this.SAMPLE_RATE,
        },
        interactionId,
        key,
      } as AudioInput);

      this.speechBuffer = [];

      await this.executeGraph({
        key,
        input,
        interactionId,
        graph: this.inworldApp.graphWithAudioInput,
      });
    } catch (error) {
      console.error('Error processing captured speech:', error.message);
    }
  }

  private async executeGraph({
    key,
    input,
    interactionId,
    graph,
  }: {
    key: string;
    input: string;
    interactionId: string;
    graph: InworldGraph;
  }) {
    const outputStream = await graph.graph.execute(input, v4());

    await this.handleResponse(
      outputStream,
      interactionId,
      this.inworldApp.connections[key].state,
    );

    this.send(EventFactory.interactionEnd(interactionId));

    graph.graph.closeExecution(outputStream);
  }

  private async handleResponse(
    outputStream: any,
    interactionId: string,
    state: State,
  ) {
    const responseMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      id: interactionId,
    };

    try {
      const ttsStream = (await outputStream.next())
        .data as TTSOutputStreamIterator;

      if (ttsStream?.next) {
        let chunk = await ttsStream.next();

        while (!chunk.done) {
          responseMessage.content += chunk.text;

          const audioBuffer = await WavEncoder.encode({
            sampleRate: chunk.audio.sampleRate,
            channelData: [new Float32Array(chunk.audio.data)],
          });

          const textPacket = EventFactory.text(chunk.text, interactionId, {
            isAgent: true,
            name: state.agent.id,
          });

          this.send(textPacket);
          this.send(
            EventFactory.audio(
              Buffer.from(audioBuffer).toString('base64'),
              interactionId,
              textPacket.packetId.utteranceId,
            ),
          );

          // Update the message content.
          const message = state.messages.find(
            (m) => m.id === interactionId && m.role === 'assistant',
          );
          if (message) {
            message.content = responseMessage.content;
          } else {
            state.messages.push(responseMessage);
          }

          chunk = await ttsStream.next();
        }
      }
    } catch (error) {
      console.error(error);
      const errorPacket = EventFactory.error(error, interactionId);
      this.send(errorPacket);
    }
  }
}
