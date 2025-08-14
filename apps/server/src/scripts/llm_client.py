#!/usr/bin/env python3
import sys
import json
import os
import asyncio
from datetime import datetime
from emergentintegrations.llm.chat import LlmChat, UserMessage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def main():
    try:
        # Get input from command line arguments
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        
        session_id = input_data.get('sessionId', 'default')
        message = input_data.get('message', '')
        provider = input_data.get('provider', 'openai')
        model = input_data.get('model', 'gpt-4o-mini')
        api_key = input_data.get('apiKey', os.getenv('EMERGENT_LLM_KEY', ''))
        system_message = input_data.get('systemMessage', 'You are Shadow, an AI coding agent.')
        
        if not message:
            print(json.dumps({"error": "No message provided"}))
            sys.exit(1)
        
        if not api_key:
            print(json.dumps({"error": "No API key provided"}))
            sys.exit(1)
        
        # Initialize chat
        chat = LlmChat(api_key, session_id, system_message)
        chat.with_model(provider, model)
        
        # Send message
        user_message = UserMessage(message)
        response = await chat.send_message(user_message)
        
        # Return response
        print(json.dumps({
            "success": True,
            "response": response,
            "timestamp": datetime.now().isoformat()
        }))
        
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
