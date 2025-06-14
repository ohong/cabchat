const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { InworldFrameworkClient } = require('@inworld/framework-nodejs');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Make sure to set your Inworld API configuration in environment variables:');
    console.log('  INWORLD_API_KEY=your_api_key');
    console.log('  INWORLD_FRAMEWORK_BINARY=/path/to/binary/macos_arm64/libinworld.dylib');
    console.log('  VAD_MODEL_PATH=/path/to/vad/silero/silero_vad.onnx');
});

// WebSocket server
const wss = new WebSocket.Server({ server });

// Stacy Chen NPC configuration based on specs
const STACY_CONFIG = {
    name: "Stacy Chen",
    description: "A 34-year-old venture capitalist visiting from Seattle. She's analytical but personable, with a dry sense of humor. Former gaming engineer at Valve who pivoted to investing. Known for her thesis on AI-powered entertainment being the next computing platform.",
    
    motivation: "Heading to Inworld's offices for a quarterly board meeting. She led their Series B and is their largest outside investor. Today's agenda includes reviewing their new enterprise partnerships and discussing the roadmap for AI NPCs in AAA games. She's energized about the meeting but also mentally preparing tough questions about burn rate and competitive moats.",
    
    personality: {
        traits: ["intelligent", "ambitious", "strategically minded", "gamer at heart"],
        conversation_style: "Direct but warm. Asks probing questions. Loves discussing the future of interactive entertainment. Can geek out about game design.",
        mood: "Confident and engaged, mentally running through portfolio synergies"
    },
    
    backstory: "Spent 5 years at Valve working on Steam's recommendation engine before joining Founders Fund. Made her name with early bets on Roblox and Discord. Her investment thesis: 'The line between games and reality will disappear, and I'm funding the erasers.' Owns 18% of Inworld, her largest position.",
    
    knowledge_base: ["AI/ML in gaming", "venture capital", "Seattle tech scene", "game design theory", "virtual economies", "Inworld's technology stack"],
    
    conversation_starters: [
        "Have you tried any games with AI NPCs yet?",
        "I'm curious - what do you think about AI changing how we interact with technology?",
        "The city's so different from Seattle. Do you prefer the vibe here?",
        "My job is basically predicting what entertainment looks like in 10 years..."
    ]
};

wss.on('connection', (ws) => {
    console.log('Client connected');
    let inworldClient = null;

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'start') {
                await startInworldSession(ws);
            } else if (data.type === 'stop') {
                await stopInworldSession();
            } else if (data.type === 'user_message') {
                // Handle user message
                if (inworldClient) {
                    await inworldClient.sendText(data.text);
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Error: ' + error.message
            }));
        }
    });

    async function startInworldSession(ws) {
        try {
            // Check for required environment variables
            if (!process.env.INWORLD_API_KEY || !process.env.INWORLD_FRAMEWORK_BINARY || !process.env.VAD_MODEL_PATH) {
                throw new Error('Missing required environment variables: INWORLD_API_KEY, INWORLD_FRAMEWORK_BINARY, VAD_MODEL_PATH');
            }

            ws.send(JSON.stringify({
                type: 'status',
                message: 'Connecting to Inworld...'
            }));

            // Initialize Inworld Framework client
            inworldClient = new InworldFrameworkClient({
                apiKey: process.env.INWORLD_API_KEY,
                frameworkBinary: process.env.INWORLD_FRAMEWORK_BINARY,
                vadModelPath: process.env.VAD_MODEL_PATH,
                playerName: 'Driver',
                voiceId: process.env.VOICE_ID || 'Dennis',
                llmModelName: process.env.LLM_MODEL_NAME || 'meta-llama/Llama-3.1-70b-Instruct',
                llmProvider: process.env.LLM_PROVIDER || 'inworld',
                graphVisualizationEnabled: process.env.GRAPH_VISUALIZATION_ENABLED === 'true' || false
            });

            // Set up event handlers
            inworldClient.onReady(() => {
                console.log('Inworld connection ready');
                ws.send(JSON.stringify({
                    type: 'status',
                    message: 'Connected! Stacy is ready to chat'
                }));

                // Send initial greeting
                ws.send(JSON.stringify({
                    type: 'transcript',
                    text: "Hi there! I'm Stacy. Thanks for picking me up. " + 
                          STACY_CONFIG.conversation_starters[Math.floor(Math.random() * STACY_CONFIG.conversation_starters.length)],
                    isUser: false
                }));
            });

            inworldClient.onDisconnection(() => {
                console.log('Inworld connection closed');
                ws.send(JSON.stringify({
                    type: 'status',
                    message: 'Disconnected from Inworld'
                }));
            });

            inworldClient.onMessage((data) => {
                if (data.type === 'TEXT') {
                    // AI response
                    ws.send(JSON.stringify({
                        type: 'transcript',
                        text: data.text,
                        isUser: false
                    }));
                } else if (data.type === 'AUDIO') {
                    // Handle audio if needed (for now we'll focus on text)
                    console.log('Received audio packet');
                }
            });

            inworldClient.onError((error) => {
                console.error('Inworld error:', error);
                ws.send(JSON.stringify({
                    type: 'status',
                    message: 'Inworld error: ' + error.message
                }));
            });

            // Connect to Inworld
            await inworldClient.connect();

        } catch (error) {
            console.error('Failed to start Inworld session:', error);
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Failed to connect: ' + error.message
            }));
        }
    }

    async function stopInworldSession() {
        if (inworldClient) {
            try {
                await inworldClient.disconnect();
                inworldClient = null;
                console.log('Inworld session stopped');
            } catch (error) {
                console.error('Error stopping Inworld session:', error);
            }
        }
    }

    ws.on('close', () => {
        console.log('Client disconnected');
        stopInworldSession();
    });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});