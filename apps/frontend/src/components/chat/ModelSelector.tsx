import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Sparkles, Zap, Brain, Key, Settings, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export interface ModelConfig {
  provider: 'gemini' | 'openrouter';
  model: string;
  apiKey?: string;
  useEmergentKey: boolean;
  temperature: number;
  maxTokens: number;
}

interface ModelSelectorProps {
  config: ModelConfig;
  onChange: (config: ModelConfig) => void;
  className?: string;
}

interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
  pricing?: {
    prompt: number;
    completion: number;
  };
}

export function ModelSelector({ config, onChange, className }: ModelSelectorProps) {
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openrouter'>(config.provider);
  const [selectedModel, setSelectedModel] = useState<string>(config.model);
  const [temperature, setTemperature] = useState<number>(config.temperature);
  const [maxTokens, setMaxTokens] = useState<number>(config.maxTokens);
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [useEmergentKey, setUseEmergentKey] = useState<boolean>(config.useEmergentKey);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Gemini models
  const geminiModels: ModelOption[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'Google',
      description: 'Google\'s most capable model with 1M context window',
      contextLength: 1000000,
      pricing: { prompt: 0.00125, completion: 0.00375 },
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'Google',
      description: 'Faster and more cost-effective version of Gemini 1.5',
      contextLength: 1000000,
      pricing: { prompt: 0.00025, completion: 0.0007 },
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      provider: 'Google',
      description: 'Balanced performance for most tasks',
      contextLength: 32768,
      pricing: { prompt: 0.000125, completion: 0.000375 },
    },
  ];

  // Default OpenRouter models
  const defaultOpenRouterModels: ModelOption[] = [
    {
      id: 'openai/gpt-4o',
      name: 'GPT-4o',
      provider: 'OpenAI',
      description: 'OpenAI\'s most capable model',
      contextLength: 128000,
      pricing: { prompt: 0.005, completion: 0.015 },
    },
    {
      id: 'anthropic/claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      description: 'Anthropic\'s latest model with excellent reasoning',
      contextLength: 200000,
      pricing: { prompt: 0.003, completion: 0.015 },
    },
    {
      id: 'meta-llama/llama-3-70b-instruct',
      name: 'Llama 3 70B',
      provider: 'Meta',
      description: 'Meta\'s open model with strong performance',
      contextLength: 8192,
      pricing: { prompt: 0.0009, completion: 0.0009 },
    },
    {
      id: 'mistral/mistral-large',
      name: 'Mistral Large',
      provider: 'Mistral',
      description: 'Mistral\'s flagship model',
      contextLength: 32768,
      pricing: { prompt: 0.002, completion: 0.006 },
    },
  ];

  // Fetch available models from OpenRouter
  useEffect(() => {
    if (activeProvider === 'openrouter' && apiKey && !useEmergentKey) {
      setIsLoading(true);
      fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://emergence-ai.app',
          'X-Title': 'Emergence AI',
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to fetch models');
          }
          return response.json();
        })
        .then(data => {
          if (data.data && Array.isArray(data.data)) {
            const models = data.data.map((model: any) => ({
              id: model.id,
              name: model.name,
              provider: model.provider,
              description: model.description,
              contextLength: model.context_length,
              pricing: {
                prompt: model.pricing?.prompt,
                completion: model.pricing?.completion,
              },
            }));
            setAvailableModels(models);
          }
        })
        .catch(error => {
          console.error('Error fetching models:', error);
          setAvailableModels(defaultOpenRouterModels);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (activeProvider === 'openrouter') {
      setAvailableModels(defaultOpenRouterModels);
    } else {
      setAvailableModels(geminiModels);
    }
  }, [activeProvider, apiKey, useEmergentKey]);

  // Update selected model when provider changes
  useEffect(() => {
    if (activeProvider === 'gemini' && !selectedModel.startsWith('gemini-')) {
      setSelectedModel('gemini-1.5-pro');
    } else if (activeProvider === 'openrouter' && selectedModel.startsWith('gemini-')) {
      setSelectedModel('openai/gpt-4o');
    }
  }, [activeProvider, selectedModel]);

  // Handle provider change
  const handleProviderChange = (provider: 'gemini' | 'openrouter') => {
    setActiveProvider(provider);
    
    // Set default model for the provider
    if (provider === 'gemini') {
      setSelectedModel('gemini-1.5-pro');
    } else {
      setSelectedModel('openai/gpt-4o');
    }
  };

  // Handle save changes
  const handleSaveChanges = () => {
    onChange({
      provider: activeProvider,
      model: selectedModel,
      apiKey: useEmergentKey ? undefined : apiKey,
      useEmergentKey,
      temperature,
      maxTokens,
    });
  };

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <Tabs defaultValue={activeProvider} onValueChange={(value) => handleProviderChange(value as 'gemini' | 'openrouter')}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="gemini" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Gemini
            </TabsTrigger>
            <TabsTrigger value="openrouter" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              OpenRouter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gemini" className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {geminiModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {geminiModels.find(m => m.id === selectedModel)?.description || 'Google\'s AI model'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>API Key</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Get your API key from Google AI Studio</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="use-emergent-key"
                  checked={useEmergentKey}
                  onCheckedChange={setUseEmergentKey}
                />
                <Label htmlFor="use-emergent-key">Use Emergence AI key</Label>
              </div>
              {!useEmergentKey && (
                <Input
                  type="password"
                  placeholder="Enter your Gemini API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="openrouter" className="space-y-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {isLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading models...
                    </SelectItem>
                  ) : (
                    availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name} ({model.provider})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {availableModels.find(m => m.id === selectedModel)?.description || 'Access multiple AI models through OpenRouter'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>API Key</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Get your API key from OpenRouter.ai</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="use-emergent-key-or"
                  checked={useEmergentKey}
                  onCheckedChange={setUseEmergentKey}
                />
                <Label htmlFor="use-emergent-key-or">Use Emergence AI key</Label>
              </div>
              {!useEmergentKey && (
                <Input
                  type="password"
                  placeholder="Enter your OpenRouter API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              )}
            </div>
          </TabsContent>

          <div className="space-y-4 mt-4 pt-4 border-t">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature: {temperature.toFixed(1)}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Higher values make output more random, lower values more deterministic</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.1}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Precise</span>
                <span>Balanced</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Tokens: {maxTokens}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Maximum number of tokens to generate in the response</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Slider
                min={256}
                max={4096}
                step={256}
                value={[maxTokens]}
                onValueChange={(value) => setMaxTokens(value[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>256</span>
                <span>2048</span>
                <span>4096</span>
              </div>
            </div>

            <Button onClick={handleSaveChanges} className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Apply Settings
            </Button>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}

