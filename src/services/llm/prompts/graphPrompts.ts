/**
 * graphPrompts.ts - JSON Schemas + prompt templates for graph generation
 *
 * Kept separate from the orchestration logic so prompt/schema changes
 * never touch routing or retry code.
 */

/** Schema for basic graph generation (no codebase context). */
export const GRAPH_SCHEMA = {
  type: 'object',
  required: ['nodes', 'links'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'type'],
        properties: {
          id: { type: 'string' },
          group: { type: 'integer' },
          label: { type: 'string' },
          type: {
            type: 'string',
            enum: ['entry', 'logic', 'storage', 'exit', 'external', 'decision', 'process']
          },
          filePath: { type: 'string' },
          functionName: { type: 'string' },
          line: { type: 'integer' }
        }
      }
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source', 'target'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          value: { type: 'integer' },
          label: { type: 'string' }
        }
      }
    }
  }
} as const;

/** Schema for context-aware graph generation (adds data-flow metadata). */
export const GRAPH_SCHEMA_WITH_CONTEXT = {
  type: 'object',
  required: ['nodes', 'links'],
  properties: {
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'type'],
        properties: {
          id: { type: 'string' },
          group: { type: 'integer' },
          label: { type: 'string' },
          type: {
            type: 'string',
            enum: ['entry', 'logic', 'storage', 'exit', 'external', 'decision', 'process']
          },
          filePath: { type: 'string' },
          functionName: { type: 'string' },
          line: { type: 'integer' },
          inputType: { type: 'string', description: 'Type of data this node receives' },
          outputType: { type: 'string', description: 'Type of data this node produces' },
          transforms: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of transformations applied to data'
          }
        }
      }
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        required: ['source', 'target'],
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          value: { type: 'integer' },
          label: { type: 'string' },
          flowType: {
            type: 'string',
            enum: ['request', 'response', 'bidirectional'],
            description: 'Direction of data flow'
          }
        }
      }
    }
  }
} as const;

/** Prompt for basic graph generation. */
export function buildGraphPrompt(description: string): string {
  return `Generate a JSON object representing a node-link graph for a system described as: "${description}".

CRITICAL REQUIREMENTS:
1. You MUST include BOTH "nodes" AND "links" arrays in your response
2. Each link's "source" and "target" MUST reference an existing node's "id" value
3. Create edges that show data flow, control flow, or dependencies between components
4. Include at least 1 link for every 2 nodes (show connections!)
5. For nodes representing actual code components, INCLUDE the "filePath" property with the path to the source file
6. Include "functionName" when the node represents a specific function or method
7. Include "line" number when referencing a specific line in code

The JSON must adhere to this schema:
{
  "nodes": [
    {"id": "string", "group": number, "label": "string", "type": "entry|logic|storage|exit|external|decision|process", "filePath": "string (optional)", "functionName": "string (optional)", "line": number (optional)}
  ],
  "links": [{"source": "string", "target": "string", "value": number, "label": "string (optional)"}]
}

EXAMPLE of a valid response:
{
  "nodes": [
    {"id": "user", "group": 1, "label": "User", "type": "entry"},
    {"id": "api", "group": 2, "label": "API Gateway", "type": "logic", "filePath": "src/api/gateway.ts", "functionName": "handleRequest"},
    {"id": "db", "group": 3, "label": "Database", "type": "storage", "filePath": "src/db/connection.ts", "line": 45}
  ],
  "links": [
    {"source": "user", "target": "api", "value": 1, "label": "HTTP"},
    {"source": "api", "target": "db", "value": 1, "label": "query"}
  ]
}

Return ONLY valid JSON.`;
}

/** Prompt for context-aware graph generation, optionally carrying validation feedback from a failed attempt. */
export function buildGraphPromptWithContext(
  description: string,
  contextPrompt: string,
  lastFeedback: string | null
): string {
  let prompt = '';

  if (contextPrompt) {
    prompt += contextPrompt + '\n\n';
  }

  prompt += `Generate a JSON object representing a node-link graph for a system described as: "${description}".

CRITICAL REQUIREMENTS:
1. You MUST include BOTH "nodes" AND "links" arrays in your response
2. Each link's "source" and "target" MUST reference an existing node's "id" value
3. Create edges that show data flow, control flow, or dependencies between components
4. Include at least 1 link for every 2 nodes (show connections!)
5. For nodes representing actual code components, INCLUDE the "filePath" property with the path to the source file
6. Include "functionName" when the node represents a specific function or method
7. Include "line" number when referencing a specific line in code
8. Set "group" based on architectural layer: 1=entry/user, 2=API/orchestration, 3=services/logic, 4=storage/external
9. Include "inputType" and "outputType" to show data transformation at each node
10. Include "transforms" array listing how data changes at this node
11. Set "flowType" on links: "request" for downstream (user\u2192system), "response" for upstream (system\u2192user)

${lastFeedback ? `\nPREVIOUS ATTEMPT FAILED VALIDATION:\n${lastFeedback}\n\nPlease fix these issues.\n` : ''}

The JSON must adhere to this schema:
{
  "nodes": [
    {
      "id": "string",
      "group": number (1-4 based on layer),
      "label": "string",
      "type": "entry|logic|storage|exit|external|decision|process",
      "filePath": "string (optional)",
      "functionName": "string (optional)",
      "line": number (optional),
      "inputType": "string (optional)",
      "outputType": "string (optional)",
      "transforms": ["string"] (optional)
    }
  ],
  "links": [
    {
      "source": "string",
      "target": "string",
      "value": number,
      "label": "string (optional)",
      "flowType": "request|response|bidirectional" (optional)
    }
  ]
}

Return ONLY valid JSON.`;

  return prompt;
}
