/**
 * File type categories for filtering during codebase ingestion
 */

export type FileCategory =
  | 'code'
  | 'config'
  | 'documentation'
  | 'image'
  | 'infrastructure'
  | 'style'
  | 'web';

export interface FileCategoryInfo {
  id: FileCategory;
  label: string;
  description: string;
  extensions: string[];
  defaultEnabled: boolean;
}

/**
 * File type registry with categories and their associated extensions
 */
export const FILE_CATEGORIES: Record<FileCategory, FileCategoryInfo> = {
  code: {
    id: 'code',
    label: 'Code Files',
    description: 'Source code files (.ts, .js, .py, .java, etc.)',
    extensions: [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.py', '.pyw',
      '.java', '.kt', '.scala', '.groovy',
      '.go', '.rs',
      '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
      '.cs', '.vb',
      '.php', '.rb', '.swift', '.dart',
      '.lua', '.r', '.m', '.mm',
      '.sh', '.bash', '.zsh', '.fish',
      '.pl', '.pm',
      '.vim', '.el', '.lisp'
    ],
    defaultEnabled: true
  },
  config: {
    id: 'config',
    label: 'Config Files',
    description: 'Configuration files (.json, .yaml, .env, etc.)',
    extensions: [
      '.json', '.jsonc',
      '.yaml', '.yml',
      '.xml', '.toml', '.ini', '.cfg', '.conf',
      '.env', '.env.local', '.env.*',
      '.properties',
      '.config', '.conf'
    ],
    defaultEnabled: true
  },
  documentation: {
    id: 'documentation',
    label: 'Documentation',
    description: 'Documentation files (.md, .txt, .pdf, etc.)',
    extensions: [
      '.md', '.markdown', '.mdx',
      '.txt', '.text',
      '.rst', '.adoc',
      '.pdf', '.doc', '.docx'
    ],
    defaultEnabled: true
  },
  image: {
    id: 'image',
    label: 'Images',
    description: 'Image files (.png, .jpg, .svg, etc.)',
    extensions: [
      '.png', '.jpg', '.jpeg', '.gif', '.webp',
      '.svg', '.svgz',
      '.ico', '.bmp', '.tiff', '.psd'
    ],
    defaultEnabled: false
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    description: 'DevOps and CI/CD files (Dockerfile, CI configs, etc.)',
    extensions: [
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.dockerignore',
      'Makefile', 'CMakeLists.txt', 'makefile',
      '.gitignore', '.gitattributes', '.gitmodules',
      '.github', '.gitlab-ci.yml',
      'Jenkinsfile', 'azure-pipelines.yml', 'circleci',
      '.terraform', 'tf',
      'k8s', 'kubernetes',
      'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
      'Cargo.toml', 'Cargo.lock', 'pom.xml', 'build.gradle', 'requirements.txt',
      'go.mod', 'go.sum'
    ],
    defaultEnabled: true
  },
  style: {
    id: 'style',
    label: 'Style Files',
    description: 'Stylesheet files (.css, .scss, .less, etc.)',
    extensions: [
      '.css', '.scss', '.sass', '.less',
      '.styl', '.stylus',
      '.pcss'
    ],
    defaultEnabled: true
  },
  web: {
    id: 'web',
    label: 'Web Files',
    description: 'Web template files (.html, .vue, .svelte, etc.)',
    extensions: [
      '.html', '.htm', '.xhtml',
      '.vue', '.svelte',
      '.jsx', '.tsx',
      '.ejs', '.pug', '.jade', '.hbs', '.mustache',
      '.tmpl', '.tpl'
    ],
    defaultEnabled: true
  }
};

/**
 * Get file category for a given file path
 */
export function getFileCategory(filePath: string): FileCategory | null {
  const fileName = filePath.split('/').pop() || filePath;
  const lowerFileName = fileName.toLowerCase();

  // Check infrastructure files first (they have specific patterns)
  if (FILE_CATEGORIES.infrastructure.extensions.some(ext => {
    if (ext.startsWith('.')) {
      return lowerFileName.endsWith(ext);
    }
    return lowerFileName === ext.toLowerCase() || fileName.includes(ext);
  })) {
    return 'infrastructure';
  }

  // Check other categories by extension
  for (const [category, info] of Object.entries(FILE_CATEGORIES)) {
    if (category === 'infrastructure') continue; // Already checked

    if (info.extensions.some(ext => lowerFileName.endsWith(ext))) {
      return category as FileCategory;
    }
  }

  return null;
}

/**
 * Check if a file is hidden (starts with .)
 */
export function isHiddenFile(filePath: string): boolean {
  const parts = filePath.split('/');
  return parts.some(part => part.startsWith('.') && part !== '.' && part !== '..');
}

/**
 * Filter options for file ingestion
 */
export interface FileFilterOptions {
  includeHidden: boolean;
  enabledCategories: FileCategory[];
}

/**
 * Default filter options
 */
export const DEFAULT_FILTER_OPTIONS: FileFilterOptions = {
  includeHidden: false,
  enabledCategories: Object.values(FILE_CATEGORIES)
    .filter(cat => cat.defaultEnabled)
    .map(cat => cat.id)
};
