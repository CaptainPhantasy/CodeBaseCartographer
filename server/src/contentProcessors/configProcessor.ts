/**
 * Config Content Processor for Codebase Cartographer
 *
 * Processes configuration files (YAML, TOML, INI, ENV) and converts them
 * into structured text representations suitable for LLM consumption.
 */

import yaml from 'js-yaml';
import TOML from 'toml';
import { ProcessedContent } from '../types.js';

/**
 * Parses YAML content and returns a structured representation.
 *
 * @param content - The YAML file content as a string
 * @returns ProcessedContent with formatted YAML data
 * @throws Error if YAML parsing fails
 */
export async function processYaml(content: string): Promise<ProcessedContent> {
  try {
    const parsed = yaml.load(content) as any;
    const keyCount = countKeys(parsed);
    const formatted = formatObject(parsed, 0);

    return {
      summary: `YAML configuration file with ${keyCount} top-level keys`,
      extracts: [
        {
          path: '<root>',
          content: formatted,
        },
      ],
      symbols: extractSymbols(parsed, '<root>'),
    };
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parses TOML content and returns a structured representation.
 *
 * @param content - The TOML file content as a string
 * @returns ProcessedContent with formatted TOML data
 * @throws Error if TOML parsing fails
 */
export async function processToml(content: string): Promise<ProcessedContent> {
  try {
    const parsed = TOML.parse(content) as any;
    const keyCount = countKeys(parsed);
    const formatted = formatObject(parsed, 0);

    return {
      summary: `TOML configuration file with ${keyCount} top-level keys`,
      extracts: [
        {
          path: '<root>',
          content: formatted,
        },
      ],
      symbols: extractSymbols(parsed, '<root>'),
    };
  } catch (error) {
    throw new Error(`Failed to parse TOML: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parses INI content and returns a structured representation.
 *
 * Simple INI parser that handles:
 * - Section headers: [section]
 * - Key-value pairs: key = value
 * - Comments: ; or #
 * - Inline comments
 *
 * @param content - The INI file content as a string
 * @returns ProcessedContent with formatted INI data
 */
export async function processIni(content: string): Promise<ProcessedContent> {
  try {
    const parsed: Record<string, any> = {};
    const lines = content.split('\n');
    let currentSection = 'root';
    let keyCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith(';') || line.startsWith('#')) {
        continue;
      }

      // Section header
      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        if (!parsed[currentSection]) {
          parsed[currentSection] = {};
          keyCount++;
        }
        continue;
      }

      // Key-value pair
      const kvMatch = line.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        const value = parseIniValue(kvMatch[2].trim());

        if (currentSection === 'root') {
          if (!parsed.root) {
            parsed.root = {};
          }
          parsed.root[key] = value;
        } else {
          parsed[currentSection][key] = value;
        }
        keyCount++;
      }
    }

    const formatted = formatIniObject(parsed);

    return {
      summary: `INI configuration file with ${keyCount} keys across ${Object.keys(parsed).length} sections`,
      extracts: [
        {
          path: '<root>',
          content: formatted,
        },
      ],
      symbols: extractIniSymbols(parsed),
    };
  } catch (error) {
    throw new Error(`Failed to parse INI: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parses ENV file content and returns a structured representation.
 *
 * Handles:
 * - Key-value pairs: KEY=value
 * - Comments: #
 * - Empty lines
 * - Quoted values (single and double quotes)
 * - Export statements
 *
 * @param content - The ENV file content as a string
 * @returns ProcessedContent with formatted ENV data
 */
export async function processEnv(content: string): Promise<ProcessedContent> {
  try {
    const parsed: Record<string, string> = {};
    const lines = content.split('\n');
    let keyCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Handle export statement
      let workingLine = trimmed;
      if (workingLine.startsWith('export ')) {
        workingLine = workingLine.substring(7);
      }

      // Key-value pair
      const firstEquals = workingLine.indexOf('=');
      if (firstEquals > 0) {
        const key = workingLine.substring(0, firstEquals).trim();
        let value = workingLine.substring(firstEquals + 1).trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }

        parsed[key] = value;
        keyCount++;
      }
    }

    const formatted = Object.entries(parsed)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    return {
      summary: `Environment file with ${keyCount} variables`,
      extracts: [
        {
          path: '<root>',
          content: formatted,
        },
      ],
      symbols: Object.entries(parsed).map(([key]) => ({
        name: key,
        type: 'variable',
        path: '<root>',
      })),
    };
  } catch (error) {
    throw new Error(`Failed to parse ENV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Processes a configuration file based on its extension.
 *
 * Supports: .yaml, .yml, .toml, .ini, .env
 *
 * @param filePath - The path to the configuration file
 * @param content - The file content as a string
 * @returns ProcessedContent with formatted configuration data
 * @throws Error if file type is not supported or parsing fails
 */
export async function processConfigFile(filePath: string, content: string): Promise<ProcessedContent> {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'yaml':
    case 'yml':
      return processYaml(content);
    case 'toml':
      return processToml(content);
    case 'ini':
      return processIni(content);
    case 'env':
      return processEnv(content);
    default:
      throw new Error(`Unsupported config file type: ${ext}`);
  }
}

/**
 * Recursively counts the number of keys in an object.
 */
function countKeys(obj: any): number {
  if (!obj || typeof obj !== 'object') {
    return 0;
  }
  if (Array.isArray(obj)) {
    return obj.length;
  }
  return Object.keys(obj).length;
}

/**
 * Formats an object as a readable string representation.
 */
function formatObject(obj: any, indent: number): string {
  const spaces = '  '.repeat(indent);

  if (obj === null || obj === undefined) {
    return `${spaces}null`;
  }

  if (typeof obj !== 'object') {
    return `${spaces}${String(obj)}`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return `${spaces}[]`;
    }
    const items = obj.map(item => formatObject(item, 0));
    return `${spaces}[\n${items.map(item => '  ' + spaces + item).join('\n')}\n${spaces}]`;
  }

  const entries = Object.entries(obj);
  if (entries.length === 0) {
    return `${spaces}{}`;
  }

  return entries
    .map(([key, value]) => {
      const formattedValue = formatObject(value, indent + 1);
      if (typeof value === 'object' && value !== null) {
        return `${spaces}${key}:\n${formattedValue}`;
      }
      return `${spaces}${key}: ${formattedValue.trim()}`;
    })
    .join('\n');
}

/**
 * Formats an INI object as a readable string representation.
 */
function formatIniObject(obj: Record<string, any>): string {
  const lines: string[] = [];

  const sections = Object.keys(obj);
  for (const section of sections) {
    const sectionData = obj[section];
    const entries = Object.entries(sectionData);

    if (section === 'root') {
      entries.forEach(([key, value]) => {
        lines.push(`${key}=${formatIniValue(value)}`);
      });
    } else {
      lines.push(`[${section}]`);
      entries.forEach(([key, value]) => {
        lines.push(`${key}=${formatIniValue(value)}`);
      });
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

/**
 * Formats a value for INI output.
 */
function formatIniValue(value: any): string {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return String(value);
}

/**
 * Parses a value from INI format.
 */
function parseIniValue(value: string): string | number | boolean {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // String (remove quotes if present)
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.substring(1, value.length - 1);
  }

  return value;
}

/**
 * Extracts symbols from a parsed object for navigation/indexing.
 */
function extractSymbols(obj: any, path: string): Array<{ name: string; type: string; path: string; line?: number }> {
  const symbols: Array<{ name: string; type: string; path: string; line?: number }> = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return symbols;
  }

  for (const [key, value] of Object.entries(obj)) {
    const type = typeof value === 'object' && value !== null && !Array.isArray(value) ? 'section' : 'key';
    symbols.push({
      name: key,
      type,
      path: `${path}/${key}`,
    });
  }

  return symbols;
}

/**
 * Extracts symbols from a parsed INI object.
 */
function extractIniSymbols(obj: Record<string, any>): Array<{ name: string; type: string; path: string; line?: number }> {
  const symbols: Array<{ name: string; type: string; path: string; line?: number }> = [];

  for (const [section, data] of Object.entries(obj)) {
    if (section === 'root') {
      for (const key of Object.keys(data)) {
        symbols.push({
          name: key,
          type: 'variable',
          path: `<root>/${key}`,
        });
      }
    } else {
      symbols.push({
        name: section,
        type: 'section',
        path: `<root>/${section}`,
      });
      for (const key of Object.keys(data)) {
        symbols.push({
          name: key,
          type: 'variable',
          path: `<root>/${section}/${key}`,
        });
      }
    }
  }

  return symbols;
}
