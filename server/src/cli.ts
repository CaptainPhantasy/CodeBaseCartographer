#!/usr/bin/env node
/**
 * CLI interface for CodeBase Cartographer
 * Provides command-line tools for analyzing and exporting codebase visualizations
 */

import { cac } from 'cac';
import { readdir, readFile, stat } from 'fs/promises';
import { join, relative, extname } from 'path';
import { existsSync } from 'fs';
import { analyzeCodebase } from './analyzer';
import { exportDiagram } from './exporter';

const cli = cac('codebase-cartographer');

/**
 * Main analyze command
 */
cli
  .command('analyze [path]', 'Analyze a codebase and generate visualization')
  .option('-e, --export <file>', 'Export to file (PNG, SVG, JSON)')
  .option('-f, --format <format>', 'Output format (png, svg, json)')
  .option('-o, --output <file>', 'Output file path')
  .option('-c, --complexity', 'Include complexity metrics')
  .option('-d, --depth <number>', 'Maximum dependency depth', { default: '10' })
  .option('--ignore <patterns...>', 'Ignore patterns (e.g., node_modules dist)')
  .option('--include-hidden', 'Include hidden files and directories (starting with .)')
  .action(async (path: string = '.', options: any) => {
    try {
      const targetPath = join(process.cwd(), path);

      if (!existsSync(targetPath)) {
        console.error(`Error: Path "${targetPath}" does not exist`);
        process.exit(1);
      }

      console.log(`Analyzing codebase at: ${targetPath}`);

      const graphData = await analyzeCodebase(targetPath, {
        maxDepth: parseInt(options.depth) || 10,
        ignorePatterns: options.ignore || ['node_modules', 'dist', 'build', '.git'],
        includeComplexity: options.complexity || false,
        includeHidden: options.includeHidden || false
      });

      console.log(`\nAnalysis complete:`);
      console.log(`  Files analyzed: ${graphData.nodes.length}`);
      console.log(`  Dependencies found: ${graphData.links.length}`);

      if (options.complexity) {
        const avgComplexity = graphData.nodes.reduce((sum, node) =>
          sum + (node.data.complexity?.cyclomatic || 0), 0) / graphData.nodes.length;
        console.log(`  Average cyclomatic complexity: ${avgComplexity.toFixed(2)}`);
      }

      // Handle export
      const outputFile = options.export || options.output;
      const format = options.format || (outputFile ? extname(outputFile).slice(1) : null);

      if (outputFile && format) {
        console.log(`\nExporting to ${outputFile}...`);
        await exportDiagram(graphData, outputFile, format);
        console.log(`Export complete: ${outputFile}`);
      } else if (!outputFile) {
        console.log('\nJSON output:');
        console.log(JSON.stringify(graphData, null, 2));
      }

    } catch (error) {
      console.error('Analysis failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Export command for existing graphs
 */
cli
  .command('export <input> <output>', 'Export an existing graph file')
  .option('-f, --format <format>', 'Output format (png, svg, json)')
  .action(async (input: string, output: string, options: any) => {
    try {
      const format = options.format || extname(output).slice(1);
      const inputPath = join(process.cwd(), input);

      if (!existsSync(inputPath)) {
        console.error(`Error: Input file "${inputPath}" does not exist`);
        process.exit(1);
      }

      const graphData = JSON.parse(await readFile(inputPath, 'utf-8'));
      await exportDiagram(graphData, output, format);

      console.log(`Exported to ${output}`);
    } catch (error) {
      console.error('Export failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

/**
 * Info command
 */
cli
  .command('info [path]', 'Show information about a codebase')
  .action(async (path: string = '.') => {
    try {
      const targetPath = join(process.cwd(), path);

      if (!existsSync(targetPath)) {
        console.error(`Error: Path "${targetPath}" does not exist`);
        process.exit(1);
      }

      const stats = await getCodebaseStats(targetPath);

      console.log('\nCodebase Information:');
      console.log(`  Path: ${targetPath}`);
      console.log(`  Total files: ${stats.totalFiles}`);
      console.log(`  Total lines: ${stats.totalLines}`);
      console.log(`  Languages: ${Object.entries(stats.languages).map(([lang, count]) =>
        `${lang} (${count})`
      ).join(', ')}`);
    } catch (error) {
      console.error('Info failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

cli.help();

// Get version from package.json (ES module compatible)
const getVersion = async (): Promise<string> => {
  try {
    const pkgPath = new URL('../package.json', import.meta.url);
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

getVersion().then(version => {
  cli.version(version);
  cli.parse();
}).catch(() => {
  cli.version('0.0.0');
  cli.parse();
});

/**
 * Get codebase statistics
 */
async function getCodebaseStats(
  dirPath: string,
  ignorePatterns: string[] = ['node_modules', 'dist', 'build', '.git']
): Promise<{
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
}> {
  const files = await readdir(dirPath, { withFileTypes: true });
  let totalFiles = 0;
  let totalLines = 0;
  const languages: Record<string, number> = {};

  for (const file of files) {
    if (ignorePatterns.includes(file.name)) continue;

    const fullPath = join(dirPath, file.name);

    if (file.isDirectory()) {
      const subdirStats = await getCodebaseStats(fullPath, ignorePatterns);
      totalFiles += subdirStats.totalFiles;
      totalLines += subdirStats.totalLines;
      Object.entries(subdirStats.languages).forEach(([lang, count]) => {
        languages[lang] = (languages[lang] || 0) + count;
      });
    } else if (file.isFile()) {
      const ext = extname(file.name);
      const languageMap: Record<string, string> = {
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.py': 'Python',
        '.rs': 'Rust',
        '.go': 'Go',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.cs': 'C#',
        '.rb': 'Ruby',
        '.php': 'PHP'
      };

      const lang = languageMap[ext];
      if (lang) {
        const content = await readFile(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        totalFiles++;
        totalLines += lines;
        languages[lang] = (languages[lang] || 0) + 1;
      }
    }
  }

  return { totalFiles, totalLines, languages };
}
