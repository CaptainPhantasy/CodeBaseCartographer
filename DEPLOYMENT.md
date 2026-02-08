# Deployment Guide - Codebase Cartographer

This guide covers deploying Codebase Cartographer to various platforms. Codebase Cartographer is a **client-side only** application built with Vite that produces static assets.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Important Limitations](#important-limitations)
3. [Deployment Platforms](#deployment-platforms)
   - [Vercel](#vercel-deployment)
   - [Netlify](#netlify-deployment)
   - [GitHub Pages](#github-pages-deployment)
   - [Static Hosting (General)](#static-hosting-general)
4. [Build Locally](#build-locally)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 20+ installed locally
- Git repository with your code
- (Optional) API keys for LLM providers (see [Environment Variables](#environment-variables))

---

## Important Limitations

### This is a Localhost/Development Tool

Codebase Cartographer is designed primarily as a **local development tool** with the following limitations:

1. **File System Access**: The "Connect Codebase" feature requires access to your local file system. When deployed remotely, users cannot select local folders from their computer to analyze.

2. **API Key Security**: API keys are stored in the browser's localStorage. Anyone with access to the deployed URL can add their own API keys through the Settings UI.

3. **CORS Considerations**: Direct API calls from a browser may encounter CORS restrictions depending on your LLM provider.

4. **Recommended Use Case**: This application is best run locally (`npm run dev`) or hosted on an internal network where team members can access it for analyzing shared codebases.

---

## Environment Variables

### Build-Time vs Runtime

**Build-Time Variables** (deprecated legacy approach):
- `GEMINI_API_KEY` - Legacy variable for backward compatibility
- Baked into the build at compile time
- **NOT recommended** for production deployments

**Runtime Configuration** (recommended):
- Use the in-app Settings UI to configure API providers
- Keys are stored in browser localStorage
- Supports multiple providers (OpenRouter, OpenAI, Anthropic, Google, ElevenLabs)

### For Deployment Platforms

If you need to set default environment variables at build time:

**Vercel**:
1. Go to Project Settings > Environment Variables
2. Add variables with names like `GEMINI_API_KEY`
3. Redeploy after adding

**Netlify**:
1. Go to Site Settings > Environment Variables
2. Add variables with names like `GEMINI_API_KEY`
3. Redeploy after adding

**GitHub Pages**:
1. Go to Repository Settings > Secrets and Variables > Actions
2. Add repository secrets
3. Update your workflow to pass these as build arguments

---

## Deployment Platforms

### Vercel Deployment

Vercel is the recommended platform for deploying Vite applications.

#### Quick Deploy

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your repository

3. **Configure Build Settings** (usually auto-detected):
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables** (optional):
   - Add any API keys as environment variables if needed

5. **Deploy**:
   - Click "Deploy"
   - Your app will be live at `https://your-project.vercel.app`

#### Using the CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

#### Configuration File

The repository includes `vercel.json` with SPA routing configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### Netlify Deployment

Netlify is another excellent option for static site deployment.

#### Quick Deploy

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Import to Netlify**:
   - Go to [netlify.com](https://netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Connect your Git provider

3. **Configure Build Settings**:
   - Build command: `npm run build`
   - Publish directory: `dist`

4. **Deploy**:
   - Click "Deploy site"
   - Your app will be live at `https://your-site.netlify.app`

#### Using the CLI

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
netlify deploy --prod
```

#### Configuration File

The repository includes `netlify.toml` with SPA routing configuration:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

### GitHub Pages Deployment

GitHub Pages provides free hosting from your GitHub repository.

#### Using GitHub Actions (Recommended)

1. **Create `.github/workflows/deploy.yml`**:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

2. **Enable GitHub Pages**:
   - Go to Repository Settings > Pages
   - Source: GitHub Actions

3. **Push and deploy**:
   - Push to your main branch
   - GitHub Actions will build and deploy automatically

#### Manual Deploy

```bash
# Build
npm run build

# Use gh-pages package
npm install -g gh-pages
gh-pages -d dist
```

#### Important: Base Path Configuration

For GitHub Pages, you may need to update `vite.config.ts` if deploying to a subdirectory:

```typescript
export default defineConfig({
  base: '/your-repo-name/', // Add this for GitHub Pages subdirectory
  // ... rest of config
});
```

---

### Static Hosting (General)

You can deploy the built files to any static hosting service.

#### Build the Project

```bash
npm install
npm run build
```

This creates a `dist/` directory with:
- `index.html` - Main entry point
- `assets/` - JavaScript and CSS files

#### Upload to Any Host

Upload the contents of `dist/` to:
- **AWS S3** + CloudFront
- **Azure Static Web Apps**
- **Google Firebase Hosting**
- **Cloudflare Pages**
- Your own web server

#### Server Configuration

Ensure your server is configured for SPA routing:

**Nginx**:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**Apache** (`.htaccess`):
```apache
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

---

## Build Locally

### Development Build

```bash
npm run dev
```

Runs Vite dev server on `http://localhost:3000`

### Production Build

```bash
npm run build
```

Builds to `dist/` directory. Output:

```
dist/
├── index.html           (1.24 kB)
└── assets/
    └── index-[hash].js  (~618 kB gzipped to ~159 kB)
```

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally for testing.

---

## Troubleshooting

### Build Errors

**TypeScript Errors**:
```bash
# Run type check separately
npm run lint
```

**Missing Modules**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Deployment Issues

**Blank page after deployment**:
- Check browser console for errors
- Ensure `base` path in `vite.config.ts` matches your deployment path
- Verify all assets are uploaded (check `/assets/` directory)

**API calls failing**:
- Check CORS settings on your LLM provider
- Verify API keys are correctly configured
- Some providers may require server-side proxy for production use

**Routing issues on refresh**:
- Ensure SPA routing is configured (see vercel.json/netlify.toml above)
- All routes should redirect to index.html for client-side routing

### Platform-Specific Notes

**Vercel**:
- Automatic HTTPS is enabled
- Custom domains can be configured in project settings

**Netlify**:
- Forms and serverless functions available (not needed for this app)
- Automatic branch previews for pull requests

**GitHub Pages**:
- Limited to 1GB bandwidth per month
- Build time limit of 10 minutes
- Supports custom domains

---

## Security Considerations

1. **API Keys**: Never commit API keys to your repository. Use platform-specific environment variables or the in-app Settings UI.

2. **CORS**: If deploying to a custom domain, you may need to configure CORS headers.

3. **Rate Limiting**: Be aware of your LLM provider's rate limits, especially for publicly accessible deployments.

---

## Support

For issues specific to deployment platforms:
- Vercel: [vercel.com/docs](https://vercel.com/docs)
- Netlify: [netlify.com/docs](https://netlify.com/docs)
- GitHub Pages: [docs.github.com/pages](https://docs.github.com/pages)

For issues with Codebase Cartographer itself, please file an issue in the repository.
