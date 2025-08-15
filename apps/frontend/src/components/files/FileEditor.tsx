'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { motion } from 'framer-motion';
import { 
  Save, 
  Search, 
  Settings, 
  Maximize2, 
  Minimize2,
  RotateCcw,
  Eye,
  Code,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FileTab {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  modified: boolean;
  saved: boolean;
}

interface FileEditorProps {
  tab: FileTab;
  onContentChange: (tabId: string, content: string) => void;
  onSave: (tabId: string) => void;
}

interface EditorSettings {
  theme: 'vs-dark' | 'vs-light' | 'hc-black';
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative' | 'interval';
  folding: boolean;
  bracketMatching: 'always' | 'near' | 'never';
}

export function FileEditor({ tab, onContentChange, onSave }: FileEditorProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [settings, setSettings] = useState<EditorSettings>({
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: 'off',
    minimap: true,
    lineNumbers: 'on',
    folding: true,
    bracketMatching: 'always',
  });

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            onSave(tab.id);
            break;
          case 'f':
            e.preventDefault();
            setShowSearch(true);
            break;
          case '=':
            e.preventDefault();
            setSettings(prev => ({ ...prev, fontSize: Math.min(prev.fontSize + 1, 24) }));
            break;
          case '-':
            e.preventDefault();
            setSettings(prev => ({ ...prev, fontSize: Math.max(prev.fontSize - 1, 10) }));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab.id, onSave]);

  const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure editor
    editor.updateOptions({
      fontSize: settings.fontSize,
      tabSize: settings.tabSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: settings.minimap },
      lineNumbers: settings.lineNumbers,
      folding: settings.folding,
      matchBrackets: settings.bracketMatching,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      renderWhitespace: 'boundary',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
    });

    // Add custom commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave(tab.id);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setShowSearch(true);
    });

    // Focus editor
    editor.focus();
  }, [settings, tab.id, onSave]);

  const handleContentChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onContentChange(tab.id, value);
    }
  }, [tab.id, onContentChange]);

  // Update editor settings
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        wordWrap: settings.wordWrap,
        minimap: { enabled: settings.minimap },
        lineNumbers: settings.lineNumbers,
        folding: settings.folding,
        theme: settings.theme,
      });
    }
  }, [settings]);

  const formatDocument = () => {
    if (editorRef.current && monacoRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const findAndReplace = () => {
    if (editorRef.current && searchQuery) {
      const model = editorRef.current.getModel();
      if (model) {
        const matches = model.findMatches(
          searchQuery, 
          false, 
          false, 
          false, 
          null, 
          false
        );
        
        if (matches.length > 0 && replaceQuery) {
          editorRef.current.executeEdits('replace-all', 
            matches.map(match => ({
              range: match.range,
              text: replaceQuery,
            }))
          );
        }
      }
    }
  };

  const goToLine = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.gotoLine')?.run();
    }
  };

  const toggleComment = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.commentLine')?.run();
    }
  };

  const getLanguageIcon = (language: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      javascript: <Code className="h-4 w-4 text-yellow-500" />,
      typescript: <Code className="h-4 w-4 text-blue-600" />,
      python: <Code className="h-4 w-4 text-green-600" />,
      html: <FileText className="h-4 w-4 text-orange-500" />,
      css: <Code className="h-4 w-4 text-blue-500" />,
      json: <FileText className="h-4 w-4 text-green-500" />,
      markdown: <FileText className="h-4 w-4 text-gray-600" />,
    };
    
    return iconMap[language] || <FileText className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-background",
      isMaximized && "fixed inset-0 z-50 bg-background"
    )}>
      {/* Editor Header */}
      <div className="flex-shrink-0 border-b border-border bg-card/30 backdrop-blur-sm">
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center space-x-3">
            {getLanguageIcon(tab.language)}
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">{tab.name}</span>
                {tab.modified && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">{tab.path}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* View Mode Toggle */}
            {(tab.language === 'markdown' || tab.language === 'html') && (
              <div className="flex bg-muted rounded p-0.5 mr-2">
                <Button
                  variant={viewMode === 'edit' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('edit')}
                  className="h-6 px-2 text-xs"
                >
                  <Code className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={viewMode === 'preview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('preview')}
                  className="h-6 px-2 text-xs"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSave(tab.id)}
              className="h-8 px-2 text-xs"
              disabled={!tab.modified}
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
              className="h-8 w-8 p-0"
              title="Search"
            >
              <Search className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={formatDocument}
              className="h-8 w-8 p-0"
              title="Format Document"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMaximized(!isMaximized)}
              className="h-8 w-8 p-0"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8 w-8 p-0"
              title="Settings"
            >
              <Settings className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border p-3"
          >
            <div className="flex items-center space-x-2 max-w-md">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs"
              />
              <Input
                placeholder="Replace..."
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="h-7 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={findAndReplace}
                className="h-7 px-2 text-xs"
              >
                Replace All
              </Button>
            </div>
          </motion.div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border p-3"
          >
            <Card className="p-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Theme</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value as any }))}
                    className="w-full h-7 text-xs bg-background border border-border rounded px-2"
                  >
                    <option value="vs-dark">Dark</option>
                    <option value="vs-light">Light</option>
                    <option value="hc-black">High Contrast</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Font Size</label>
                  <input
                    type="range"
                    min="10"
                    max="24"
                    value={settings.fontSize}
                    onChange={(e) => setSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                    className="w-full h-7"
                  />
                  <span className="text-xs text-muted-foreground">{settings.fontSize}px</span>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Tab Size</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={settings.tabSize}
                    onChange={(e) => setSettings(prev => ({ ...prev, tabSize: parseInt(e.target.value) }))}
                    className="w-full h-7 text-xs bg-background border border-border rounded px-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Word Wrap</label>
                  <select
                    value={settings.wordWrap}
                    onChange={(e) => setSettings(prev => ({ ...prev, wordWrap: e.target.value as any }))}
                    className="w-full h-7 text-xs bg-background border border-border rounded px-2"
                  >
                    <option value="off">Off</option>
                    <option value="on">On</option>
                    <option value="bounded">Bounded</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="minimap"
                    checked={settings.minimap}
                    onChange={(e) => setSettings(prev => ({ ...prev, minimap: e.target.checked }))}
                  />
                  <label htmlFor="minimap" className="text-xs font-medium">Show Minimap</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="folding"
                    checked={settings.folding}
                    onChange={(e) => setSettings(prev => ({ ...prev, folding: e.target.checked }))}
                  />
                  <label htmlFor="folding" className="text-xs font-medium">Code Folding</label>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Editor Content */}
      <div className="flex-1">
        {viewMode === 'edit' ? (
          <Editor
            height="100%"
            language={tab.language}
            value={tab.content}
            onChange={handleContentChange}
            onMount={handleEditorDidMount}
            theme={settings.theme}
            options={{
              automaticLayout: true,
              scrollBeyondLastLine: false,
              renderWhitespace: 'boundary',
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              contextmenu: true,
              quickSuggestions: true,
              parameterHints: { enabled: true },
              suggestOnTriggerCharacters: true,
              acceptSuggestionOnEnter: 'on',
              tabCompletion: 'on',
            }}
          />
        ) : (
          <div className="h-full p-4 overflow-auto bg-background">
            {tab.language === 'markdown' ? (
              <div className="prose dark:prose-invert max-w-none">
                {/* Markdown preview would go here */}
                <pre className="whitespace-pre-wrap">{tab.content}</pre>
              </div>
            ) : (
              <iframe
                srcDoc={tab.content}
                className="w-full h-full border-0"
                title="Preview"
              />
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 border-t border-border bg-card/30 px-4 py-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>{tab.language.toUpperCase()}</span>
            <span>UTF-8</span>
            <span>Ln 1, Col 1</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <span>{tab.content.length} characters</span>
            <span>{tab.content.split('\n').length} lines</span>
          </div>
        </div>
      </div>
    </div>
  );
}