# AI Integration Guide

This document provides information about the AI integration in Emergence AI, including setup instructions, potential issues, and troubleshooting steps.

## Supported AI Providers

Emergence AI supports the following AI providers:

1. **Google Gemini**
   - Models: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
   - API Key: Requires a Google AI Studio API key

2. **OpenRouter**
   - Provides access to multiple AI models from different providers:
     - OpenAI (GPT-4o, GPT-4o-mini, etc.)
     - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, etc.)
     - Meta (Llama 3 70B, Llama 3 8B, etc.)
     - Mistral (Mistral Large, Mistral Medium, etc.)
     - And more
   - API Key: Requires an OpenRouter API key

## Setup Instructions

### Environment Variables

Set the following environment variables to configure the AI providers:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# OpenRouter API Key
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional: Direct provider keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### User Configuration

Users can configure their preferred AI provider and model in the application settings:

1. Click on the settings icon in the chat interface
2. Select the provider (Gemini or OpenRouter)
3. Choose a model from the available options
4. Adjust temperature and max tokens as needed
5. Optionally provide their own API key or use the application's key

## Known Issues and Troubleshooting

### API Key Issues

**Issue**: "API key not valid" or "Authentication failed" errors.

**Troubleshooting**:
- Verify that the API key is correctly set in the environment variables
- Check if the API key has expired or has been revoked
- Ensure the API key has the necessary permissions
- For OpenRouter, verify that the API key has access to the selected model

### Rate Limiting

**Issue**: "Rate limit exceeded" or "Too many requests" errors.

**Troubleshooting**:
- Implement exponential backoff retry logic
- Consider upgrading to a higher tier API plan
- Distribute requests across multiple API keys
- Cache responses when appropriate

### Model Availability

**Issue**: Selected model is not available or returns an error.

**Troubleshooting**:
- Check if the model is still supported by the provider
- Verify that the model name is correctly formatted
- For OpenRouter, ensure the model is available in your region
- Fall back to an alternative model if the selected one is unavailable

### Token Limits

**Issue**: "Context length exceeded" or "Token limit exceeded" errors.

**Troubleshooting**:
- Reduce the size of the input prompt
- Implement context window management to prioritize relevant information
- Use a model with a larger context window
- Split large requests into smaller chunks

### Streaming Issues

**Issue**: Streaming responses are incomplete or disconnected.

**Troubleshooting**:
- Check network connectivity
- Implement proper error handling for stream interruptions
- Add reconnection logic for dropped connections
- Ensure the client can handle partial responses

### Tool Calling Issues

**Issue**: Tool calls are not being properly executed or returned.

**Troubleshooting**:
- Verify that the model supports function calling/tool use
- Check that tool definitions are correctly formatted
- Ensure tool parameters match the expected schema
- Validate that tool responses are properly formatted for the model

### Content Filtering

**Issue**: Responses are being filtered or blocked by content moderation.

**Troubleshooting**:
- Review input prompts for potentially problematic content
- Adjust system prompts to better guide the model
- Try a different model or provider with different content policies
- Implement pre-processing to identify and modify potentially problematic requests

## Performance Optimization

### Token Usage Optimization

To optimize token usage and reduce costs:

1. Use concise system prompts
2. Implement efficient context window management
3. Use the most appropriate model for the task
4. Truncate conversation history when appropriate
5. Compress or summarize long inputs

### Response Time Optimization

To improve response times:

1. Use streaming for long responses
2. Select faster models for time-sensitive tasks
3. Implement client-side caching for common queries
4. Use parallel requests when appropriate
5. Optimize prompt design for faster responses

## Security Considerations

### API Key Security

- Never expose API keys in client-side code
- Rotate API keys regularly
- Use environment variables for API key storage
- Implement proper access controls for API keys

### User Data Protection

- Minimize sensitive data sent to AI providers
- Implement proper data sanitization
- Consider using on-premise models for sensitive workloads
- Review provider data retention policies

### Prompt Injection Prevention

- Validate and sanitize user inputs
- Use clear role separation in prompts
- Implement output validation
- Consider using a dedicated security layer for AI interactions

## Future Improvements

Planned improvements for the AI integration:

1. Support for additional AI providers
2. Fine-tuned models for specific tasks
3. Advanced prompt engineering techniques
4. Improved error handling and fallback mechanisms
5. Enhanced monitoring and analytics for AI usage
6. Local model support for reduced latency and improved privacy

## Contact and Support

For issues with the AI integration, please contact the development team or open an issue in the repository.

When reporting issues, please include:
- The specific error message
- The provider and model being used
- Steps to reproduce the issue
- Any relevant logs or error codes

