'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Brain, Sparkles, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LLMConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  apiKey?: string;
  useEmergentKey: boolean;
  temperature: number;
  maxTokens: number;
}

interface ModelSelectorProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

const MODELS = {
  gemini: [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Best for complex reasoning and code analysis',
      icon: <Brain className="h-4 w-4" />,
      pricing: '$0.00125 / 1K tokens',
      recommended: true,
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient for most tasks',
      icon: <Zap className="h-4 w-4" />,
      pricing: '$0.000075 / 1K tokens',
      recommended: false,
    },
    {
      id: 'gemini-1.5-flash-8b',
      name: 'Gemini 1.5 Flash 8B',
      description: 'Ultra-fast for simple tasks',
      icon: <Sparkles className="h-4 w-4" />,
      pricing: '$0.0000375 / 1K tokens',
      recommended: false,
    },
  ],
  openrouter: [
    {
      id: 'anthropic/claude-3.5-sonnet',
      name: 'Claude 3.5 Sonnet',
      description: 'Excellent for code generation and analysis',
      icon: <Brain className="h-4 w-4" />,
      pricing: '$0.003 / 1K tokens',
      recommended: true,
    },
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      description: 'Advanced reasoning and multimodal capabilities',
      icon: <Brain className="h-4 w-4" />,
      pricing: '$0.005 / 1K tokens',
      recommended: false,
    },
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o Mini',
      description: 'Cost-effective for most coding tasks',
      icon: <Zap className="h-4 w-4" />,
      pricing: '$0.00015 / 1K tokens',
      recommended: false,
    },
    {
      id: 'meta-llama/llama-3.2-90b-vision-instruct',
      name: 'Llama 3.2 90B Vision',
      description: 'Open source with vision capabilities',
      icon: <Sparkles className="h-4 w-4" />,
      pricing: '$0.0009 / 1K tokens',
      recommended: false,
    },
  ],
};

export function ModelSelector({ config, onChange }: ModelSelectorProps) {
  const [localConfig, setLocalConfig] = useState(config);

  const handleProviderChange = (provider: 'gemini' | 'openrouter') => {
    const defaultModel = MODELS[provider][0].id;
    setLocalConfig(prev => ({
      ...prev,
      provider,
      model: defaultModel,
    }));
  };

  const handleModelChange = (model: string) => {
    setLocalConfig(prev => ({ ...prev, model }));
  };

  const handleSave = () => {
    onChange(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(config);
  };

  const currentModels = MODELS[localConfig.provider];
  const selectedModel = currentModels.find(m => m.id === localConfig.model);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-4 w-4" />
          <span>Model Configuration</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Provider</label>
          <div className="grid grid-cols-2 gap-2">
            {(['gemini', 'openrouter'] as const).map((provider) => (
              <Button
                key={provider}
                variant={localConfig.provider === provider ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleProviderChange(provider)}
                className="justify-start"
              >
                {provider === 'gemini' ? (
                  <Sparkles className="h-4 w-4 mr-2" />
                ) : (
                  <Brain className="h-4 w-4 mr-2" />
                )}
                {provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}
              </Button>
            ))}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Model</label>
          <div className="space-y-2">
            {currentModels.map((model) => (
              <motion.div
                key={model.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  variant={localConfig.model === model.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleModelChange(model.id)}
                  className="w-full justify-start h-auto p-3"
                >
                  <div className="flex items-start space-x-3 w-full">
                    {model.icon}
                    <div className="flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{model.name}</span>
                        {model.recommended && (
                          <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {model.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {model.pricing}
                      </p>
                    </div>
                    {localConfig.model === model.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </Button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* API Key Configuration */}
        <div>
          <label className="text-sm font-medium mb-2 block">API Key</label>
          <div className="space-y-2">
            <Button
              variant={localConfig.useEmergentKey ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLocalConfig(prev => ({ ...prev, useEmergentKey: true }))}
              className="w-full justify-start"
            >
              <Zap className="h-4 w-4 mr-2" />
              Use Emergent Universal Key
            </Button>
            <Button
              variant={!localConfig.useEmergentKey ? 'default' : 'outline'}
              size="sm"
              onClick={() => setLocalConfig(prev => ({ ...prev, useEmergentKey: false }))}
              className="w-full justify-start"
            >
              <Settings className="h-4 w-4 mr-2" />
              Use Custom API Key
            </Button>
            
            {!localConfig.useEmergentKey && (
              <Input
                type="password"
                placeholder={`Enter your ${localConfig.provider} API key`}
                value={localConfig.apiKey || ''}
                onChange={(e) => setLocalConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                className="mt-2"
              />
            )}
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Temperature: {localConfig.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localConfig.temperature}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Max Tokens</label>
            <Input
              type="number"
              value={localConfig.maxTokens}
              onChange={(e) => setLocalConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              min={100}
              max={8000}
              step={100}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button onClick={handleSave}>
            Save Configuration
          </Button>
        </div>

        {/* Selected Model Summary */}
        {selectedModel && (
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              {selectedModel.icon}
              <span className="font-medium">{selectedModel.name}</span>
              {selectedModel.recommended && (
                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedModel.description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pricing: {selectedModel.pricing}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}