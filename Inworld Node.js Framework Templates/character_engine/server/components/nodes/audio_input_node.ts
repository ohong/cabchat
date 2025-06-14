import { graph } from '@inworld/framework-nodejs';

import { AudioInput } from '../../types';

const { CustomInputDataType, CustomOutputDataType, CustomNode } = graph;

export class AudioInputNode extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.JSON;

  constructor(id: string) {
    super(id);
  }

  process(inputs: AudioInput[]) {
    return inputs[0];
  }
}
