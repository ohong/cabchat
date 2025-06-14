import { graph } from '@inworld/framework-nodejs';

import { AudioInput, TextInput } from '../../types';

const { CustomInputDataType, CustomOutputDataType, CustomNode } = graph;

export class TextInputNode extends CustomNode {
  input = [CustomInputDataType.JSON, CustomInputDataType.TEXT];
  output = CustomOutputDataType.JSON;

  constructor(id: string) {
    super(id);
  }

  process(inputs: any[]) {
    const { audio: _audio, ...rest } = inputs[0] as AudioInput;

    return {
      text: inputs[1],
      ...rest,
    } as TextInput;
  }
}
