# Prompt Orchestration Markup Language (POML) Specification

## Overview

POML (Prompt Orchestration Markup Language) is an HTML-based markup language designed for creating reusable, composable, and context-aware prompts for AI agents. It enables sophisticated prompt engineering with dynamic content injection, conditional logic, and tool integration.

## Core Elements

### 1. `<prompt>` - Root Element
The main container for prompt definitions.

```html
<prompt id="code-review" version="1.0" provider="gemini">
  <!-- Prompt content -->
</prompt>
```

**Attributes:**
- `id`: Unique identifier for the prompt
- `version`: Semantic version for prompt evolution
- `provider`: Target LLM provider (gemini, openrouter, etc.)
- `category`: Prompt category for organization

### 2. `<system>` - System Instructions
Defines system-level instructions and agent behavior.

```html
<system role="expert-developer">
  You are an expert software engineer specializing in code review.
  Focus on code quality, security, and best practices.
</system>
```

**Attributes:**
- `role`: Agent role/persona
- `temperature`: Creativity level (0.0-1.0)
- `context-limit`: Maximum context tokens

### 3. `<context>` - Dynamic Context Injection
Injects dynamic content from various sources.

```html
<context source="file" path="{file_path}">
  <fallback>No file content available</fallback>
</context>

<context source="memory" key="project_context">
  <fallback>No project context found</fallback>
</context>

<context source="tool" name="git_status">
  <fallback>Unable to get git status</fallback>
</context>
```

**Sources:**
- `file`: File system content
- `memory`: Stored agent memories
- `tool`: Tool execution results
- `variable`: Runtime variables
- `api`: External API calls

### 4. `<conditional>` - Conditional Logic
Enables branching logic based on conditions.

```html
<conditional>
  <when condition="file_type == 'typescript'">
    Focus on TypeScript-specific patterns and type safety.
  </when>
  <when condition="file_size > 1000">
    This is a large file, provide a high-level summary first.
  </when>
  <else>
    Provide detailed line-by-line analysis.
  </else>
</conditional>
```

**Condition Types:**
- Variable comparisons
- File type detection
- Content analysis results
- Tool execution status

### 5. `<tools>` - Tool Integration
Defines available tools and their usage.

```html
<tools>
  <tool name="read_file" required="true">
    <description>Read file contents for analysis</description>
    <parameter name="path" type="string" required="true"/>
  </tool>
  
  <tool name="execute_command">
    <description>Run terminal commands when needed</description>
    <parameter name="command" type="string" required="true"/>
    <parameter name="timeout" type="number" default="30"/>
  </tool>
</tools>
```

### 6. `<memory>` - Memory Management
Handles context persistence and retrieval.

```html
<memory>
  <save key="code_patterns" type="analysis">
    {analysis_results}
  </save>
  
  <recall key="project_architecture">
    <default>No architecture information available</default>
  </recall>
</memory>
```

### 7. `<template>` - Reusable Components
Defines reusable prompt components.

```html
<template name="file-analysis">
  <parameter name="file_content" required="true"/>
  <parameter name="language" default="auto-detect"/>
  
  Analyze the following {language} code:
  
  ```{language}
  {file_content}
  ```
  
  Provide feedback on:
  1. Code quality and style
  2. Potential bugs or issues
  3. Performance considerations
  4. Best practice adherence
</template>
```

### 8. `<variables>` - Variable Definitions
Defines and manages variables within prompts.

```html
<variables>
  <var name="max_lines" type="number" default="100"/>
  <var name="include_tests" type="boolean" default="true"/>
  <var name="output_format" type="string" default="markdown"/>
</variables>
```

## Advanced Features

### 1. Prompt Inheritance
Prompts can inherit from base prompts:

```html
<prompt id="python-code-review" extends="code-review">
  <system role="python-expert">
    You are a Python expert. Focus on Pythonic patterns and PEP 8 compliance.
  </system>
  
  <context source="tool" name="pylint_analysis">
    <fallback>Run pylint for detailed analysis</fallback>
  </context>
</prompt>
```

### 2. Macro System
Define reusable macros:

```html
<macros>
  <macro name="code_block">
    ```{language}
    {content}
    ```
  </macro>
  
  <macro name="file_header">
    ## File: {filename}
    **Language:** {language}  
    **Size:** {size} lines
  </macro>
</macros>
```

### 3. Event Handlers
React to specific events:

```html
<events>
  <on event="file_changed">
    <action type="tool" name="analyze_diff"/>
    <action type="memory" operation="update" key="file_state"/>
  </on>
  
  <on event="error">
    <action type="log" level="error" message="{error_details}"/>
    <action type="fallback" prompt="error-recovery"/>
  </on>
</events>
```

### 4. Multi-step Workflows
Define complex multi-step processes:

```html
<workflow name="complete-code-review">
  <step name="analyze" prompt="code-analysis">
    <input source="context" key="file_content"/>
    <output key="analysis_result"/>
  </step>
  
  <step name="suggest" prompt="improvement-suggestions" depends="analyze">
    <input source="step" key="analysis_result"/>
    <output key="suggestions"/>
  </step>
  
  <step name="generate" prompt="code-generation" depends="suggest">
    <input source="step" key="suggestions"/>
    <output key="improved_code"/>
  </step>
</workflow>
```

## Built-in Functions

### String Functions
- `{upper(text)}` - Convert to uppercase
- `{lower(text)}` - Convert to lowercase
- `{trim(text)}` - Remove whitespace
- `{truncate(text, length)}` - Truncate to length
- `{replace(text, old, new)}` - Replace text

### File Functions
- `{file_extension(path)}` - Get file extension
- `{file_name(path)}` - Get filename without path
- `{file_size(path)}` - Get file size
- `{detect_language(content)}` - Detect programming language

### Context Functions
- `{current_time()}` - Current timestamp
- `{project_name()}` - Current project name
- `{git_branch()}` - Current git branch
- `{user_name()}` - Current user name

## Example: Complete Code Review Prompt

```html
<prompt id="comprehensive-code-review" version="2.0" provider="gemini" category="development">
  <variables>
    <var name="max_suggestions" type="number" default="5"/>
    <var name="include_security" type="boolean" default="true"/>
    <var name="detail_level" type="string" default="detailed"/>
  </variables>
  
  <system role="senior-developer" temperature="0.3">
    You are a senior software engineer with expertise in code review, security, and best practices.
    Provide constructive, actionable feedback that helps developers improve their code quality.
  </system>
  
  <context source="file" path="{target_file}">
    <fallback>Unable to read target file for review</fallback>
  </context>
  
  <context source="memory" key="project_standards">
    <fallback>No project coding standards defined</fallback>
  </context>
  
  <tools>
    <tool name="read_file" required="true"/>
    <tool name="git_diff"/>
    <tool name="lint_check"/>
  </tools>
  
  <template name="review-section">
    <parameter name="title" required="true"/>
    <parameter name="content" required="true"/>
    <parameter name="severity" default="info"/>
    
    ## {title}
    
    **Severity:** {severity}  
    **Details:** {content}
  </template>
  
  <conditional>
    <when condition="file_type == 'typescript' or file_type == 'javascript'">
      Focus on TypeScript/JavaScript best practices, async/await patterns, and type safety.
    </when>
    <when condition="file_type == 'python'">
      Emphasize Pythonic patterns, PEP compliance, and proper error handling.
    </when>
    <when condition="file_type == 'java'">
      Review for OOP principles, design patterns, and performance considerations.
    </when>
  </conditional>
  
  Please review the following code:
  
  {use template="file-analysis" file_content="{context:file}" language="{file_type}"}
  
  <conditional>
    <when condition="{include_security}">
      ## Security Analysis
      Identify potential security vulnerabilities and suggest remediation.
    </when>
  </conditional>
  
  <memory>
    <save key="review_results" type="code_review">
      {review_output}
    </save>
  </memory>
  
  Provide up to {max_suggestions} prioritized improvement suggestions.
  Format your response as structured markdown with clear sections.
</prompt>
```

## Usage in Code

```typescript
import { PromptOrchestrator } from '@shadow/prompts';

const orchestrator = new PromptOrchestrator();

// Load and execute prompt
const result = await orchestrator.execute('comprehensive-code-review', {
  target_file: './src/components/ChatInterface.tsx',
  include_security: true,
  detail_level: 'detailed'
});
```

This POML specification enables sophisticated prompt engineering while maintaining readability and reusability across the Shadow AI platform.