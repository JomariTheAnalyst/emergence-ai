#!/usr/bin/env node

const { PrismaClient } = require('@shadow/db');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seedDatabase() {
  console.log('🌱 Seeding Shadow AI database...\n');

  try {
    // Create a demo user
    console.log('👤 Creating demo user...');
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@shadow-ai.dev' },
      update: {},
      create: {
        email: 'demo@shadow-ai.dev',
        name: 'Demo User',
        avatar: null,
      },
    });
    console.log(`✅ Demo user created: ${demoUser.id}\n`);

    // Seed prompt templates
    console.log('📝 Seeding prompt templates...');
    
    const promptTemplates = [
      {
        name: 'code-review',
        category: 'development',
        version: '1.0',
        content: `<prompt id="code-review" version="1.0" provider="gemini" category="development">
  <variables>
    <var name="file_path" type="string" required="true"/>
    <var name="focus_areas" type="string" default="quality,security,performance"/>
    <var name="detail_level" type="string" default="detailed"/>
  </variables>

  <system role="senior-developer" temperature="0.3">
    You are a senior software engineer with expertise in code review, security, and best practices.
    Provide constructive, actionable feedback that helps developers improve their code quality.
  </system>

  <context source="file" path="{file_path}">
    <fallback>Unable to read file for review</fallback>
  </context>

  <tools>
    <tool name="read_file" required="true">
      <parameter name="path" type="string" required="true"/>
    </tool>
  </tools>

  Please review the following code file: **{file_path}**

  Focus areas: {focus_areas}
  Detail level: {detail_level}

  Provide feedback on:
  1. Code quality and style
  2. Potential bugs or issues  
  3. Security considerations
  4. Performance implications
  5. Best practice adherence

  <conditional>
    <when condition="detail_level == 'summary'">
      Provide a high-level summary of the main issues and strengths.
    </when>
    <when condition="detail_level == 'detailed'">
      Provide line-by-line analysis where appropriate.
    </when>
  </conditional>

  Format your response as structured markdown with clear sections.

  <memory>
    <save key="last_review_feedback" type="code_review">
      Code review completed for {file_path} with focus on {focus_areas}
    </save>
  </memory>
</prompt>`,
        variables: {
          file_path: { type: 'string', required: true },
          focus_areas: { type: 'string', default: 'quality,security,performance' },
          detail_level: { type: 'string', default: 'detailed' }
        },
        provider: 'gemini',
      },
      {
        name: 'feature-planning',
        category: 'planning',
        version: '1.0',
        content: `<prompt id="feature-planning" version="1.0" provider="gemini" category="planning">
  <variables>
    <var name="feature_description" type="string" required="true"/>
    <var name="tech_stack" type="string" default=""/>
    <var name="timeline" type="string" default=""/>
  </variables>

  <system role="technical-architect" temperature="0.5">
    You are a technical architect with expertise in software design and project planning.
    Help break down features into actionable tasks with clear implementation steps.
  </system>

  <context source="memory" key="project_context">
    <fallback>No existing project context available</fallback>
  </context>

  ## Feature Planning Request

  **Feature:** {feature_description}
  **Tech Stack:** {tech_stack}
  **Timeline:** {timeline}

  Please analyze this feature request and provide:

  1. **Technical Requirements**
     - Core functionality needed
     - Dependencies and integrations
     - Data models and API endpoints

  2. **Implementation Plan**
     - Break down into specific tasks
     - Identify dependencies between tasks
     - Estimate effort for each component

  3. **Architecture Considerations**
     - Design patterns to use
     - Potential challenges and solutions
     - Scalability and performance factors

  4. **Testing Strategy**
     - Unit testing requirements
     - Integration testing needs
     - User acceptance criteria

  <memory>
    <save key="feature_plan" type="feature_request">
      Feature planning completed for: {feature_description}
    </save>
  </memory>
</prompt>`,
        variables: {
          feature_description: { type: 'string', required: true },
          tech_stack: { type: 'string', default: '' },
          timeline: { type: 'string', default: '' }
        },
        provider: 'gemini',
      },
      {
        name: 'bug-analysis',
        category: 'debugging',
        version: '1.0',
        content: `<prompt id="bug-analysis" version="1.0" provider="openrouter" category="debugging">
  <variables>
    <var name="error_description" type="string" required="true"/>
    <var name="error_logs" type="string" default=""/>
    <var name="reproduction_steps" type="string" default=""/>
  </variables>

  <system role="debug-expert" temperature="0.2">
    You are an expert debugger with deep knowledge of common software issues.
    Provide systematic analysis and concrete solutions for reported bugs.
  </system>

  <tools>
    <tool name="grep_search">
      <parameter name="pattern" type="string"/>
      <parameter name="path" type="string"/>
    </tool>
  </tools>

  ## Bug Analysis

  **Issue:** {error_description}

  <conditional>
    <when condition="error_logs != ''">
      **Error Logs:**
      \`\`\`
      {error_logs}
      \`\`\`
    </when>
  </conditional>

  <conditional>
    <when condition="reproduction_steps != ''">
      **Reproduction Steps:**
      {reproduction_steps}
    </when>
  </conditional>

  Please provide:

  1. **Root Cause Analysis**
     - Identify the most likely cause
     - Explain why this error occurs
     - Point to specific code locations if possible

  2. **Solution Steps**
     - Immediate fix recommendations
     - Step-by-step implementation
     - Code examples where helpful

  3. **Prevention Measures**
     - How to prevent similar issues
     - Testing strategies
     - Monitoring recommendations

  <memory>
    <save key="bug_analysis" type="bug_report">
      Bug analysis completed: {error_description}
    </save>
  </memory>
</prompt>`,
        variables: {
          error_description: { type: 'string', required: true },
          error_logs: { type: 'string', default: '' },
          reproduction_steps: { type: 'string', default: '' }
        },
        provider: 'openrouter',
      }
    ];

    for (const template of promptTemplates) {
      await prisma.promptTemplate.upsert({
        where: { name: template.name },
        update: { ...template },
        create: { ...template },
      });
      console.log(`✅ Prompt template '${template.name}' seeded`);
    }

    console.log('\n🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };