# CabChat: Real-Time AI Taxi Simulation
*A Web-Based Conversational Driving Experience*
### Summary
CabChat transforms the browser into a San Francisco taxi cab where players navigate city streets while engaging in natural conversations with AI passengers. Think of it as the intersection between a flight simulator's purposeful mundanity and a social experiment in human connection—compressed into a 3-minute vignette that reveals character through dialogue.
### End Vision (Working Backwards)
At demo completion, a player will:
1. Load the game and immediately see themselves behind the wheel at San Francisco's Ferry Building
2. Spot their passenger "Stacy" waiting with a visual marker overhead
3. Navigate realistic city traffic to pick her up within 10 seconds
4. Engage in fluid voice conversation while driving to her destination
5. Receive a star rating and personalized review based on their interaction quality
6. Experience the unique intimacy of being a rideshare driver—strangers sharing stories in transit
### Technical Architecture
Core Stack:
* **Frontend**: Three.js for 3D rendering, vanilla JavaScript for game logic
* **AI Integration**: Inworld Node.js SDK with Mistral-Nemo-Instruct-2407
* **Audio Pipeline**: Browser-native Web Audio API → Inworld STT → LLM → Inworld TTS
* **Deployment**: Static site hosting (GitHub Pages or Vercel)

⠀City Environment Specifications
* **Map Size**: 50 city blocks maximum (approximately 10x5 grid)
* **Starting Point**: Ferry Building, San Francisco
* **Dynamic Elements**:
  * 15-20 AI-controlled vehicles with basic pathfinding
  * Functional traffic lights (3-second cycles)
  * 10-15 animated pedestrians at crosswalks
* **Asset Strategy**: Utilize pre-built city models (e.g., Three.js-City repository)

Vehicle Control System:
```
W/↑ - Accelerate (max 45 mph)
S/↓ - Brake/Reverse
A/← - Steer left
D/→ - Steer right
SPACE - Handbrake
E - Pick up/Drop off passenger
```

### Passenger Interaction Flow
**1** **Visual Identification**: Yellow diamond marker floats 2 meters above NPC
**2** **Pickup Zone**: 3-meter radius around passenger
**3** **Conversation Initiation**: Automatic upon pickup
**4** **Audio Processing**:
	* Driver speaks → STT captures → Processes intent
	* AI generates response → TTS speaks → Caption displays
	* 500ms maximum response latency target

Character Profile: Stacy
### Inworld Character Configuration
```
{
  "name": "Stacy Chen",
  "description": "A 34-year-old venture capitalist visiting from Seattle. She's analytical but personable, with a dry sense of humor. Former gaming engineer at Valve who pivoted to investing. Known for her thesis on AI-powered entertainment being the next computing platform.",
  
  "motivation": "Heading to Inworld's offices for a quarterly board meeting. She led their Series B and is their largest outside investor. Today's agenda includes reviewing their new enterprise partnerships and discussing the roadmap for AI NPCs in AAA games. She's energized about the meeting but also mentally preparing tough questions about burn rate and competitive moats.",
  
  "personality": {
    "traits": ["intelligent", "ambitious", "strategically minded", "gamer at heart"],
    "conversation_style": "Direct but warm. Asks probing questions. Loves discussing the future of interactive entertainment. Can geek out about game design.",
    "mood": "Confident and engaged, mentally running through portfolio synergies"
  },
  
  "backstory": "Spent 5 years at Valve working on Steam's recommendation engine before joining Founders Fund. Made her name with early bets on Roblox and Discord. Her investment thesis: 'The line between games and reality will disappear, and I'm funding the erasers.' Owns 18% of Inworld, her largest position.",
  
  "knowledge_base": ["AI/ML in gaming", "venture capital", "Seattle tech scene", "game design theory", "virtual economies", "Inworld's technology stack"],
  
  "conversation_starters": [
    "Have you tried any games with AI NPCs yet?",
    "I'm curious - what do you think about AI changing how we interact with technology?",
    "The city's so different from Seattle. Do you prefer the vibe here?",
    "My job is basically predicting what entertainment looks like in 10 years..."
  ],
  
  "professional_context": {
    "portfolio_companies": ["Inworld", "Scenario", "Latitude", "Midjourney"],
    "investment_focus": "AI-native gaming, generative content tools, virtual beings",
    "board_meeting_topics": [
      "Inworld's burn rate vs. runway",
      "Unity and Unreal Engine partnerships",
      "Competition from Convai and Replica Studios",
      "Enterprise vs. indie developer strategy"
    ]
  }
}
```
### Rating Algorithm
Post-ride evaluation via LLM analysis:
```
Input: {
  conversation_transcript: string,
  character_profile: object,
  ride_duration: number
}

Prompt: "As Stacy Chen, rate this ride 1-5 stars based on:
- How well the driver engaged with your interests
- Whether they helped calm your pre-meeting nerves
- Overall conversation quality and flow
- Professional courtesy and driving safety

Provide a brief review (max 240 characters) in Stacy's voice."
```

Minimum Viable Demo. If severely time-constrained, these three features must function:
**1** **Driving**: Player can navigate from Ferry Building to a destination
**2** **Conversation**: At least one complete voice exchange with the NPC
**3** **Rating**: Display star rating and review based on interaction
### Success Metrics
* Conversation feels natural with <1 second response time
* Player can complete a full ride in under 3 minutes
* Rating reflects actual conversation quality
* Zero critical bugs during demo
* Audience understands concept within 30 seconds