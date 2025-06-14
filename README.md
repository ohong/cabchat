# CabChat: Real-Time AI Taxi Simulation

*A Web-Based Conversational Driving Experience*

## Overview

CabChat transforms your browser into a San Francisco taxi cab where you navigate city streets while engaging in natural conversations with AI passengers. Experience the unique intimacy of being a rideshare driver—strangers sharing stories in transit—compressed into engaging 3-minute vignettes that reveal character through dialogue.

## Core Concept

Think of it as the intersection between a flight simulator's purposeful mundanity and a social experiment in human connection. You'll pick up passengers, drive them to their destinations, and have meaningful conversations that affect your star rating and reviews.

## Key Features

### Immersive 3D Environment
- **50-block San Francisco simulation** starting at the iconic Ferry Building
- **Realistic traffic system** with 15-20 AI-controlled vehicles and functional traffic lights
- **Dynamic pedestrians** at crosswalks for authentic city atmosphere

### AI-Powered Conversations
- **Natural voice interactions** using Inworld's advanced AI technology
- **Character-driven dialogue** with unique passenger personalities and backstories
- **Real-time speech processing** with <1 second response times
- **Contextual conversations** that adapt to driving situations and passenger mood

### Dynamic Rating System
- **Post-ride evaluations** based on conversation quality and driving safety
- **Personalized reviews** written from the passenger's perspective
- **Star ratings** that reflect your social and professional skills

## Featured Passenger: Stacy Chen

Meet your first passenger—a 34-year-old venture capitalist and former Valve engineer heading to an important board meeting. Stacy is analytical but personable, with deep knowledge of AI gaming and a dry sense of humor. Your conversation with her will determine your rating.

## Tech Stack

- **Frontend**: Three.js for 3D rendering, vanilla JavaScript for game logic
- **AI Integration**: Inworld Node.js SDK with advanced language models
- **Audio Pipeline**: Browser Web Audio API → Inworld STT → LLM → Inworld TTS
- **Backend**: Express.js server with WebSocket communication
- **Deployment**: Static site hosting ready (GitHub Pages/Vercel compatible)

## Vehicle Controls

- **W/↑** - Accelerate (max 45 mph)
- **S/↓** - Brake/Reverse  
- **A/←** - Steer left
- **D/→** - Steer right
- **SPACE** - Handbrake
- **E** - Pick up/Drop off passenger

## Getting Started

1. **Environment Setup**: Configure your Inworld API credentials
2. **Install Dependencies**: `npm install`
3. **Start Server**: `npm start`
4. **Open Browser**: Navigate to `http://localhost:3000`
5. **Pick Up Stacy**: Look for the yellow diamond marker above passengers

## Minimum Viable Experience

If you have limited time, focus on these three core features:
1. **Driving**: Navigate from Ferry Building to destination
2. **Conversation**: Complete at least one voice exchange with the NPC
3. **Rating**: Receive star rating and review based on interaction quality

## Success Metrics

- Conversation feels natural with sub-second response times
- Complete rides in under 3 minutes
- Ratings accurately reflect conversation quality
- Zero critical bugs during gameplay
- Concept understanding within 30 seconds

## Vision

CabChat explores how AI can create meaningful human connections through shared experiences. By combining driving simulation with conversational AI, we're pioneering a new genre of interactive entertainment that values emotional intelligence alongside technical skill.

*Ready to hit the streets of San Francisco? Your passengers are waiting.*
