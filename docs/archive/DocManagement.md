---

# ⚠️  ARCHIVED DOCUMENTATION

**Status:** ARCHIVAL - NOT RELEVANT TO CURRENT CODE WORK
**Archived:** February 8, 2026
**Location:** docs/archive/

This document is preserved for historical reference only. For current documentation, see:
- [Current Docs Index](../README.md)
- [Main README](../../README.md)

---

# 📚 Document Management Rules (Archived)

This document establishes the rules and guidelines for maintaining documentation parity with code changes in the Codebase Cartographer repository.

## Purpose

Documentation is a first-class citizen in this codebase. Outdated documentation is worse than no documentation at all, as it leads developers astray. These rules ensure that documentation remains accurate, useful, and synchronized with the codebase.

**Core Principles:**
- Documentation must match implementation
- Docs update with code, not after
- Clear accountability for doc maintenance
- Automated verification where possible

## When to Update Docs

Documentation updates are **mandatory** in the following scenarios:

### 1. API Changes
- **Public API modifications**: Function signatures, parameters, return types
- **New service methods**: Any additions to `LLMService`, `ConfigManager`, or adapters
- **Hook changes**: Modifications to `useConfig`, `useFeatureAvailability`
- **Type definition changes**: Updates to interfaces, enums, type aliases in `/src/types/`

**Action Required:** Update `docs/API_REFERENCE.md` with new/modified methods and types.

### 2. Configuration Changes
- **New config options**: Additions to `UserPreferences`, `ProviderConfig`, or task mappings
- **Environment variables**: New `.env` variables or config sources
- **Default value changes**: Any modifications to default configurations

**Action Required:** Update `README.md` Configuration section and `docs/ARCHITECTURE.md` Configuration Management section.

### 3. New Features
- **User-facing features**: Any new capability visible to users
- **Provider additions**: New LLM provider integrations
- **Component additions**: New UI components or pages

**Action Required:** Update `README.md` Features list and relevant documentation sections.

### 4. Breaking Changes
- **Removals**: Any deprecated/removed APIs, features, or configs
- **Behavior changes**: Modifications that affect existing functionality
- **Migration requirements**: Steps needed when upgrading versions

**Action Required:** Update all affected docs and add migration notes to relevant sections.

### 5. Architecture Changes
- **Structural changes**: New directories, moved files, reorganized components
- **Pattern changes**: New design patterns or architectural decisions
- **Data flow changes**: Modifications to how data flows through the system

**Action Required:** Update `docs/ARCHITECTURE.md` diagrams and descriptions.

## Doc Review Requirements

Before merging any PR, reviewers must verify:

### Documentation Checklist
- [ ] **API Reference**: All public API changes documented in `docs/API_REFERENCE.md`
- [ ] **README**: User-facing changes reflected in `README.md`
- [ ] **Architecture**: Structural changes updated in `docs/ARCHITECTURE.md`
- [ ] **Code Examples**: All code examples are tested and accurate
- [ ] **Type Safety**: TypeScript examples match actual type definitions
- [ ] **Links**: All internal and external links are valid
- [ ] **Diagrams**: Mermaid diagrams render correctly and reflect current state

### Automated Checks
The following checks run automatically:
- Type checking: `npm run lint` must pass
- Build verification: `npm run build` must succeed
- Link validation: All documentation links must resolve

### Manual Review Steps
1. **Read the diff**: Review documentation changes alongside code changes
2. **Test examples**: Copy code examples from docs and verify they work
3. **Check completeness**: Ensure all affected sections are updated
4. **Verify accuracy**: Confirm technical details match implementation

## Doc-to-Code Parity

Maintaining synchronization between documentation and implementation:

### File Mapping
| Documentation File | Code Coverage | Update Frequency |
|-------------------|---------------|------------------|
| `README.md` | User-facing features, setup, config | Per release |
| `docs/ARCHITECTURE.md` | System design, patterns, data flow | Per architectural change |
| `docs/API_REFERENCE.md` | All public APIs, types, interfaces | Per API change |
| `docs/ADDING_A_PROVIDER.md` | Provider integration patterns | When adapter pattern changes |
| `docs/TROUBLESHOOTING.md` | Common issues and solutions | Per bug fix/feature |
| `docs/DocManagement.md` | Documentation rules themselves | When doc process changes |

### Parity Verification Process

**Before Committing:**
```bash
# 1. Ensure build passes
npm run build

# 2. Type check
npm run lint

# 3. Check for TODO/FIXME comments in docs
grep -r "TODO\|FIXME" docs/

# 4. Verify all referenced files exist
grep -rh "](.*\.md)" docs/ | xargs -I {} sh -c 'test -f "{}" || echo "Missing: {}"'
```

**After Merging:**
- Documentation is deployed with code
- No separate documentation releases
- Docs version matches code version

### Detecting Parity Issues

**Warning Signs:**
- Code examples don't compile
- Type mismatches between docs and implementation
- Outdated version numbers or references
- Missing documentation for new public APIs
- Broken internal links

**Resolution Process:**
1. File issue with `docs` label
2. Assign to original feature author (if available)
3. Update documentation
4. Verify with code examples
5. Close issue when parity restored

## Types of Documentation

### README.md
**Purpose:** Project overview, quick start, and essential information
**Audience:** New users, developers evaluating the project
**Content:**
- Feature overview and capabilities
- Installation and setup instructions
- Quick start guide
- Basic configuration
- Links to detailed documentation

**Maintenance:** Update per release or major feature addition.

### API Reference (`docs/API_REFERENCE.md`)
**Purpose:** Complete technical API documentation
**Audience:** Developers integrating with or extending the codebase
**Content:**
- All public service methods with parameters and return types
- Type definitions and interfaces
- Usage examples for each API
- Error types and handling

**Maintenance:** Update with every API change, no matter how small.

### Architecture Docs (`docs/ARCHITECTURE.md`)
**Purpose:** System design and component relationships
**Audience:** Developers, architects, contributors
**Content:**
- Component hierarchy and relationships
- Design patterns (adapter, factory, etc.)
- Data flow diagrams (Mermaid)
- Configuration architecture
- Error handling strategy

**Maintenance:** Update when structural or architectural changes occur.

### CLAUDE.md
**Purpose:** AI assistant context for code understanding
**Audience:** AI assistants (Claude, ChatGPT, etc.)
**Content:**
- Project context and goals
- Architecture overview
- Development workflow
- Testing conventions
- Deployment process

**Maintenance:** Update when development processes or project structure changes.

### Provider Guide (`docs/ADDING_A_PROVIDER.md`)
**Purpose:** Step-by-step provider integration instructions
**Audience:** Developers adding new LLM providers
**Content:**
- Prerequisites and requirements
- Step-by-step integration guide
- Code templates and examples
- Testing requirements
- Common pitfalls

**Maintenance:** Update when adapter pattern or integration process changes.

### Troubleshooting (`docs/TROUBLESHOOTING.md`)
**Purpose:** Common issues and solutions
**Audience:** Users and developers
**Content:**
- Common error messages and resolutions
- Provider-specific issues
- Configuration problems
- Performance issues

**Maintenance:** Add entries as new issues are discovered and resolved.

## Update Workflow

### Step 1: Identify Affected Docs
Before making code changes, identify which documentation files need updates:
```
Code Change → Affected Docs
├── API changes → API_REFERENCE.md
├── Config changes → README.md, ARCHITECTURE.md
├── New features → README.md, relevant doc sections
├── Breaking changes → All affected docs + migration notes
└── Architecture changes → ARCHITECTURE.md
```

### Step 2: Update Documentation
Make documentation changes **in the same PR** as code changes:
1. Update existing documentation sections
2. Add new sections for new features
3. Update code examples
4. Refresh diagrams if needed
5. Update version numbers and dates

### Step 3: Verify Accuracy
Test all documentation changes:
1. **Code examples**: Copy and run them to verify they work
2. **Type checks**: Ensure TypeScript examples match actual types
3. **Links**: Test all internal and external links
4. **Diagrams**: Verify Mermaid diagrams render correctly
5. **Build**: Run `npm run build` to ensure no breaking changes

### Step 4: Review and Merge
Documentation review is part of the code review process:
1. Reviewer checks documentation alongside code
2. Documentation updates are required for approval
3. Incomplete documentation is a blocking issue
4. Merge only when docs are accurate and complete

### Step 5: Post-Merge Verification
After merging:
1. Documentation is automatically deployed with code
2. No separate documentation releases
3. Version tags apply to both code and docs
4. Monitor for reported documentation issues

## Documentation Standards

### Writing Style
- **Clear and concise**: Get to the point quickly
- **Active voice**: Use "Configure the provider" not "The provider should be configured"
- **Present tense**: Use "Generates text" not "Will generate text"
- **Second person**: Address the reader as "you"
- **Specific examples**: Provide concrete, tested code examples

### Code Examples
All code examples must:
- Be syntactically correct (TypeScript/JavaScript)
- Use actual type definitions from the codebase
- Include imports where necessary
- Be tested and verified to work
- Include comments for clarity
- Follow project coding conventions

### Formatting
- **Markdown**: Use GitHub Flavored Markdown
- **Headings**: Use `#`, `##`, `###` for hierarchy
- **Lists**: Use `-` for unordered, `1.` for ordered
- **Code blocks**: Specify language (```typescript, ```bash)
- **Tables**: Use GitHub-style tables for comparisons
- **Links**: Use relative links for internal docs
- **Diagrams**: Use Mermaid for flowcharts and sequence diagrams

### Version Information
- Always specify the version for API changes
- Use semantic versioning (major.minor.patch)
- Document breaking changes prominently
- Include migration guides for major versions

## Enforcement

### Pre-Commit Hooks
Recommended pre-commit hooks (optional but encouraged):
```bash
# Check for documentation changes when code changes
git diff --name-only --cached | grep -E '\.(ts|tsx)$' && \
echo "Code changed. Please verify documentation is up to date."
```

### CI/CD Integration
The build process includes:
- Type checking (`npm run lint`)
- Build verification (`npm run build`)
- Link checking (manual for now)

### Review Process
- **Documentation blocker**: PRs cannot merge without updated docs
- **Review checklist**: Use the Doc Review Requirements checklist
- **Assignee accountability**: Original author responsible for doc updates

## Escalation

When documentation parity issues are discovered:

1. **Immediate**: File issue with `docs` and `bug` labels
2. **Assessment**: Determine severity and impact
3. **Assignment**: Assign to maintainer or original author
4. **Resolution**: Update documentation and verify
5. **Prevention**: Update this DocManagement.md if process needs improvement

---

**Last Updated:** 2025-02-08
**Version:** 1.0.0
**Maintainer:** Codebase Cartographer Team

For questions or suggestions about documentation practices, please file an issue with the `docs` label.
