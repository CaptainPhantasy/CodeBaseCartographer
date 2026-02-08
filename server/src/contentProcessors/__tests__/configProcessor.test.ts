/**
 * Tests for config processor
 */

import { describe, it, expect } from 'vitest';
import {
  processYaml,
  processToml,
  processIni,
  processEnv,
  processConfigFile
} from '../configProcessor.js';

describe('Config Processor', () => {
  describe('processYaml', () => {
    it('should parse simple YAML', async () => {
      const content = `
name: test
version: 1.0.0
features:
  - feature1
  - feature2
`;
      const result = await processYaml(content);

      expect(result.summary).toContain('YAML');
      expect(result.summary).toContain('3 top-level keys');
      expect(result.extracts).toHaveLength(1);
      expect(result.extracts[0].path).toBe('<root>');
      expect(result.extracts[0].content).toContain('name:');
      expect(result.symbols).toHaveLength(3);
    });

    it('should handle nested YAML structures', async () => {
      const content = `
server:
  port: 3000
  host: localhost
database:
  driver: postgres
  connection:
    host: db.example.com
    port: 5432
`;
      const result = await processYaml(content);

      expect(result.summary).toContain('2 top-level keys');
      expect(result.extracts[0].content).toContain('server:');
      expect(result.extracts[0].content).toContain('port: 3000');
    });

    it('should throw error for invalid YAML', async () => {
      const content = `
invalid: yaml: content: [
`;
      await expect(processYaml(content)).rejects.toThrow('Failed to parse YAML');
    });
  });

  describe('processToml', () => {
    it('should parse simple TOML', async () => {
      const content = `
name = "test"
version = "1.0.0"
port = 3000
`;
      const result = await processToml(content);

      expect(result.summary).toContain('TOML');
      expect(result.summary).toContain('3 top-level keys');
      expect(result.extracts).toHaveLength(1);
      expect(result.symbols).toHaveLength(3);
    });

    it('should handle TOML sections', async () => {
      const content = `
[server]
port = 3000
host = "localhost"

[database]
driver = "postgres"
`;
      const result = await processToml(content);

      expect(result.summary).toContain('2 top-level keys');
      expect(result.extracts[0].content).toContain('server:');
    });

    it('should throw error for invalid TOML', async () => {
      const content = `
invalid toml content [[[
`;
      await expect(processToml(content)).rejects.toThrow('Failed to parse TOML');
    });
  });

  describe('processIni', () => {
    it('should parse simple INI', async () => {
      const content = `
key1 = value1
key2 = value2
`;
      const result = await processIni(content);

      expect(result.summary).toContain('INI');
      expect(result.summary).toContain('2 keys');
      expect(result.extracts[0].content).toContain('key1=value1');
    });

    it('should parse INI with sections', async () => {
      const content = `
[server]
port = 3000
host = localhost

[database]
driver = postgres
`;
      const result = await processIni(content);

      expect(result.summary).toContain('5 keys');
      expect(result.summary).toContain('2 sections');
      expect(result.extracts[0].content).toContain('[server]');
      expect(result.symbols?.find(s => s.name === 'server')).toBeDefined();
    });

    it('should handle comments and empty lines', async () => {
      const content = `
# This is a comment
key1 = value1

; Another comment
key2 = value2
`;
      const result = await processIni(content);

      expect(result.summary).toContain('2 keys');
    });

    it('should parse different value types', async () => {
      const content = `
string = hello
number = 42
bool = true
`;
      const result = await processIni(content);

      expect(result.summary).toContain('3 keys');
    });
  });

  describe('processEnv', () => {
    it('should parse simple ENV', async () => {
      const content = `
KEY1=value1
KEY2=value2
`;
      const result = await processEnv(content);

      expect(result.summary).toContain('Environment');
      expect(result.summary).toContain('2 variables');
      expect(result.extracts[0].content).toContain('KEY1=value1');
    });

    it('should handle comments and empty lines', async () => {
      const content = `
# Comment
KEY1=value1

KEY2=value2
`;
      const result = await processEnv(content);

      expect(result.summary).toContain('2 variables');
    });

    it('should handle export statements', async () => {
      const content = `
export KEY1=value1
export KEY2=value2
`;
      const result = await processEnv(content);

      expect(result.summary).toContain('2 variables');
    });

    it('should handle quoted values', async () => {
      const content = `
KEY1="quoted value"
KEY2='single quoted'
`;
      const result = await processEnv(content);

      expect(result.summary).toContain('2 variables');
      expect(result.extracts[0].content).toContain('KEY1=quoted value');
      expect(result.extracts[0].content).toContain('KEY2=single quoted');
    });
  });

  describe('processConfigFile', () => {
    it('should route YAML files correctly', async () => {
      const content = 'key: value';
      const result = await processConfigFile('config.yaml', content);

      expect(result.summary).toContain('YAML');
    });

    it('should route YML files correctly', async () => {
      const content = 'key: value';
      const result = await processConfigFile('config.yml', content);

      expect(result.summary).toContain('YAML');
    });

    it('should route TOML files correctly', async () => {
      const content = 'key = "value"';
      const result = await processConfigFile('config.toml', content);

      expect(result.summary).toContain('TOML');
    });

    it('should route INI files correctly', async () => {
      const content = 'key = value';
      const result = await processConfigFile('config.ini', content);

      expect(result.summary).toContain('INI');
    });

    it('should route ENV files correctly', async () => {
      const content = 'KEY=value';
      const result = await processConfigFile('.env', content);

      expect(result.summary).toContain('Environment');
    });

    it('should throw error for unsupported file types', async () => {
      await expect(
        processConfigFile('config.unknown', 'content')
      ).rejects.toThrow('Unsupported config file type');
    });
  });
});
