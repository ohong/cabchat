import 'dotenv/config';

import {
  common,
  graph,
  KnowledgeCreationConfig,
  primitives,
} from '@inworld/framework-nodejs';
import { v4 } from 'uuid';

import {
  DEFAULT_KNOWLEDGE_QUERY,
  DEFAULT_THRESHOLD,
  DEFAULT_TOP_K,
  KNOWLEDGE_COMPILE_CONFIG,
  KNOWLEDGE_RECORDS,
} from '../../constants';

const minimist = require('minimist');
const { KnowledgeFactory } = primitives.knowledge;
const { InworldError } = common;
const {
  NodeFactory,
  Graph,
  CustomNode,
  CustomInputDataType,
  CustomOutputDataType,
} = graph;
const usage = `
Usage:
    yarn conditional-edges-after-knowledge "${DEFAULT_KNOWLEDGE_QUERY}"\n
    --topK=<number>[optional, default=${DEFAULT_TOP_K}, maximum number of results to return] \n
    --threshold=<number>[optional, default=${DEFAULT_THRESHOLD}, similarity threshold for results] \n
Description:
    This example demonstrates how to create a graph with conditional edges.
    It will query a knowledge base and route the execution to different custom nodes based on the presence of records in the knowledge base.`;

run().catch(handleError);

class NodeStart extends CustomNode {
  input = CustomInputDataType.TEXT;
  output = CustomOutputDataType.TEXT;

  process(inputs: string[]) {
    return inputs[0];
  }
}

class NodeInput extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.TEXT;

  process(inputs: { query: string }[]) {
    return inputs[0].query;
  }
}

class NodeUserName extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.TEXT;

  process(inputs: { userName: string }[]) {
    return inputs[0].userName;
  }
}

class CustomNode1 extends CustomNode {
  input = CustomInputDataType.KNOWLEDGE_RECORDS;
  output = CustomOutputDataType.TEXT;

  process(inputs: string[]) {
    return `Records found: ${inputs.join(', ')}`;
  }
}

class CustomNode2 extends CustomNode {
  input = CustomInputDataType.KNOWLEDGE_RECORDS;
  output = CustomOutputDataType.TEXT;

  process() {
    return 'No records found';
  }
}

async function run() {
  const { apiKey, topK, threshold, query } = parseArgs();

  const knowledgeId = `knowledge/${v4()}`;
  const config: KnowledgeCreationConfig = {
    type: 'remote',
    config: {
      knowledgeCompileConfig: KNOWLEDGE_COMPILE_CONFIG,
      knowledgeGetConfig: {
        retrievalConfig: {
          topK,
          threshold,
        },
      },
      apiKey,
    },
  };

  const knowledge = await KnowledgeFactory.create(config);
  await knowledge.compileKnowledge(knowledgeId, KNOWLEDGE_RECORDS);
  const nodeStart = new NodeStart(v4()).build();
  const nodeInput = new NodeInput(v4()).build();
  const nodeUserName = new NodeUserName(v4()).build();
  const knowledgeNode = await NodeFactory.createRemoteKnowledgeNode({
    id: v4(),
    knowledge,
    ids: [knowledgeId],
  });
  const customNode1 = new CustomNode1(v4()).build();
  const customNode2 = new CustomNode2(v4()).build();

  const graph = new Graph(v4());
  graph.addNode(knowledgeNode);
  graph.addNode(nodeStart);
  graph.addNode(nodeInput);
  graph.addNode(nodeUserName);
  graph.setStartNode(nodeStart);
  graph.addEdge(nodeStart, nodeInput);
  graph.addEdge(nodeStart, nodeUserName);
  graph.addEdge(nodeInput, knowledgeNode);
  graph.addEdge(nodeUserName, knowledgeNode);
  graph.addEdge(knowledgeNode, customNode1, {
    condition: (input: string[]) => !!input?.length,
  });
  graph.addEdge(knowledgeNode, customNode2, {
    condition: (input: string[]) => !input?.length,
  });
  graph.setEndNode(customNode1);
  graph.setEndNode(customNode2);

  const outputStream = await graph.execute(
    JSON.stringify({
      query,
      userName: 'User Name',
    }),
    v4(),
  );

  const result = (await outputStream.next()).data as string[];

  console.log('Knowledge result:', result);

  await knowledge.removeKnowledge(knowledgeId);

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  knowledgeNode.destroy();
  customNode1.destroy();
  customNode2.destroy();
  nodeStart.destroy();
  nodeInput.destroy();
  nodeUserName.destroy();
  knowledge.destroy();
}

// Parse command line arguments
function parseArgs(): {
  apiKey: string;
  topK: number;
  threshold: number;
  query: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const query = argv._?.join(' ') || DEFAULT_KNOWLEDGE_QUERY;
  const apiKey = process.env.INWORLD_API_KEY || '';
  const topK = Number(argv.topK) || DEFAULT_TOP_K;
  const threshold = Number(argv.threshold) || DEFAULT_THRESHOLD;

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { apiKey, topK, threshold, query };
}

// Error handler
function handleError(err: Error) {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: (err as any).context,
    });
  } else {
    console.error(err.message);
  }
  process.exit(1);
}

// Handle process events for clean shutdown
function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', handleError);
