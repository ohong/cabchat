require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { graph, primitives, telemetry } = require('@inworld/framework-nodejs');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Parse environment variables
function parseEnvironmentVariables() {
    if (!process.env.INWORLD_API_KEY) {
        throw new Error('INWORLD_API_KEY env variable is required');
    }
    if (!process.env.VAD_MODEL_PATH) {
        throw new Error('VAD_MODEL_PATH env variable is required');
    }
    
    return {
        apiKey: process.env.INWORLD_API_KEY,
        llmModelName: process.env.LLM_MODEL_NAME || 'meta-llama/Llama-3.1-70b-Instruct',
        llmProvider: process.env.LLM_PROVIDER || 'inworld',
        voiceId: process.env.VOICE_ID || 'Dennis',
        vadModelPath: process.env.VAD_MODEL_PATH,
        graphVisualizationEnabled: (process.env.GRAPH_VISUALIZATION_ENABLED || '').toLowerCase().trim() === 'true',
    };
}

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Stacy Chen NPC configuration
const STACY_CONFIG = {
    name: "Stacy Chen",
    description: "A 34-year-old venture capitalist visiting from Seattle. She's analytical but personable, with a dry sense of humor. Former gaming engineer at Valve who pivoted to investing. Known for her thesis on AI-powered entertainment being the next computing platform.",
    motivation: "Heading to Inworld's offices for a quarterly board meeting. She led their Series B and is their largest outside investor. Today's agenda includes reviewing their new enterprise partnerships and discussing the roadmap for AI NPCs in AAA games. She's energized about the meeting but also mentally preparing tough questions about burn rate and competitive moats.",
};

let inworldGraph = null;
let config = null;

// Initialize Inworld
async function initializeInworld() {
    try {
        config = parseEnvironmentVariables();
        
        // Initialize telemetry
        telemetry.init({
            appName: 'CabChat',
            appVersion: '1.0.0',
            apiKey: config.apiKey,
        });

        console.log('Inworld initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Inworld:', error);
        throw error;
    }
}

// Create simple graph for text conversation
async function createConversationGraph() {
    const { Graph, NodeFactory } = graph;
    const { SpeechSynthesisConfig } = primitives.tts;
    
    const synthesisConfig = SpeechSynthesisConfig.getDefault();
    
    const llmNode = await NodeFactory.createRemoteLLMNode({
        id: 'LLMNode',
        llmConfig: { 
            modelName: config.llmModelName, 
            provider: config.llmProvider, 
            apiKey: config.apiKey 
        },
        executionConfig: {
            textGenerationConfig: {
                maxTokens: 150,
                temperature: 0.7,
            },
        },
        stream: true,
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

    const conversationGraph = new Graph('CabChatGraph');
    conversationGraph.addNode(llmNode);
    conversationGraph.addNode(ttsNode);
    conversationGraph.addEdge(llmNode, ttsNode);
    conversationGraph.setStartNode(llmNode);
    conversationGraph.setEndNode(ttsNode);

    return conversationGraph;
}

wss.on('connection', (ws) => {
    console.log('Client connected');
    let currentGraph = null;
    let conversationHistory = [];

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'start') {
                await startConversation(ws);
            } else if (data.type === 'stop') {
                await stopConversation();
            } else if (data.type === 'user_message') {
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

    async function startConversation(ws) {
        try {
            if (!config) {
                throw new Error('Inworld not initialized');
            }

            ws.send(JSON.stringify({
                type: 'status',
                message: 'Connecting to Inworld...'
            }));

            currentGraph = await createConversationGraph();
            
            // Set up graph output listener
            const outputStream = currentGraph.createOutputStream();
            outputStream.on('data', (data) => {
                if (data.type === 'TEXT') {
                    ws.send(JSON.stringify({
                        type: 'transcript',
                        text: data.text,
                        isUser: false
                    }));
                } else if (data.type === 'AUDIO') {
                    // Handle audio if needed
                    console.log('Received audio packet');
                }
            });

            ws.send(JSON.stringify({
                type: 'status',
                message: 'Connected! Stacy is ready to chat'
            }));

            // Send initial greeting
            const greetings = [
                "Hi there! I'm Stacy. Thanks for picking me up. Have you tried any games with AI NPCs yet?",
                "Hey! I'm Stacy. This is perfect timing - I'm curious, what do you think about AI changing how we interact with technology?",
                "Hi! Stacy here. The city's so different from Seattle. Do you prefer the vibe here?",
                "Hello! I'm Stacy. My job is basically predicting what entertainment looks like in 10 years..."
            ];
            
            const initialGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            ws.send(JSON.stringify({
                type: 'transcript',
                text: initialGreeting,
                isUser: false
            }));

        } catch (error) {
            console.error('Failed to start conversation:', error);
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Failed to connect: ' + error.message
            }));
        }
    }

    async function handleUserMessage(text) {
        if (!currentGraph) {
            throw new Error('No active conversation');
        }

        conversationHistory.push({ role: 'user', content: text });
        
        // Create context-aware prompt
        const systemPrompt = `You are ${STACY_CONFIG.name}. ${STACY_CONFIG.description}

Current situation: ${STACY_CONFIG.motivation}

Personality: Respond as Stacy would - direct but warm, asking probing questions, loves discussing the future of interactive entertainment, can geek out about game design.

Keep responses conversational and under 100 words.

Conversation so far:
${conversationHistory.map(msg => `${msg.role === 'user' ? 'Passenger' : 'Stacy'}: ${msg.content}`).join('\n')}

Respond as Stacy:`;

        // Send to LLM node
        await currentGraph.run({
            type: 'TEXT',
            text: systemPrompt
        });
    }

    async function stopConversation() {
        if (currentGraph) {
            currentGraph.destroy();
            currentGraph = null;
            conversationHistory = [];
            console.log('Conversation stopped');
        }
    }

    ws.on('close', () => {
        console.log('Client disconnected');
        stopConversation();
    });
});

// Initialize on startup
initializeInworld().catch(console.error);

// Handle graceful shutdown
function shutdown() {
    console.log('Shutting down gracefully');
    if (inworldGraph) {
        inworldGraph.destroy();
    }
    telemetry.shutdown();
    server.close(() => {
        process.exit(0);
    });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);