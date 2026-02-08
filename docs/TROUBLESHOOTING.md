# 🛠️ Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the Codebase Cartographer application.

## Table of Contents

- [Getting Started](#getting-started)
  - [First Run Issues](#first-run-issues)
  - [Setup Wizard Problems](#setup-wizard-problems)
- [API Key Issues](#api-key-issues)
  - [Invalid API Keys](#invalid-api-keys)
  - [Authentication Failures](#authentication-failures)
  - [Rate Limiting](#rate-limiting)
- [Provider-Specific Problems](#provider-specific-problems)
  - [Google AI (Gemini)](#google-ai-gemini)
  - [OpenAI](#openai)
  - [Anthropic (Claude)](#anthropic-claude)
  - [OpenRouter](#openrouter)
  - [ElevenLabs](#elevenlabs)
- [Build and Runtime Errors](#build-and-runtime-errors)
  - [TypeScript Errors](#typescript-errors)
  - [Import/Export Issues](#importexport-issues)
  - [Configuration Problems](#configuration-problems)
- [Browser Compatibility Issues](#browser-compatibility-issues)
  - [CORS Errors](#cors-errors)
  - localStorage Issues
  - Feature Availability
- [Debugging Tips](#debugging-tips)
  - [Developer Tools](#developer-tools)
  - [Logging](#logging)
  - [Network Tab Analysis](#network-tab-analysis)

---

## Getting Started

### First Run Issues

#### Problem: App doesn't start on first run
**Symptoms:** Blank screen or stuck on loading

**Solutions:**
1. **Clear browser cache**:
   ```bash
   # For Chrome: DevTools → Application → Storage → Clear storage
   # Or use keyboard shortcuts: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
   ```

2. **Check console for errors**:
   - Open Developer Tools (F12)
   - Look for red error messages in Console tab
   - Check for missing files or network errors

3. **Verify Node.js installation**:
   ```bash
   node --version  # Should be 18.0 or higher
   npm --version
   ```

#### Problem: Setup wizard doesn't appear
**Symptoms:** App loads directly into main interface without setup

**Solutions:**
1. **Check localStorage**:
   - Open DevTools → Application → Storage
   - Look for `codebase_cartographer_config`
   - If missing, clear all data to trigger setup

2. **Manual setup**:
   - Go to Settings page
   - Click "Reset Configuration"
   - Restart the application

3. **Check environment variables**:
   ```bash
   # Create .env.local if missing
   echo "VITE_GOOGLE_API_KEY=your_key_here" > .env.local
   ```

### Setup Wizard Problems

#### Problem: Provider selection not working
**Symptoms:** Can't select or save provider choices

**Solutions:**
1. **Check browser permissions**:
   - Ensure localStorage is allowed for the site
   - Check for cookie/storage restrictions

2. **Validate API keys first**:
   - Click "Validate" button next to each provider
   - Ensure keys have correct permissions/scopes

3. **Clear setup data**:
   ```javascript
   // In browser console
   localStorage.removeItem('codebase_cartographer_config');
   location.reload();
   ```

#### Problem: Task mapping doesn't save
**Symptoms**: Selected tasks revert to default after save

**Solutions:**
1. **Check for duplicate mappings**:
   - Each task should have only one primary provider
   - Remove conflicting mappings

2. **Verify provider availability**:
   - Ensure selected provider has required capabilities
   - Check API key validation status

---

## API Key Issues

### Invalid API Keys

#### Problem: "Invalid API key" error
**Symptoms:** Red error message in validation UI

**Solutions by Provider:**

**Google AI:**
1. **Verify key format**: Should start with `AIza`
2. **Check key scope**: Must have "Generative Language API" enabled
3. **Test key manually**:
   ```bash
   curl -X GET "https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY"
   ```

**OpenAI:**
1. **Check key format**: Should start with `sk-`
2. **Verify organization**: Key must belong to your org
3. **Test with simple request**:
   ```bash
   curl -X POST "https://api.openai.com/v1/chat/completions" \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
   ```

**Anthropic:**
1. **Key format**: Should start with `sk-ant-`
2. **Check region**: Some regions have different endpoints
3. **Test with Claude API**:
   ```bash
   curl -X POST "https://api.anthropic.com/v1/messages" \
     -H "x-api-key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"claude-3-sonnet-20240229","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
   ```

**OpenRouter:**
1. **Check key format**: Standard API key format
2. **Verify account billing**: Must have active billing
3. **Test request**:
   ```bash
   curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
     -H "Authorization: Bearer YOUR_KEY" \
     -H "HTTP-Referer: http://localhost:5173" \
     -H "X-Title: Codebase Cartographer" \
     -d '{"model":"openai/gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}'
   ```

### Authentication Failures

#### Problem: 401/403 errors during API calls
**Symptoms:** Authentication errors in network requests

**Solutions:**
1. **Check key expiration**:
   - Go to provider dashboard
   - Generate new keys if expired

2. **Verify API headers**:
   - Check for extra spaces in headers
   - Ensure proper capitalization (Bearer vs bearer)

3. **Cross-origin issues**:
   ```typescript
   // Check CORS settings in your vite.config.ts
   export default defineConfig({
     server: {
       cors: {
         origin: true,
         credentials: true
       }
     }
   });
   ```

#### Problem: Key validation fails but API works
**Symptoms:** Validation UI shows error but direct API calls work

**Solutions:**
1. **Check validation endpoint**:
   - Verify the validation URL is correct
   - Check for required headers in validation requests

2. **Debug validation function**:
   ```javascript
   // In browser console
   window.debugValidation = true;
   // Try to validate a key again
   ```

3. **Clear validation cache**:
   ```javascript
   localStorage.removeItem('validation_cache');
   ```

### Rate Limiting

#### Problem: "Rate limit exceeded" errors
**Symptoms:** 429 status codes in network requests

**Solutions:**
1. **Implement exponential backoff**:
   ```typescript
   async function makeRequestWithRetry(requestFn, maxRetries = 3) {
     let retryCount = 0;
     while (retryCount < maxRetries) {
       try {
         return await requestFn();
       } catch (error) {
         if (error.code === 'RATE_LIMIT' && retryCount < maxRetries - 1) {
           const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
           await new Promise(resolve => setTimeout(resolve, delay));
           retryCount++;
         } else {
           throw error;
         }
       }
     }
   }
   ```

2. **Check usage limits**:
   - Google AI: 60 RPM (requests per minute)
   - OpenAI: Variable by model (check dashboard)
   - Anthropic: Variable by plan
   - OpenRouter: 3000 RPM for most models

3. **Enable fallback providers**:
   - Configure multiple providers
   - Set fallback mappings in task settings

#### Problem: Inconsistent rate limits
**Symptoms:** Works sometimes, fails others with same key

**Solutions:**
1. **Track usage**:
   ```javascript
   // Monitor token usage
   console.log('Tokens used:', result.usage);
   ```

2. **Reduce request size**:
   - Split large prompts into smaller chunks
   - Limit conversation history length

3. **Use different models**:
   - Some models have stricter limits
   - Consider using cheaper/faster models for bulk operations

---

## Provider-Specific Problems

### Google AI (Gemini)

#### Problem: Vision requests fail
**Symptoms:** Error when uploading images

**Solutions:**
1. **Check image format**:
   - Supported formats: PNG, JPEG, WEBP
   - Max size: 4MB per image

2. **Verify image encoding**:
   ```javascript
   function base64FromFile(file) {
     return new Promise((resolve, reject) => {
       const reader = new FileReader();
       reader.onload = () => {
         const base64 = reader.result.split(',')[1];
         resolve(base64);
       };
       reader.onerror = reject;
       reader.readAsDataURL(file);
     });
   }
   ```

3. **Check region restrictions**:
   - Some regions have limited access to Gemini features
   - Verify API availability in your region

#### Problem: Real-time voice connection fails
**Symptoms:** WebSocket connection errors

**Solutions:**
1. **Check WebSocket URL**:
   ```javascript
   // Should be wss://generativelanguage.googleapis.com/v1beta
   // + appropriate path for real-time
   ```

2. **Enable required APIs**:
   - Google Cloud Text-to-Speech API
   - Google Cloud Speech-to-Text API

3. **Check model support**:
   ```typescript
   // Only certain models support real-time
   const realtimeModels = ['gemini-1.5-flash'];
   ```

### OpenAI

#### Problem: Streaming doesn't work
**Symptoms**: No real-time output for long responses

**Solutions:**
1. **Enable streaming in request**:
   ```typescript
   const response = await openai.chat.completions.create({
     model: 'gpt-4',
     messages: [{ role: 'user', content: prompt }],
     stream: true  // This enables streaming
   });

   for await (const chunk of response) {
     const content = chunk.choices[0]?.delta?.content;
     if (content) {
       // Update UI with content
     }
   }
   ```

2. **Check UI implementation**:
   - Use `stream: true` in adapter
   - Implement proper event handlers

3. **Verify model support**:
   - Check if your model supports streaming
   - Some models have streaming disabled by default

#### Problem: TTS generates no audio
**Symptoms**: TTS requests succeed but no audio output

**Solutions:**
1. **Check voice availability**:
   ```typescript
   const voices = await openai.audio.speech.listVoices();
   console.log(voices.data);
   ```

2. **Verify audio format**:
   - MP3 is most widely supported
   - Check for proper MIME type in Audio element

3. **Test with minimal example**:
   ```javascript
   const response = await openai.audio.speech.create({
     model: 'tts-1',
     voice: 'alloy',
     input: 'Hello world'
   });

   const blob = new Blob([response], { type: 'audio/mpeg' });
   const audioUrl = URL.createObjectURL(blob);
   const audio = new Audio(audioUrl);
   audio.play();
   ```

### Anthropic (Claude)

#### Problem: Thinking mode not working
**Symptoms**: No thinking content in responses

**Solutions:**
1. **Enable thinking in request**:
   ```typescript
   const response = await anthropic.messages.create({
     model: 'claude-3-sonnet-20240229',
     max_tokens: 1000,
     messages: [
       {
         role: 'user',
         content: 'Explain quantum computing',
         // Add thinking request
       }
     ]
   });
   ```

2. **Check model support**:
   - Only certain models support thinking
   - Verify your plan includes thinking features

3. **Parse response correctly**:
   ```typescript
   // Look for thinking content in stop reason
   if (response.stop_reason === 'end_turn' && response.content) {
     const thinkingContent = response.content.find(c => c.type === 'text');
     console.log(thinkingContent.text);
   }
   ```

#### Problem: Code generation quality poor
**Symptoms**: Generated code doesn't work or is inefficient

**Solutions:**
1. **Use proper system prompt**:
   ```typescript
   const systemPrompt = `
   You are an expert software engineer. Generate clean, efficient, well-documented code.
   Follow best practices for the language and use appropriate libraries.
   Include comments explaining complex logic.
   `;
   ```

2. **Specify programming language**:
   - Always include language in prompt
   - Use specific version if needed

3. **Break down complex tasks**:
   ```typescript
   // Instead of one large prompt
   // Break into smaller, focused requests
   ```

### OpenRouter

#### Problem: Different models behave inconsistently
**Symptoms**: Same request gives different results across models

**Solutions:**
1. **Use model-specific prompts**:
   ```typescript
   // Adjust prompt based on model
   const prompt = model.includes('gpt-4')
     ? 'You are a helpful assistant...'
     : 'Act as an AI assistant...';
   ```

2. **Set consistent parameters**:
   ```typescript
   const baseParams = {
     temperature: 0.7,
     max_tokens: 1000,
     // Other consistent params
   };
   ```

3. **Check model documentation**:
   - Each model has different strengths
   - Choose appropriate model for task

#### Problem: Usage tracking inaccurate
**Symptoms**: Dashboard usage doesn't match actual requests

**Solutions:**
1. **Enable detailed logging**:
   ```typescript
   console.log('Request cost:', calculateCost(response, model));
   ```

2. **Track locally**:
   ```typescript
   function trackUsage(provider, model, tokens) {
     // Store in localStorage or send to tracking service
   }
   ```

3. **Verify with provider dashboard**:
   - Check OpenRouter usage dashboard
   - Compare with local tracking

### ElevenLabs

#### Problem: TTS audio too fast/slow
**Symptoms**: Audio plays at incorrect speed

**Solutions:**
1. **Adjust speed parameter**:
   ```typescript
   const options = {
     speed: 1.0, // 1.0 = normal, 0.25 = 4x slower, 4.0 = 4x faster
   };
   ```

2. **Use voice presets**:
   ```typescript
   const preset = {
     voice: 'Rachel', // Choose voice wisely
     speed: 1.1,
     style: 'chat'
   };
   ```

3. **Test with different voices**:
   - Some voices have natural speeds
   - Adjust based on voice characteristics

#### Problem: API quota exceeded
**Symptoms**: "You've reached your quota" errors

**Solutions:**
1. **Check character limits**:
   - Free plan: 10,000 characters/month
   - Paid plans: Higher limits

2. **Optimize text**:
   - Remove unnecessary words
   - Use shorter prompts

3. **Cache audio**:
   ```javascript
   // Store generated audio in localStorage
   const cacheKey = `audio_${textHash}`;
   if (cache.has(cacheKey)) {
     return cache.get(cacheKey);
   }
   ```

---

## Build and Runtime Errors

### TypeScript Errors

#### Problem: Type mismatches in adapter
**Symptoms**: TypeScript compilation errors

**Solutions:**
1. **Check interface implementation**:
   ```typescript
   // Ensure all abstract methods are implemented
   export class CustomAdapter extends BaseLLMAdapter {
     generateText(prompt: string, options?: TextGenerationOptions): Promise<TextGenerationResult> {
       // Implementation
     }
     // ... other required methods
   }
   ```

2. **Fix generic type issues**:
   ```typescript
   // Use proper generic types
   async generateStructuredOutput<T>(
     prompt: string,
     schema: object,
     options?: StructuredOutputOptions
   ): Promise<T> {
     // Implementation
   }
   ```

3. **Update type definitions**:
   ```typescript
   // Add any new types to capabilities.ts
   export type NewCapability = 'new_feature';
   ```

#### Problem: Missing imports
**Symptoms**: "Module not found" errors

**Solutions:**
1. **Check relative imports**:
   ```typescript
   // Use correct relative paths
   import { BaseLLMAdapter } from '../adapters/base';
   import type { TaskType } from '../types/capabilities';
   ```

2. **Update barrel exports**:
   ```typescript
   // Update index.ts to export new modules
   export * from './custom-adapter';
   ```

3. **Verify module resolution**:
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"]
       }
     }
   }
   ```

### Import/Export Issues

#### Problem: Configuration import fails
**Symptoms**: JSON parsing errors when importing config

**Solutions:**
1. **Validate JSON format**:
   ```javascript
   try {
     const config = JSON.parse(configString);
     console.log('Valid config:', config);
   } catch (error) {
     console.error('Invalid JSON:', error);
   }
   ```

2. **Check version compatibility**:
   ```typescript
   // Handle version mismatches
   if (importedConfig.version !== CONFIG_VERSION) {
     console.warn('Version mismatch, migrating config...');
     // Migration logic
   }
   ```

3. **Sanitize input**:
   ```javascript
   function sanitizeConfig(config) {
     // Remove sensitive data
     config.providers.forEach(p => delete p.apiKey);
     return config;
   }
   ```

#### Problem: Exported configuration too large
**Symptoms**: Browser freezes or crashes when exporting

**Solutions:**
1. **Reduce data size**:
   ```typescript
   function exportMinimalConfig() {
     return {
       version: config.version,
       providers: config.providers.map(p => ({
         providerId: p.providerId,
         isEnabled: p.isEnabled
       })),
       preferences: config.preferences
     };
   }
   ```

2. **Use compression**:
   ```javascript
   function compressConfig(config) {
     const json = JSON.stringify(config);
     return btoa(json); // Base64 encoding
   }
   ```

### Configuration Problems

#### Problem: Settings not saving
**Symptoms**: Changes revert after refresh

**Solutions:**
1. **Check localStorage permissions**:
   ```javascript
   // Test localStorage access
   try {
     localStorage.setItem('test', 'test');
     localStorage.removeItem('test');
   } catch (error) {
     console.error('localStorage blocked:', error);
   }
   ```

2. **Verify event listeners**:
   ```typescript
   // Ensure subscribers are properly set
   configManager.subscribe((config) => {
     console.log('Config updated:', config);
   });
   ```

3. **Check for exceptions**:
   ```javascript
   // Wrap save operations in try-catch
   try {
     configManager.setProviderKey(providerId, apiKey);
   } catch (error) {
     console.error('Save failed:', error);
   }
   ```

#### Problem: Configuration lost on update
**Symptoms**: Settings disappear after app update

**Solutions:**
1. **Implement version migration**:
   ```typescript
   function migrateConfig(oldConfig) {
     // Add migration logic here
     return {
       ...oldConfig,
       version: CONFIG_VERSION
     };
   }
   ```

2. **Backup configuration**:
   ```javascript
   function backupConfig() {
     const config = configManager.exportConfig();
     const backup = {
       timestamp: new Date().toISOString(),
       config
     };
     localStorage.setItem('config_backup', JSON.stringify(backup));
   }
   ```

3. **Use multiple storage backends**:
   ```javascript
   // Fallback to sessionStorage if localStorage fails
   const storage = window.localStorage || window.sessionStorage;
   ```

---

## Browser Compatibility Issues

### CORS Errors

#### Problem: Cross-origin requests blocked
**Symptoms**: "CORS policy" errors in console

**Solutions:**
1. **Check vite.config.ts**:
   ```typescript
   export default defineConfig({
     server: {
       proxy: {
         '/api': {
           target: 'https://api.example.com',
           changeOrigin: true,
           secure: false,
           configure: (proxy, _options) => {
             proxy.on('error', (err, _req, _res) => {
               console.log('Proxy Error', err);
             });
             proxy.on('proxyReq', (proxyReq, req, _res) => {
               console.log('Sending Request to the Target:', req.method, req.url);
             });
             proxy.on('proxyRes', (proxyRes, req, _res) => {
               console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
             });
           }
         }
       }
     }
   });
   ```

2. **Use browser extension** (temporary fix):
   - CORS Unblock extension
   - Allow origin extension

3. **Configure server-side proxy**:
   ```javascript
   // For production, use a reverse proxy
   const express = require('express');
   const axios = require('axios');
   const app = express();

   app.use('/proxy', async (req, res) => {
     try {
       const response = await axios.get('https://api.target.com' + req.url);
       res.json(response.data);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

#### Problem: localStorage not available
**Symptoms**: Errors when accessing localStorage

**Solutions:**
1. **Check browser support**:
   ```javascript
   // Check for localStorage availability
   function isLocalStorageAvailable() {
     try {
       const storage = window.localStorage;
       const test = '__test__';
       storage.setItem(test, test);
       storage.removeItem(test);
       return true;
     } catch {
       return false;
     }
   }
   ```

2. **Use alternative storage**:
   ```javascript
   const storage = {
     getItem: (key) => {
       try {
         return localStorage.getItem(key);
       } catch {
         return sessionStorage.getItem(key);
       }
     },
     setItem: (key, value) => {
       try {
         localStorage.setItem(key, value);
       } catch {
         sessionStorage.setItem(key, value);
       }
     }
   };
   ```

3. **Implement memory storage**:
   ```javascript
   const memoryStorage = new Map();
   function getMemoryStorage() {
     if (!isLocalStorageAvailable()) {
       return {
         getItem: (key) => memoryStorage.get(key),
         setItem: (key, value) => memoryStorage.set(key, value)
       };
     }
     return localStorage;
   }
   ```

### localStorage Issues

#### Problem: Storage quota exceeded
**Symptoms**: "QuotaExceededError" in console

**Solutions:**
1. **Check storage usage**:
   ```javascript
   function checkStorageUsage() {
     const usage = JSON.stringify(localStorage).length;
     const quota = 5 * 1024 * 1024; // 5MB default
     console.log(`Used: ${usage} / ${quota} bytes`);
     console.log(`Usage: ${Math.round((usage / quota) * 100)}%`);
   }
   ```

2. **Implement cleanup**:
   ```javascript
   function cleanupStorage() {
     const keys = Object.keys(localStorage);
     const oneWeek = 7 * 24 * 60 * 60 * 1000;
     const now = Date.now();

     keys.forEach(key => {
       if (key.startsWith('temp_') || key.startsWith('cache_')) {
         const timestamp = parseInt(localStorage.getItem(key + '_timestamp') || '0');
         if (now - timestamp > oneWeek) {
           localStorage.removeItem(key);
           localStorage.removeItem(key + '_timestamp');
         }
       }
     });
   }
   ```

3. **Compress stored data**:
   ```javascript
   function compressAndSave(key, data) {
     const compressed = LZString.compress(JSON.stringify(data));
     localStorage.setItem(key, compressed);
   }

   function loadAndDecompress(key) {
     const compressed = localStorage.getItem(key);
     if (compressed) {
       return JSON.parse(LZString.decompress(compressed));
     }
     return null;
   }
   ```

### Feature Availability

#### Problem: Some features don't work in certain browsers
**Symptoms**: Audio, video, or real-time features fail

**Solutions:**
1. **Check browser support**:
   ```javascript
   function checkBrowserSupport() {
     const features = {
       audioContext: 'AudioContext' in window,
       webrtc: 'RTCPeerConnection' in window,
       serviceWorker: 'serviceWorker' in navigator,
       indexedDB: 'indexedDB' in window
     };

     console.log('Browser Support:', features);
     return features;
   }
   ```

2. **Provide fallbacks**:
   ```javascript
   function playAudioWithFallback(audioData) {
     try {
       // Try Web Audio API
       const audioContext = new AudioContext();
       const source = audioContext.createBufferSource();
       // ... implementation
     } catch (error) {
       // Fallback to HTML Audio
       const audio = new Audio(`data:audio/mpeg;base64,${audioData}`);
       audio.play();
     }
   }
   ```

3. **Detect and warn**:
   ```javascript
   function checkRequiredFeatures() {
     const required = ['audioContext'];
     const missing = required.filter(feature => !(window[feature]));

     if (missing.length > 0) {
       alert(`Your browser doesn't support required features: ${missing.join(', ')}`);
       return false;
     }
     return true;
   }
   ```

---

## Debugging Tips

### Developer Tools

#### Problem: Hard to debug async operations
**Solutions:**
1. **Enable async stack traces**:
   ```javascript
   // In vite.config.ts
   export default defineConfig({
     define: {
       'globalThis.__DEV__': true,
     }
   });
   ```

2. **Use breakpoints**:
   ```javascript
   // Add debug checkpoints
   function debugPoint(label, data) {
     if (process.env.NODE_ENV === 'development') {
       console.log(`[DEBUG] ${label}:`, data);
     }
   }
   ```

3. **Network logging**:
   ```javascript
   // Log all API requests
   const originalFetch = window.fetch;
   window.fetch = async (...args) => {
     console.log('API Request:', args[0], args[1]);
     const response = await originalFetch(...args);
     const clone = response.clone();
     console.log('API Response:', clone.status);
     return response;
   };
   ```

### Logging

#### Problem: Not enough information in error messages
**Solutions:**
1. **Enhanced error logging**:
   ```typescript
   class EnhancedLogger {
     static logApiCall(provider, method, params, response) {
       console.log(`[${provider}] ${method}:`, {
         request: params,
         response: {
           status: response?.status,
           data: response?.data,
           duration: response?.headers?.get('X-Response-Time')
         }
       });
     }

     static logError(error, context) {
       console.error(`[ERROR] ${context}`, {
         message: error.message,
         code: error.code,
         provider: error.providerId,
         stack: error.stack,
         context
       });
     }
   }
   ```

2. **Performance monitoring**:
   ```javascript
   const performanceMonitor = {
     start: (label) => ({
       label,
       startTime: performance.now()
     }),
     end: (metric) => {
       const duration = performance.now() - metric.startTime;
       console.log(`[PERF] ${metric.label}: ${duration.toFixed(2)}ms`);
       return duration;
     }
   };

   // Usage
   const apiCall = performanceMonitor.start('generateText');
   try {
     const result = await llmService.generateText(prompt);
     performanceMonitor.end(apiCall);
     return result;
   } catch (error) {
     performanceMonitor.end(apiCall);
     throw error;
   }
   ```

3. **Debug mode toggle**:
   ```javascript
   const debugMode = {
     enabled: false,
     toggle: () => {
       debugMode.enabled = !debugMode.enabled;
       console.log('Debug mode:', debugMode.enabled ? 'ON' : 'OFF');
     },
     log: (...args) => {
       if (debugMode.enabled) {
         console.log('[DEBUG]', ...args);
       }
     }
   };

   // Enable with keyboard shortcut
   document.addEventListener('keydown', (e) => {
     if (e.key === 'D' && e.ctrlKey) {
       e.preventDefault();
       debugMode.toggle();
     }
   });
   ```

### Network Tab Analysis

#### Problem: API calls failing but no clear error
**Solutions:**
1. **Inspect request headers**:
   ```javascript
   // Check authentication headers
   const requestHeaders = {};
   const token = localStorage.getItem('auth_token');
   if (token) {
     requestHeaders['Authorization'] = `Bearer ${token}`;
   }

   console.log('Request Headers:', requestHeaders);
   ```

2. **Analyze response body**:
   ```javascript
   // Log response errors
   fetch('/api/endpoint')
     .then(async (response) => {
       const data = await response.json();
       if (!response.ok) {
         console.error('API Error:', {
           status: response.status,
           statusText: response.statusText,
           error: data.error
         });
         throw new Error(data.error.message);
       }
       return data;
     });
   ```

3. **Check timing**:
   ```javascript
   // Monitor request timing
   const observer = new PerformanceObserver((list) => {
     for (const entry of list.getEntries()) {
       if (entry.name.includes('api')) {
         console.log('API Performance:', {
           name: entry.name,
           duration: entry.duration,
           transferSize: entry.transferSize
         });
       }
     }
   });
   observer.observe({ entryTypes: ['resource'] });
   ```

---

## Common Error Patterns

### 1. Promise Rejection Unhandled
**Symptoms:** Warnings in console about unhandled promise rejections

**Solution:**
```typescript
// Always handle async operations
async function generateResponse(prompt) {
  try {
    const result = await llmService.generateText(prompt);
    return result;
  } catch (error) {
    console.error('Generation failed:', error);
    // Show user-friendly error
    showError('Failed to generate response. Please try again.');
    throw error; // Re-throw if needed
  }
}
```

### 2. Memory Leaks
**Symptoms:** Memory usage increases over time

**Solution:**
```typescript
// Clean up event listeners
useEffect(() => {
  const handler = (event) => console.log(event);
  window.addEventListener('resize', handler);

  return () => {
    window.removeEventListener('resize', handler);
  };
}, []);

// Clear caches when not needed
useEffect(() => {
  return () => {
    llmService.clearCache();
  };
}, []);
```

### 3. State Staleness
**Symptoms:** Component state doesn't update after configuration changes

**Solution:**
```typescript
// Use proper dependency arrays in useEffect
useEffect(() => {
  const config = configManager.getFullConfig();
  setConfig(config);

  // Re-subscribe on changes
  const unsubscribe = configManager.subscribe((newConfig) => {
    setConfig(newConfig);
  });

  return unsubscribe;
}, []); // Empty array = run once on mount
```

### 4. Race Conditions
**Symptoms**: Inconsistent results when multiple operations happen simultaneously

**Solution:**
```typescript
// Use AbortController for cancellation
let currentRequest = null;

async function fetchWithCancellation(url) {
  // Cancel previous request
  if (currentRequest) {
    currentRequest.abort();
  }

  const controller = new AbortController();
  currentRequest = controller;

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    currentRequest = null;
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
    }
    throw error;
  }
}
```

---

## Getting Help

If you continue to experience issues:

1. **Check GitHub Issues**: Search existing issues or create a new one
2. **Provide Debug Information**: Include:
   - Browser and version
   - Error messages with full stack traces
   - Steps to reproduce
   - Browser console logs
   - Network tab screenshots

3. **Test in Incognito Mode**: Eliminate extension conflicts
4. **Try Different Browser**: Rule out browser-specific issues
5. **Check Provider Status**: Verify provider APIs are operational

Remember to **reproduce issues consistently** before reporting, and provide as much detail as possible to help diagnose the problem quickly.