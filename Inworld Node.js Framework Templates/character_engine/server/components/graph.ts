import { graph, NodeInterface, primitives } from '@inworld/framework-nodejs';
import * as os from 'os';
import * as path from 'path';

import { TEXT_CONFIG } from '../../constants';
import { CreateGraphPropsInterface } from '../types';
import {
  AudioFilterNode,
  AudioInputNode,
  DialogPromptBuilderNode,
  TextInputNode,
  UpdateStateNode,
} from './nodes';

const { Graph, NodeFactory } = graph;
const { SpeechSynthesisConfig } = primitives.tts;

const synthesisConfig = SpeechSynthesisConfig.getDefault();

export class InworldGraph {
  graph: InstanceType<typeof Graph>;
  nodes: NodeInterface[];

  private constructor({
    graph,
    nodes,
  }: {
    graph: InstanceType<typeof Graph>;
    nodes: NodeInterface[];
  }) {
    this.graph = graph;
    this.nodes = nodes;
  }

  destroy() {
    this.graph.destroy();
    this.nodes.forEach((node) => node.destroy());
  }

  static async create(props: CreateGraphPropsInterface) {
    const {
      apiKey,
      llmModelName,
      llmProvider,
      voiceId,
      dialogPromptTemplate,
      connections,
      withAudioInput = false,
    } = props;

    const nodes: NodeInterface[] = [];
    const postfix = withAudioInput ? 'WithAudioInput' : 'WithTextInput';

    const dialogPromptBuilderNode = new DialogPromptBuilderNode(
      `DialogPromptBuilderNode${postfix}`,
      dialogPromptTemplate,
    ).build();

    const updateStateNode = new UpdateStateNode(
      `UpdateStateNode${postfix}`,
      connections,
    ).build();

    const llmNode = await NodeFactory.createRemoteLLMNode({
      id: `LLMNode${postfix}`,
      llmConfig: { modelName: llmModelName, provider: llmProvider, apiKey },
      executionConfig: {
        textGenerationConfig: TEXT_CONFIG,
      },
      stream: true,
    });

    const textChunkingNode = NodeFactory.createTextChunkingNode({
      id: `TextChunkingNode${postfix}`,
    });

    const ttsNode = await NodeFactory.createRemoteTTSNode({
      id: `TTSNode${postfix}`,
      ttsConfig: {
        apiKey,
        synthesisConfig,
      },
      executionConfig: {
        speakerId: voiceId,
        synthesisConfig,
      },
    });

    const graphName = `CharacterEngine${postfix}`;
    const graph = new Graph(graphName);

    graph.addNode(updateStateNode);
    graph.addNode(dialogPromptBuilderNode);
    graph.addNode(llmNode);
    graph.addNode(textChunkingNode);
    graph.addNode(ttsNode);
    graph.addEdge(updateStateNode, dialogPromptBuilderNode);
    graph.addEdge(dialogPromptBuilderNode, llmNode);
    graph.addEdge(llmNode, textChunkingNode);
    graph.addEdge(textChunkingNode, ttsNode);

    if (withAudioInput) {
      const audioInputNode = new AudioInputNode(
        `AudioInputNode${postfix}`,
      ).build();
      const textInputNode = new TextInputNode(
        `TextInputNode${postfix}`,
      ).build();
      const audioFilterNode = new AudioFilterNode(
        `AudioFilterNode${postfix}`,
      ).build();
      const sttNode = await NodeFactory.createRemoteSTTNode({
        id: `STTNode${postfix}`,
        sttConfig: { apiKey },
      });

      graph.addNode(audioInputNode);
      graph.addNode(audioFilterNode);
      graph.addNode(sttNode);
      graph.addNode(textInputNode);
      graph.addEdge(audioInputNode, textInputNode);
      graph.addEdge(audioInputNode, audioFilterNode);
      graph.addEdge(audioFilterNode, sttNode);
      graph.addEdge(sttNode, textInputNode);
      graph.addEdge(textInputNode, updateStateNode);
      graph.setStartNode(audioInputNode);

      nodes.push(audioInputNode, textInputNode, audioFilterNode, sttNode);
    } else {
      graph.setStartNode(updateStateNode);
    }

    graph.setEndNode(ttsNode);

    if (props.graphVisualizationEnabled) {
      const graphPath = path.join(os.tmpdir(), `${graphName}.png`);

      await graph.visualize(graphPath);

      console.log(`Graph ${graphName} saved to ${graphPath}`);
    }

    return new InworldGraph({
      graph,
      nodes: [
        ...nodes,
        updateStateNode,
        dialogPromptBuilderNode,
        llmNode,
        textChunkingNode,
        ttsNode,
      ],
    });
  }
}
