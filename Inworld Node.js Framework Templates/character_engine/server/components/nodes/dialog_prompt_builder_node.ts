import { graph } from '@inworld/framework-nodejs';

import { preparePrompt } from '../../helpers';
import { State } from '../../types';

const { CustomNode, CustomInputDataType, CustomOutputDataType } = graph;

export class DialogPromptBuilderNode extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.CHAT_MESSAGES;

  private promptTemplate: string;

  constructor(id: string, promptTemplate: string) {
    super(id);

    this.promptTemplate = promptTemplate;
  }

  async process(inputs: State[]) {
    const state = inputs[0] as State;
    const prompt = await preparePrompt(this.promptTemplate, {
      agent: state.agent,
      messages: state.messages.slice(0, state.messages.length - 1),
      userName: state.userName,
      userQuery: state.messages[state.messages.length - 1].content,
    });

    return [{ role: 'user', content: prompt }];
  }
}
