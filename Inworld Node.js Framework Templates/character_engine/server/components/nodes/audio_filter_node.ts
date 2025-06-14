import { graph } from '@inworld/framework-nodejs';

import { AudioInput } from '../../types';

const { CustomInputDataType, CustomOutputDataType, CustomNode } = graph;

export class AudioFilterNode extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.AUDIO;

  constructor(id: string) {
    super(id);
  }

  process(inputs: AudioInput[]) {
    const { audio } = inputs[0];

    return audio;
  }
}
