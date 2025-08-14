import { Router } from 'express';
import { llmService } from '../services/llm';

const router = Router();

// Send chat message
router.post('/message', async (req, res) => {
  try {
    const { message, sessionId, config } = req.body;

    if (!message || !sessionId) {
      return res.status(400).json({
        error: 'Message and sessionId are required'
      });
    }

    const response = await llmService.sendChatMessage(sessionId, message, config);
    
    res.json({
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message'
    });
  }
});

// Analyze code
router.post('/analyze', async (req, res) => {
  try {
    const { code, language, sessionId, config } = req.body;

    if (!code || !language || !sessionId) {
      return res.status(400).json({
        error: 'Code, language, and sessionId are required'
      });
    }

    const analysis = await llmService.analyzeCode(sessionId, code, language, config);
    
    res.json({
      analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Code analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze code'
    });
  }
});

// Generate code
router.post('/generate', async (req, res) => {
  try {
    const { requirements, language, context, sessionId, config } = req.body;

    if (!requirements || !language || !sessionId) {
      return res.status(400).json({
        error: 'Requirements, language, and sessionId are required'
      });
    }

    const code = await llmService.generateCode(sessionId, requirements, language, context, config);
    
    res.json({
      code,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Code generation error:', error);
    res.status(500).json({
      error: 'Failed to generate code'
    });
  }
});

// Debug code
router.post('/debug', async (req, res) => {
  try {
    const { code, error, language, sessionId, config } = req.body;

    if (!code || !error || !language || !sessionId) {
      return res.status(400).json({
        error: 'Code, error, language, and sessionId are required'
      });
    }

    const debugResponse = await llmService.debugCode(sessionId, code, error, language, config);
    
    res.json({
      debug: debugResponse,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Code debugging error:', error);
    res.status(500).json({
      error: 'Failed to debug code'
    });
  }
});

// Generate documentation
router.post('/document', async (req, res) => {
  try {
    const { code, language, docType, sessionId, config } = req.body;

    if (!code || !language || !docType || !sessionId) {
      return res.status(400).json({
        error: 'Code, language, docType, and sessionId are required'
      });
    }

    const documentation = await llmService.generateDocumentation(sessionId, code, language, docType, config);
    
    res.json({
      documentation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Documentation generation error:', error);
    res.status(500).json({
      error: 'Failed to generate documentation'
    });
  }
});

// Refactor code
router.post('/refactor', async (req, res) => {
  try {
    const { code, language, goals, sessionId, config } = req.body;

    if (!code || !language || !goals || !sessionId) {
      return res.status(400).json({
        error: 'Code, language, goals, and sessionId are required'
      });
    }

    const refactored = await llmService.refactorCode(sessionId, code, language, goals, config);
    
    res.json({
      refactored,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Code refactoring error:', error);
    res.status(500).json({
      error: 'Failed to refactor code'
    });
  }
});

// Get available models
router.get('/models', (req, res) => {
  try {
    const models = llmService.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      error: 'Failed to get available models'
    });
  }
});

// Update LLM configuration
router.post('/config', (req, res) => {
  try {
    const { sessionId, config } = req.body;

    if (!sessionId || !config) {
      return res.status(400).json({
        error: 'SessionId and config are required'
      });
    }

    llmService.updateConfig(sessionId, config);
    
    res.json({
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({
      error: 'Failed to update configuration'
    });
  }
});

// Clear chat session
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    llmService.clearSession(sessionId);
    
    res.json({
      message: 'Session cleared successfully'
    });
  } catch (error) {
    console.error('Clear session error:', error);
    res.status(500).json({
      error: 'Failed to clear session'
    });
  }
});

export { router as chatRoutes };