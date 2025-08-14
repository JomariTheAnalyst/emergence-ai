'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  CogIcon,
  KeyIcon,
  CpuChipIcon,
  CheckIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
  useEmergentKey: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LLMConfig) => void;
  currentConfig?: LLMConfig;
}

const availableModels = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Most Capable)', recommended: true },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & Efficient)', recommended: true },
    { value: 'gpt-4', label: 'GPT-4 (Legacy)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (Enhanced)' },
    { value: 'o1', label: 'o1 (Reasoning Model)' },
    { value: 'o1-mini', label: 'o1-mini (Reasoning - Mini)' }
  ],
  anthropic: [
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Latest)', recommended: true },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-4-sonnet-20250514', label: 'Claude 4 Sonnet (Beta)' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' }
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Latest)', recommended: true },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Beta)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
  ]
};

export function SettingsModal({ isOpen, onClose, onSave, currentConfig }: SettingsModalProps) {
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    useEmergentKey: true,
    ...currentConfig
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const handleProviderChange = (provider: 'openai' | 'anthropic' | 'gemini') => {
    const recommendedModel = availableModels[provider].find(m => m.recommended)?.value || availableModels[provider][0].value;
    setConfig(prev => ({
      ...prev,
      provider,
      model: recommendedModel
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'gemini':
        return '💎';
      default:
        return '🔧';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-shadow-900 border border-shadow-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-shadow-800">
                <div className="flex items-center space-x-3">
                  <CogIcon className="h-6 w-6 text-blue-500" />
                  <h2 className="text-xl font-semibold text-white">LLM Configuration</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-shadow-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-shadow-400" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
                {/* API Key Method */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">API Key Configuration</h3>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 p-4 bg-shadow-800 rounded-lg cursor-pointer hover:bg-shadow-750 transition-colors">
                      <input
                        type="radio"
                        name="keyMethod"
                        checked={config.useEmergentKey}
                        onChange={() => setConfig(prev => ({ ...prev, useEmergentKey: true, apiKey: '' }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-green-400">🔑</span>
                          <span className="font-medium text-white">Use Emergent Universal Key</span>
                          <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">Recommended</span>
                        </div>
                        <p className="text-sm text-shadow-400 mt-1">
                          Single key works across all providers. Credits deducted from your Emergent balance.
                        </p>
                      </div>
                    </label>
                    
                    <label className="flex items-center space-x-3 p-4 bg-shadow-800 rounded-lg cursor-pointer hover:bg-shadow-750 transition-colors">
                      <input
                        type="radio"
                        name="keyMethod"
                        checked={!config.useEmergentKey}
                        onChange={() => setConfig(prev => ({ ...prev, useEmergentKey: false }))}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <KeyIcon className="h-4 w-4 text-blue-400" />
                          <span className="font-medium text-white">Use Your Own API Key</span>
                        </div>
                        <p className="text-sm text-shadow-400 mt-1">
                          Provide your own API key from the LLM provider.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Custom API Key Input */}
                {!config.useEmergentKey && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3"
                  >
                    <label className="block text-sm font-medium text-shadow-200">
                      API Key for {config.provider.charAt(0).toUpperCase() + config.provider.slice(1)}
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={config.apiKey}
                        onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder={`Enter your ${config.provider} API key...`}
                        className="w-full px-4 py-3 pr-12 bg-shadow-800 border border-shadow-700 rounded-lg text-shadow-100 placeholder-shadow-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-shadow-400 hover:text-shadow-300 transition-colors"
                      >
                        {showApiKey ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Provider Selection */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">AI Provider</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {Object.entries(availableModels).map(([provider, models]) => (
                      <motion.button
                        key={provider}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleProviderChange(provider as any)}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          config.provider === provider
                            ? 'border-blue-500 bg-blue-600/10'
                            : 'border-shadow-700 bg-shadow-800 hover:border-shadow-600'
                        }`}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-2">{getProviderIcon(provider)}</div>
                          <div className="font-medium text-white capitalize">{provider}</div>
                          <div className="text-xs text-shadow-400 mt-1">
                            {models.length} models available
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Model Selection */}
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Model Selection</h3>
                  <div className="space-y-2">
                    {availableModels[config.provider].map((model) => (
                      <motion.label
                        key={model.value}
                        whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                        className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          config.model === model.value ? 'bg-blue-600/20 border border-blue-500/50' : 'bg-shadow-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="model"
                          value={model.value}
                          checked={config.model === model.value}
                          onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-white">{model.label}</span>
                            {model.recommended && (
                              <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                                Recommended
                              </span>
                            )}
                          </div>
                        </div>
                        {config.model === model.value && (
                          <CheckIcon className="h-5 w-5 text-blue-500" />
                        )}
                      </motion.label>
                    ))}
                  </div>
                </div>

                {/* Configuration Preview */}
                <div className="bg-shadow-800 rounded-lg p-4">
                  <h4 className="font-medium text-white mb-3">Configuration Preview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-shadow-400">Provider:</span>
                      <span className="text-white capitalize">{config.provider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-shadow-400">Model:</span>
                      <span className="text-white">{config.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-shadow-400">API Key:</span>
                      <span className="text-white">
                        {config.useEmergentKey ? 'Emergent Universal Key' : (config.apiKey ? 'Custom Key Provided' : 'Not Provided')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer */}
              <div className="flex items-center justify-end space-x-3 p-6 border-t border-shadow-800">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-shadow-700 hover:bg-shadow-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!config.useEmergentKey && !config.apiKey)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-shadow-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CpuChipIcon className="h-4 w-4" />
                      <span>Save Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}