require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { graph, primitives, telemetry } = require('@inworld/framework-nodejs');
const { v4: uuidv4 } = require('uuid');
const WavEncoder = require('wav-encoder');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Parse environment variables
function parseEnvironmentVariables() {
    if (!process.env.INWORLD_API_KEY) {
        throw new Error('INWORLD_API_KEY env variable is required');
    }
    
    return {
        apiKey: process.env.INWORLD_API_KEY,
        llmModelName: process.env.LLM_MODEL_NAME || 'meta-llama/Llama-3.1-70b-Instruct',
        llmProvider: process.env.LLM_PROVIDER || 'inworld',
        voiceId: process.env.VOICE_ID || 'Dennis',
    };
}

// Stacy Chen NPC configuration
const STACY_CONFIG = {
    id: uuidv4(),
    name: "Stacy Chen",
    description: "A 34-year-old venture capitalist visiting from Seattle. She's analytical but personable, with a dry sense of humor. Former gaming engineer at Valve who pivoted to investing. Known for her thesis on AI-powered entertainment being the next computing platform.",
    motivation: "Heading to Inworld's offices for a quarterly board meeting. She led their Series B and is their largest outside investor. Today's agenda includes reviewing their new enterprise partnerships and discussing the roadmap for AI NPCs in AAA games. She's energized about the meeting but also mentally preparing tough questions about burn rate and competitive moats.",
};

// Text generation configuration
const TEXT_CONFIG = {
    maxNewTokens: 200,
    maxPromptLength: 1000,
    repetitionPenalty: 1,
    topP: 0.8,
    temperature: 0.8,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopSequences: ['\n\n'],
};

// Custom node for processing conversation input
class ConversationNode extends graph.CustomNode {
    constructor(id, connections) {
        super(id);
        this.input = graph.CustomInputDataType.TEXT;
        this.output = graph.CustomOutputDataType.CHAT_MESSAGES;
        this.connections = connections;
    }

    async process(inputs) {
        const data = JSON.parse(inputs[0]);
        const connection = this.connections[data.key];
        
        if (!connection) {
            throw new Error('Connection not found');
        }
        
        // Add user message to conversation history
        connection.state.messages.push({
            role: 'user',
            content: data.text
        });
        
        // Create system message with character context
        const systemMessage = {
            role: 'system',
            content: `You are ${connection.state.agent.name}. ${connection.state.agent.description}\n\nCurrent situation: ${connection.state.agent.motivation}\n\nRespond as ${connection.state.agent.name} in character. Keep responses conversational and under 100 words.`
        };
        
        // Return chat messages format expected by LLM node
        const messages = [systemMessage, ...connection.state.messages.slice(-10)];
        
        return messages;
    }
}


// Create conversation graph
async function createConversationGraph(config, connections) {
    const { Graph, NodeFactory } = graph;
    const { SpeechSynthesisConfig } = primitives.tts;
    
    const synthesisConfig = SpeechSynthesisConfig.getDefault();
    
    // Create nodes
    const conversationNode = new ConversationNode('ConversationNode', connections).build();

    const llmNode = await NodeFactory.createRemoteLLMNode({
        id: 'LLMNode',
        llmConfig: { 
            modelName: config.llmModelName, 
            provider: config.llmProvider, 
            apiKey: config.apiKey 
        },
        executionConfig: {
            textGenerationConfig: TEXT_CONFIG,
        },
        stream: true,
    });

    // Use the framework's TextChunkingNode to properly chunk text for TTS
    const textChunkingNode = NodeFactory.createTextChunkingNode({
        id: 'TextChunkingNode',
    });

    const ttsNode = await NodeFactory.createRemoteTTSNode({
        id: 'TTSNode',
        ttsConfig: {
            apiKey: config.apiKey,
            synthesisConfig,
        },
        executionConfig: {
            speakerId: config.voiceId,
            synthesisConfig,
        },
    });

    // Build graph with proper text chunking
    const conversationGraph = new Graph('CabChatGraph');
    conversationGraph.addNode(conversationNode);
    conversationGraph.addNode(llmNode);
    conversationGraph.addNode(textChunkingNode);
    conversationGraph.addNode(ttsNode);
    conversationGraph.addEdge(conversationNode, llmNode);
    conversationGraph.addEdge(llmNode, textChunkingNode);
    conversationGraph.addEdge(textChunkingNode, ttsNode);
    conversationGraph.setStartNode(conversationNode);
    conversationGraph.setEndNode(ttsNode);

    return { graph: conversationGraph, nodes: [conversationNode, llmNode, textChunkingNode, ttsNode] };
}

class CabChatApp {
    constructor() {
        this.config = null;
        this.connections = {};
        this.conversationGraph = null;
    }

    async initialize() {
        this.config = parseEnvironmentVariables();
        
        // Initialize telemetry
        telemetry.init({
            appName: 'CabChat',
            appVersion: '1.0.0',
            apiKey: this.config.apiKey,
        });

        // Create the conversation graph
        this.conversationGraph = await createConversationGraph(this.config, this.connections);

        console.log('CabChat initialized successfully');
    }

    createSession(key, userName = 'Passenger') {
        this.connections[key] = {
            state: {
                agent: STACY_CONFIG,
                userName: userName,
                messages: []
            },
            ws: null
        };

        return this.connections[key];
    }

    removeSession(key) {
        if (this.connections[key]) {
            delete this.connections[key];
        }
    }

    async processMessage(key, text) {
        const input = JSON.stringify({
            text: text,
            key: key
        });

        const executionId = uuidv4();
        const outputStream = await this.conversationGraph.graph.execute(input, executionId);
        
        return { outputStream, executionId };
    }

    shutdown() {
        if (this.conversationGraph) {
            this.conversationGraph.graph.destroy();
            this.conversationGraph.nodes.forEach(node => node.destroy());
        }
        this.connections = {};
        telemetry.shutdown();
    }
}

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

const cabChatApp = new CabChatApp();

wss.on('connection', (ws) => {
    console.log('Client connected');
    let sessionKey = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'start') {
                await handleStartConversation(ws, data);
            } else if (data.type === 'stop') {
                await handleStopConversation();
            } else if (data.type === 'user_message' || data.type === 'message') {
                await handleUserMessage(data.text);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Error: ' + error.message
            }));
        }
    });

    async function handleStartConversation(ws, data) {
        try {
            if (!cabChatApp.config) {
                throw new Error('App not initialized');
            }

            sessionKey = uuidv4();
            const connection = cabChatApp.createSession(sessionKey, data.userName || 'Passenger');
            connection.ws = ws;

            ws.send(JSON.stringify({
                type: 'status',
                message: 'Connected! Stacy is ready to chat'
            }));

            // Send initial greeting
            const greetings = [
                "Hi there! I'm Stacy. Thanks for picking me up - heading to Inworld for a board meeting. What's your take on AI in games?",
                "Hey! I'm Stacy Chen. Perfect timing for this ride - I'm curious, have you seen how AI is changing entertainment?",
                "Hi! Stacy here. Coming from Seattle, this city feels so different. You been driving long?",
                "Hello! I'm Stacy. My job is basically betting on the future of interactive entertainment. What do you think that looks like?"
            ];
            
            const initialGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // Send greeting to transcript immediately
            ws.send(JSON.stringify({
                type: 'transcript',
                text: initialGreeting,
                isUser: false
            }));
            
            // Generate audio for the greeting
            setTimeout(async () => {
                try {
                    // Add greeting to conversation history
                    cabChatApp.connections[sessionKey].state.messages.push({
                        role: 'assistant',
                        content: initialGreeting
                    });
                    
                    // Use TTS directly for the greeting
                    const { Graph, NodeFactory } = graph;
                    const { SpeechSynthesisConfig } = primitives.tts;
                    
                    const synthesisConfig = SpeechSynthesisConfig.getDefault();
                    const ttsNode = await NodeFactory.createRemoteTTSNode({
                        id: 'GreetingTTSNode',
                        ttsConfig: {
                            apiKey: cabChatApp.config.apiKey,
                            synthesisConfig,
                        },
                        executionConfig: {
                            speakerId: cabChatApp.config.voiceId,
                            synthesisConfig,
                        },
                    });
                    
                    const greetingGraph = new Graph('GreetingGraph');
                    greetingGraph.addNode(ttsNode);
                    greetingGraph.setStartNode(ttsNode);
                    greetingGraph.setEndNode(ttsNode);
                    
                    const outputStream = await greetingGraph.execute(initialGreeting, uuidv4());
                    const ttsStream = (await outputStream.next()).data;
                    
                    if (ttsStream?.next) {
                        let chunk = await ttsStream.next();
                        while (!chunk.done) {
                            if (chunk.audio) {
                                ws.send(JSON.stringify({
                                    type: 'audio',
                                    audio: chunk.audio
                                }));
                            }
                            chunk = await ttsStream.next();
                        }
                    }
                    
                    greetingGraph.closeExecution(outputStream);
                    greetingGraph.destroy();
                    ttsNode.destroy();
                } catch (error) {
                    console.error('Error processing initial greeting:', error);
                }
            }, 1000);

        } catch (error) {
            console.error('Failed to start conversation:', error);
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Failed to connect: ' + error.message
            }));
        }
    }

    async function handleUserMessage(text) {
        if (!sessionKey || !cabChatApp.connections[sessionKey]) {
            throw new Error('No active session');
        }

        try {
            // Validate input text has English letters/digits for TTS
            const cleanText = text.trim();
            if (!cleanText || !/[a-zA-Z0-9]/.test(cleanText)) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Please enter a message with at least one letter or number.'
                }));
                return;
            }

            // Send user message to transcript
            ws.send(JSON.stringify({
                type: 'transcript',
                text: cleanText,
                isUser: true
            }));

            console.log('Processing user message:', cleanText);
            
            const { outputStream, executionId } = await cabChatApp.processMessage(sessionKey, cleanText);
            console.log('Got output stream from graph');
            
            // Handle the TTS output stream
            const ttsStreamWrapper = await outputStream.next();
            console.log('TTS stream wrapper:', ttsStreamWrapper);
            
            const ttsStream = ttsStreamWrapper.data;
            
            if (ttsStream?.next) {
                let chunk = await ttsStream.next();
                let fullResponse = '';
                let sentenceBuffer = '';

                while (!chunk.done) {
                    console.log('Chunk received:', JSON.stringify(chunk)); // Debug logging
                    
                    if (chunk.text && typeof chunk.text === 'string') {
                        const chunkText = chunk.text;
                        fullResponse += chunkText;
                        sentenceBuffer += chunkText;
                        
                        // Check if we have a complete sentence
                        if (sentenceBuffer.match(/[.!?]\s*$/) || sentenceBuffer.includes('\n')) {
                            ws.send(JSON.stringify({
                                type: 'transcript',
                                text: sentenceBuffer.trim(),
                                isUser: false
                            }));
                            sentenceBuffer = '';
                        }
                    }
                    
                    if (chunk.audio) {
                        console.log('Processing audio chunk, sample rate:', chunk.audio.sampleRate, 'data length:', chunk.audio.data?.length || 'unknown');
                        
                        try {
                            // Convert raw audio data to WAV format
                            const audioBuffer = await WavEncoder.encode({
                                sampleRate: chunk.audio.sampleRate || 16000,
                                channelData: [new Float32Array(chunk.audio.data)],
                            });
                            
                            // Convert to base64 for transmission
                            const base64Audio = Buffer.from(audioBuffer).toString('base64');
                            
                            console.log('Sending WAV audio chunk, base64 length:', base64Audio.length);
                            ws.send(JSON.stringify({
                                type: 'audio',
                                audio: base64Audio
                            }));
                        } catch (audioError) {
                            console.error('Error processing audio:', audioError);
                        }
                    }

                    chunk = await ttsStream.next();
                }

                // Send any remaining text
                if (sentenceBuffer.trim()) {
                    ws.send(JSON.stringify({
                        type: 'transcript',
                        text: sentenceBuffer.trim(),
                        isUser: false
                    }));
                }

                // Add assistant response to conversation history
                if (fullResponse.trim()) {
                    cabChatApp.connections[sessionKey].state.messages.push({
                        role: 'assistant',
                        content: fullResponse.trim()
                    });
                }
            } else {
                console.log('No TTS stream available');
            }
            
            cabChatApp.conversationGraph.graph.closeExecution(outputStream);
            console.log('Closed execution stream');

        } catch (error) {
            console.error('Error handling user message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Error processing message: ' + error.message
            }));
        }
    }

    async function handleStopConversation() {
        if (sessionKey) {
            cabChatApp.removeSession(sessionKey);
            sessionKey = null;
            console.log('Conversation stopped');
        }
    }

    ws.on('close', () => {
        console.log('Client disconnected');
        handleStopConversation();
    });
});

// Initialize the app
cabChatApp.initialize().catch(console.error);

// Handle graceful shutdown
function shutdown() {
    console.log('Shutting down gracefully');
    cabChatApp.shutdown();
    server.close(() => {
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);