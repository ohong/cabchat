import 'dotenv/config';

import { common, graph, primitives } from '@inworld/framework-nodejs';
import { readFileSync } from 'fs';
import * as path from 'path';
import { v4 } from 'uuid';

const minimist = require('minimist');

const { InworldError } = common;
const { Graph, CustomNode, CustomInputDataType, CustomOutputDataType } = graph;

const { renderJinja } = primitives.llm;

class JinjaRenderNode extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.TEXT;

  async process(inputs: { prompt: string; promptProps: string }[]) {
    return renderJinja(inputs[0].prompt, inputs[0].promptProps);
  }
}

const usage = `
Usage:
    yarn node-jinja-template \n
    --prompt=<path-to-prompt-file>[optional, default file can be loaded instead] \n
    --promptProps=<path-to-prompt-vars-file>[optional, default file can be loaded instead]

Description:
    This example demonstrates how to create a custom node that renders a Jinja template.
    The node is asynchronous and will return the rendered prompt.
`;

run();

async function run() {
  const args = parseArgs();

  const prompt = readFileSync(args.prompt, 'utf8');
  const promptProps = readFileSync(args.promptProps, 'utf8');

  const customNode = new JinjaRenderNode(v4()).build();
  const graph = new Graph(v4());
  graph.addNode(customNode);
  graph.setStartNode(customNode);
  graph.setEndNode(customNode);

  const outputStream = await graph.execute(
    JSON.stringify({
      prompt,
      promptProps,
    }),
    v4(),
  );
  const renderedTemplate = (await outputStream.next()).data;

  console.log(
    '\n\n\x1b[45m Rendered Jinja Template: \x1b[0m\n\n',
    renderedTemplate,
  );

  graph.closeExecution(outputStream);
  graph.stopExecutor();
  graph.cleanupAllExecutions();
  graph.destroy();
  customNode.destroy();
}

function parseArgs(): {
  prompt: string;
  promptProps: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  let prompt = argv.prompt;
  let promptProps = argv.promptProps;

  if (!prompt) {
    let promptPath = path.join(
      __dirname,
      '..',
      '..',
      'prompts',
      'basic_prompt.jinja',
    );
    console.warn(
      '\x1b[33musing default prompt file (' + promptPath + ')\x1b[0m',
    );
    prompt = promptPath;
  }

  if (!promptProps) {
    let promptPropsPath = path.join(
      __dirname,
      '..',
      '..',
      'prompts',
      'basic_prompt_props.json',
    );
    console.warn(
      '\x1b[33musing default promptProps file (' + promptPropsPath + ')\x1b[0m',
    );
    promptProps = promptPropsPath;
  }

  return { prompt, promptProps };
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
