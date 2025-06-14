import { graph } from '@inworld/framework-nodejs';

import { Connection, TextInput } from '../../types';
import { EventFactory } from '../event_factory';

const { CustomNode, CustomInputDataType, CustomOutputDataType } = graph;

export class UpdateStateNode extends CustomNode {
  input = CustomInputDataType.JSON;
  output = CustomOutputDataType.JSON;

  private connections: { [key: string]: Connection };

  constructor(id: string, connections: { [key: string]: Connection }) {
    super(id);
    this.connections = connections;
  }

  process(inputs: TextInput[]) {
    let { text, interactionId, key } = inputs[0];

    this.connections[key].state.messages.push({
      role: 'user',
      content: text,
      id: interactionId,
    });
    // Send the user's text input to the client.
    this.connections[key].ws.send(
      JSON.stringify(
        EventFactory.text(text, interactionId, {
          isUser: true,
        }),
      ),
    );

    return this.connections[key].state;
  }
}
