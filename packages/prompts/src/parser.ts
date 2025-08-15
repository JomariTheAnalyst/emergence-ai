import { JSDOM } from 'jsdom';
import Handlebars from 'handlebars';

export interface ParsedPrompt {
  id: string;
  version: string;
  provider?: string;
  category?: string;
  system?: SystemInstruction;
  variables: Variable[];
  contexts: ContextSource[];
  conditionals: ConditionalBlock[];
  tools: ToolDefinition[];
  templates: TemplateDefinition[];
  memory: MemoryOperation[];
  content: string;
  metadata: Record<string, any>;
}

export interface SystemInstruction {
  role?: string;
  temperature?: number;
  contextLimit?: number;
  content: string;
}

export interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  default?: any;
  required?: boolean;
  description?: string;
}

export interface ContextSource {
  source: 'file' | 'memory' | 'tool' | 'variable' | 'api';
  path?: string;
  key?: string;
  name?: string;
  fallback?: string;
  parameters?: Record<string, any>;
}

export interface ConditionalBlock {
  condition: string;
  content: string;
  elseContent?: string;
}

export interface ToolDefinition {
  name: string;
  description?: string;
  required?: boolean;
  parameters: ParameterDefinition[];
}

export interface ParameterDefinition {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  description?: string;
}

export interface TemplateDefinition {
  name: string;
  parameters: ParameterDefinition[];
  content: string;
}

export interface MemoryOperation {
  operation: 'save' | 'recall' | 'update' | 'delete';
  key: string;
  type?: string;
  content?: string;
  default?: string;
}

export class PromptParser {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  private registerHelpers() {
    // String functions
    this.handlebars.registerHelper('upper', (text: string) => text?.toUpperCase());
    this.handlebars.registerHelper('lower', (text: string) => text?.toLowerCase());
    this.handlebars.registerHelper('trim', (text: string) => text?.trim());
    this.handlebars.registerHelper('truncate', (text: string, length: number) => 
      text?.length > length ? text.substring(0, length) + '...' : text
    );
    this.handlebars.registerHelper('replace', (text: string, search: string, replace: string) =>
      text?.replace(new RegExp(search, 'g'), replace)
    );

    // File functions
    this.handlebars.registerHelper('file_extension', (path: string) => {
      const match = path?.match(/\.([^.]+)$/);
      return match ? match[1] : '';
    });
    this.handlebars.registerHelper('file_name', (path: string) => {
      return path?.split('/').pop()?.split('.')[0] || '';
    });

    // Context functions
    this.handlebars.registerHelper('current_time', () => new Date().toISOString());
    this.handlebars.registerHelper('project_name', () => 'Current Project'); // TODO: Get from context
    this.handlebars.registerHelper('user_name', () => 'User'); // TODO: Get from context

    // Conditional helpers
    this.handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => a > b);
    this.handlebars.registerHelper('lt', (a: number, b: number) => a < b);
    this.handlebars.registerHelper('and', (a: boolean, b: boolean) => a && b);
    this.handlebars.registerHelper('or', (a: boolean, b: boolean) => a || b);
  }

  parse(html: string): ParsedPrompt {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    const promptElement = document.querySelector('prompt');
    if (!promptElement) {
      throw new Error('Invalid POML: Missing <prompt> root element');
    }

    const parsed: ParsedPrompt = {
      id: promptElement.getAttribute('id') || 'unnamed',
      version: promptElement.getAttribute('version') || '1.0',
      provider: promptElement.getAttribute('provider') || undefined,
      category: promptElement.getAttribute('category') || undefined,
      variables: this.parseVariables(document),
      contexts: this.parseContexts(document),
      conditionals: this.parseConditionals(document),
      tools: this.parseTools(document),
      templates: this.parseTemplates(document),
      memory: this.parseMemory(document),
      content: this.extractContent(promptElement),
      metadata: {},
    };

    // Parse system instructions
    const systemElement = document.querySelector('system');
    if (systemElement) {
      parsed.system = {
        role: systemElement.getAttribute('role') || undefined,
        temperature: systemElement.getAttribute('temperature') 
          ? parseFloat(systemElement.getAttribute('temperature')!) 
          : undefined,
        contextLimit: systemElement.getAttribute('context-limit')
          ? parseInt(systemElement.getAttribute('context-limit')!)
          : undefined,
        content: systemElement.textContent?.trim() || '',
      };
    }

    return parsed;
  }

  private parseVariables(document: Document): Variable[] {
    const variables: Variable[] = [];
    const variablesElement = document.querySelector('variables');
    
    if (variablesElement) {
      const varElements = variablesElement.querySelectorAll('var');
      varElements.forEach(varEl => {
        variables.push({
          name: varEl.getAttribute('name') || '',
          type: (varEl.getAttribute('type') as any) || 'string',
          default: this.parseValue(varEl.getAttribute('default'), varEl.getAttribute('type') || 'string'),
          required: varEl.hasAttribute('required'),
          description: varEl.getAttribute('description') || undefined,
        });
      });
    }

    return variables;
  }

  private parseContexts(document: Document): ContextSource[] {
    const contexts: ContextSource[] = [];
    const contextElements = document.querySelectorAll('context');
    
    contextElements.forEach(contextEl => {
      const source = contextEl.getAttribute('source') as any;
      const fallbackEl = contextEl.querySelector('fallback');
      
      contexts.push({
        source,
        path: contextEl.getAttribute('path') || undefined,
        key: contextEl.getAttribute('key') || undefined,
        name: contextEl.getAttribute('name') || undefined,
        fallback: fallbackEl?.textContent?.trim() || undefined,
        parameters: this.parseParameters(contextEl),
      });
    });

    return contexts;
  }

  private parseConditionals(document: Document): ConditionalBlock[] {
    const conditionals: ConditionalBlock[] = [];
    const conditionalElements = document.querySelectorAll('conditional');
    
    conditionalElements.forEach(condEl => {
      const whenElements = condEl.querySelectorAll('when');
      const elseElement = condEl.querySelector('else');
      
      whenElements.forEach(whenEl => {
        conditionals.push({
          condition: whenEl.getAttribute('condition') || '',
          content: whenEl.textContent?.trim() || '',
          elseContent: elseElement?.textContent?.trim(),
        });
      });
    });

    return conditionals;
  }

  private parseTools(document: Document): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const toolsElement = document.querySelector('tools');
    
    if (toolsElement) {
      const toolElements = toolsElement.querySelectorAll('tool');
      
      toolElements.forEach(toolEl => {
        const descEl = toolEl.querySelector('description');
        const paramElements = toolEl.querySelectorAll('parameter');
        
        tools.push({
          name: toolEl.getAttribute('name') || '',
          description: descEl?.textContent?.trim(),
          required: toolEl.hasAttribute('required'),
          parameters: Array.from(paramElements).map(paramEl => ({
            name: paramEl.getAttribute('name') || '',
            type: paramEl.getAttribute('type') || 'string',
            required: paramEl.hasAttribute('required'),
            default: this.parseValue(paramEl.getAttribute('default'), paramEl.getAttribute('type') || 'string'),
            description: paramEl.getAttribute('description') || undefined,
          })),
        });
      });
    }

    return tools;
  }

  private parseTemplates(document: Document): TemplateDefinition[] {
    const templates: TemplateDefinition[] = [];
    const templateElements = document.querySelectorAll('template');
    
    templateElements.forEach(templateEl => {
      const paramElements = templateEl.querySelectorAll('parameter');
      
      templates.push({
        name: templateEl.getAttribute('name') || '',
        parameters: Array.from(paramElements).map(paramEl => ({
          name: paramEl.getAttribute('name') || '',
          type: paramEl.getAttribute('type') || 'string',
          required: paramEl.hasAttribute('required'),
          default: this.parseValue(paramEl.getAttribute('default'), paramEl.getAttribute('type') || 'string'),
        })),
        content: this.extractContentExcluding(templateEl, ['parameter']),
      });
    });

    return templates;
  }

  private parseMemory(document: Document): MemoryOperation[] {
    const memory: MemoryOperation[] = [];
    const memoryElement = document.querySelector('memory');
    
    if (memoryElement) {
      const saveElements = memoryElement.querySelectorAll('save');
      const recallElements = memoryElement.querySelectorAll('recall');
      
      saveElements.forEach(saveEl => {
        memory.push({
          operation: 'save',
          key: saveEl.getAttribute('key') || '',
          type: saveEl.getAttribute('type') || undefined,
          content: saveEl.textContent?.trim(),
        });
      });

      recallElements.forEach(recallEl => {
        const defaultEl = recallEl.querySelector('default');
        memory.push({
          operation: 'recall',
          key: recallEl.getAttribute('key') || '',
          default: defaultEl?.textContent?.trim(),
        });
      });
    }

    return memory;
  }

  private parseParameters(element: Element): Record<string, any> {
    const params: Record<string, any> = {};
    Array.from(element.attributes).forEach(attr => {
      if (!['source', 'path', 'key', 'name'].includes(attr.name)) {
        params[attr.name] = this.parseValue(attr.value, 'auto');
      }
    });
    return params;
  }

  private parseValue(value: string | null, type: string): any {
    if (!value) return undefined;
    
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'auto':
        // Try to auto-detect type
        if (value === 'true' || value === 'false') return value === 'true';
        if (!isNaN(Number(value))) return Number(value);
        return value;
      default:
        return value;
    }
  }

  private extractContent(element: Element): string {
    return this.extractContentExcluding(element, [
      'variables', 'system', 'context', 'conditional', 
      'tools', 'templates', 'memory', 'macros', 'events'
    ]);
  }

  private extractContentExcluding(element: Element, excludeTags: string[]): string {
    const clone = element.cloneNode(true) as Element;
    
    // Remove excluded elements
    excludeTags.forEach(tag => {
      const elements = clone.querySelectorAll(tag);
      elements.forEach(el => el.remove());
    });

    return clone.textContent?.trim() || '';
  }

  // Render a parsed prompt with variables
  render(parsed: ParsedPrompt, variables: Record<string, any> = {}): string {
    // Merge default variables with provided variables
    const allVariables = { ...variables };
    parsed.variables.forEach(varDef => {
      if (!(varDef.name in allVariables) && varDef.default !== undefined) {
        allVariables[varDef.name] = varDef.default;
      }
    });

    // Compile and render the template
    const template = this.handlebars.compile(parsed.content);
    return template(allVariables);
  }
}