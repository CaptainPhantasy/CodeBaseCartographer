---

# ⚠️  ARCHIVED DOCUMENTATION

**Status:** ARCHIVAL - NOT RELEVANT TO CURRENT CODE WORK  
**Archived:** February 8, 2026  
**Location:** docs/archive/

This document is preserved for historical reference only. For current documentation, see:
- [Current Docs Index](../README.md)
- [Main README](../../README.md)

---
# File Extension Support Documentation

## Overview

This document provides accurate information about the file extension support in CodeBaseCartographer's file type registry system.

## Actual Extension Count

**Total Unique File Extensions: 58**

As of the current implementation, the file type registry (`server/src/fileTypeRegistry.ts`) supports **58 unique file extensions** across 7 categories.

## Extension Breakdown by Category

### Code Files (11 handlers, 20 extensions)
- **JavaScript/TypeScript**: `.ts`, `.tsx`, `.js`, `.jsx`
- **Python**: `.py`, `.pyw`
- **Java**: `.java`
- **Go**: `.go`
- **Rust**: `.rs`
- **PHP**: `.php`, `.phtml`
- **Ruby**: `.rb`
- **C/C++**: `.c`, `.cpp`, `.cc`, `.cxx`, `.h`, `.hpp`
- **C#**: `.cs`, `.csx`
- **Swift**: `.swift`
- **Kotlin**: `.kt`, `.kts`

### Config & Data Files (8 handlers, 8 extensions)
- **JSON**: `.json`
- **YAML**: `.yaml`, `.yml`
- **XML**: `.xml`
- **TOML**: `.toml`
- **INI**: `.ini`
- **Environment**: `.env`
- **CSV**: `.csv`
- **SQL**: `.sql`

### Documentation Files (4 handlers, 4 extensions)
- **Markdown**: `.md`
- **Plain Text**: `.txt`
- **reStructuredText**: `.rst`
- **PDF**: `.pdf` (binary)

### Style & Web Files (3 handlers, 6 extensions)
- **CSS**: `.css`
- **Sass/SCSS**: `.scss`, `.sass`
- **HTML**: `.html`, `.htm`
- **SVG**: `.svg`

### Image Files (6 handlers, 6 extensions)
- **PNG**: `.png`
- **JPEG**: `.jpg`, `.jpeg`
- **GIF**: `.gif`
- **WebP**: `.webp`
- **ICO**: `.ico`
- **BMP**: `.bmp`

### Binary Files (2 handlers, 9 extensions)
- **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, `.7z`
- **Executables/Libraries**: `.exe`, `.dll`, `.so`, `.dylib`

### Infrastructure Files (special handling)
Infrastructure files are detected by filename patterns rather than extensions:
- **Docker**: `Dockerfile`, `*.dockerfile`, `docker-compose*.yml`
- **Version Control**: `.gitignore`, `.dockerignore`, `.npmignore`
- **CI/CD**: `.gitlab-ci.yml`, `.github/workflows/*`, `Jenkinsfile`, `Jenkinsfile.*`
- **Package Managers**: `package.json`, `requirements.txt`, `Pipfile`, `pyproject.toml`
- **Build Systems**: `go.mod`, `go.sum`, `Cargo.toml`, `Cargo.lock`, `pom.xml`
- **Gradle**: `build.gradle`, `settings.gradle`
- **Version Files**: `.nvmrc`, `.node-version`, `.ruby-version`, `.python-version`
- **Editor Configs**: `.editorconfig`, `.eslintrc*`, `.prettierrc*`

## Verification

To verify the current extension count, run:

```bash
grep -E "extensions:\s*\[" /Volumes/Storage/CodeBaseCartographer/server/src/fileTypeRegistry.ts | \
  grep -o "'\.[a-z0-9]+'" | tr -d "'" | sort -u | wc -l
```

Or use the Node.js script in the repository root:

```bash
node -e "
import('./server/dist/fileTypeRegistry.js').then(m => {
  console.log('Total extensions:', m.getAllExtensions().length);
  console.log('Extensions:', m.getAllExtensions().join(', '));
});
"
```

## Implementation Notes

1. **All extensions are unique** - The `getAllExtensions()` function returns a de-duplicated set
2. **Categories are mapped** - Each extension is associated with a specific category for visualization
3. **Binary detection** - Extensions marked as `binary: true` are skipped for text processing
4. **Extensible** - New extensions can be added to the registry by following the existing pattern

## Previous Audit Claims

Some external audits may have incorrectly claimed "156+ file extensions" or "114 unique extensions". The actual implementation has always supported 58 unique file extensions as defined in the `DEFAULT_REGISTRY` constant in `server/src/fileTypeRegistry.ts`.

If you encounter any documentation claiming different numbers, please update it to reflect this accurate count.

## Date of Verification

This documentation was verified on 2025-02-08 with the current implementation in the repository.
