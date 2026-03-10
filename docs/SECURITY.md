# Security Documentation

## Overview

Codebase Cartographer implements multiple layers of security to protect API keys and sensitive configuration data. This document describes the security architecture, best practices, and usage guidelines.

**IMPORTANT**: This tool is designed for localhost development only. For production deployments, implement server-side key management and additional security measures.

---

## Table of Contents

- [Security Architecture](#security-architecture)
- [Encryption Implementation](#encryption-implementation)
- [Session-Only Storage](#session-only-storage)
- [Auto-Lock Feature](#auto-lock-feature)
- [PIN Management](#pin-management)
- [Key Rotation](#key-rotation)
- [Security Best Practices](#security-best-practices)

---

## Security Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                               │
├─────────────────────────────────────────────────────────────────┤
│ 1. AES-GCM Encryption (Web Crypto API)                          │
│    - 256-bit keys derived via PBKDF2 (100,000 iterations)       │
│    - Unique salt per encryption                                  │
│    - 96-bit initialization vector (IV)                          │
├─────────────────────────────────────────────────────────────────┤
│ 2. Session Storage (PIN)                                        │
│    - PIN stored in sessionStorage (cleared on browser close)    │
│    - Decrypted keys cached in memory only                       │
├─────────────────────────────────────────────────────────────────┤
│ 3. Auto-Lock (Inactivity Detection)                             │
│    - Automatic lock after 15 minutes of inactivity              │
│    - Clears all decrypted keys from memory                      │
├─────────────────────────────────────────────────────────────────┤
│ 4. Session-Only Keys (Optional)                                 │
│    - Keys never written to localStorage                         │
│    - Lost on browser close or tab close                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Encryption Implementation

### Algorithm: AES-GCM

We use the **Web Crypto API** with **AES-GCM** (Advanced Encryption Standard - Galois/Counter Mode):

- **Key Derivation**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (configurable via `PBKDF2_ITERATIONS`)
- **Key Length**: 256 bits
- **Salt Length**: 16 bytes (128 bits)
- **IV Length**: 12 bytes (96 bits)

### Encryption Format

Encrypted keys are stored in the format:

```
ENC:salt:iv:encrypted_data
```

Example:
```
ENC:YWJjZGVmZ2hpamtsbW5vcA:xYz123456789ABC:U2FsdGVkX1+vupppZksvRf5pq5g5XjFRlipRkwB0K1Y96Qsv2Lm+31cmzaAILwytJMo81
```

### Code Examples

#### Encrypting a Key

```typescript
import { encryptData } from './cryptoUtils';

const result = await encryptData('sk-ant-api123-...', '123456');
console.log(result.storageString); // ENC:...
```

#### Decrypting a Key

```typescript
import { decryptData } from './cryptoUtils';

const decrypted = await decryptData('ENC:...', '123456');
console.log(decrypted); // sk-ant-api123-...
```

---

## Session-Only Storage

Session-only storage allows API keys to be **never persisted** to localStorage. These keys:

- Exist only in memory during the active session
- Are cleared when the browser closes or tab closes
- Must be re-entered on each session launch

### Usage

```typescript
import { getConfigManager } from './configManager';

const config = getConfigManager();

// Set a session-only key (never persisted)
await config.setProviderKey('openai', 'sk-...', true, true);

// Check if a key is session-only
const isSessionOnly = config.isKeySessionOnly('openai'); // true
```

### Use Cases

- **High-security environments**: Keys for production accounts
- **Shared workstations**: Prevents keys from persisting
- **Temporary access**: Keys for short-term development sessions
- **Compliance requirements**: Meet policies against key persistence

---

## Auto-Lock Feature

The ConfigManager automatically locks after **15 minutes** of inactivity to protect decrypted keys in memory.

### Activity Monitoring

The system monitors the following user activities:

- `mousedown` - Mouse clicks
- `keydown` - Keyboard input
- `scroll` - Page scrolling
- `touchstart` - Touch events

### Auto-Lock Behavior

```typescript
// Auto-lock is enabled when:
// 1. PIN is set up (isPinSetUp() === true)
// 2. Config is unlocked (isUnlocked === true)

// Auto-lock occurs when:
// - No user activity for 15 minutes
// - Inactivity check runs every 60 seconds

// When auto-lock triggers:
// - All decrypted keys cleared from memory
// - Session-only keys cleared
// - isUnlocked set to false
```

### Configuration

```typescript
// Get auto-lock delay
const delay = config.getAutoLockDelay(); // 900000 (15 minutes)

// Check if auto-lock is enabled
const isEnabled = config.isAutoLockEnabled(); // true if PIN set up
```

### Manual Lock

```typescript
// Manually lock the config
config.lock();

// Clear all sensitive data from memory
config.clearSensitiveData();
```

---

## PIN Management

### PIN Requirements

- **Format**: 4-6 digits
- **Validation**: `/^\d{4,6}$/`
- **Storage**: SHA-256 hash in localStorage

### PIN Operations

#### Setup PIN

```typescript
import { setupPin, storePinInSession } from './cryptoUtils';

// One-time setup
await setupPin('123456');

// Store in session for current session
storePinInSession('123456');
```

#### Validate PIN

```typescript
import { validatePin } from './cryptoUtils';

const isValid = await validatePin('123456'); // true/false
```

#### Check PIN Status

```typescript
import { isPinSetUp, getPinFromSession } from './cryptoUtils';

const isSetUp = isPinSetUp(); // true/false
const pin = getPinFromSession(); // string | null
```

#### Clear PIN

```typescript
import { clearPinSetup } from './cryptoUtils';

// Remove PIN (for reset)
clearPinSetup();
```

---

## Key Rotation

Key rotation allows changing the PIN and re-encrypting all stored keys.

### Process

```typescript
import { getConfigManager } from './configManager';
import { setupPin, storePinInSession } from './cryptoUtils';

const config = getConfigManager();

// 1. Ensure config is unlocked
await config.unlock();

// 2. Re-encrypt all keys with new PIN
const count = await config.reEncryptAllKeys('654321');
console.log(`Re-encrypted ${count} keys`);

// 3. Update PIN hash
await setupPin('654321');

// 4. Store new PIN in session
storePinInSession('654321');

// 5. Lock and unlock with new PIN
config.lock();
await config.unlock();
```

### Important Notes

- Config must be unlocked before rotating keys
- Only encrypted keys are re-encrypted (legacy obfuscated keys are not)
- Session-only keys are not affected by PIN rotation

---

## Security Best Practices

### 1. PIN Security

- **Use a unique PIN**: Don't reuse PINs from other services
- **Don't share the PIN**: PIN provides access to all encrypted keys
- **Change PIN periodically**: Use key rotation for added security
- **Avoid obvious PINs**: Don't use 1234, 0000, birthdates, etc.

### 2. Key Storage

- **Prefer encrypted storage**: Set up a PIN and use encryption
- **Use session-only for high-security**: Enable session-only for sensitive keys
- **Clear keys after use**: Manually lock when stepping away from workstation
- **Don't commit keys**: `.env.local` is in `.gitignore`

### 3. Environment Security

- **Localhost only**: This tool is not designed for public internet access
- **Secure your workstation**: Use OS-level security (screen lock, encryption)
- **Network security**: Use HTTPS when accessing remote LLM APIs
- **Regular audits**: Review stored keys and remove unused providers

### 4. Development Practices

- **Don't log keys**: Avoid logging decrypted API keys
- **Clear test keys**: Remove test keys before committing
- **Use environment variables**: For CI/CD, use environment variables instead
- **Monitor for breaches**: Check API key usage in provider dashboards

### 5. Migration from Legacy

If you have legacy (obfuscated) keys:

```typescript
import { getConfigManager } from './configManager';

const config = getConfigManager();

// Check for legacy keys
if (config.hasLegacyKeys()) {
  const count = config.getLegacyKeyCount();
  console.log(`Found ${count} legacy keys`);

  // Migrate to encrypted format
  const migrated = await config.migrateAllKeys();
  console.log(`Migrated ${migrated} keys to encrypted storage`);
}
```

---

## Security Status API

### Check Encryption Status

```typescript
import { getConfigManager } from './configManager';

const config = getConfigManager();

// Check if a specific key is encrypted
const isEncrypted = config.isKeyEncrypted('openai'); // true/false

// Check if a key is session-only
const isSessionOnly = config.isKeySessionOnly('openai'); // true/false

// Get security status for all providers
const status = config.getSecurityStatus();
// Map<ProviderId, { encrypted: boolean; sessionOnly: boolean }>

// Example output:
// Map {
//   'openai' => { encrypted: true, sessionOnly: false },
//   'anthropic' => { encrypted: false, sessionOnly: true },
//   'google' => { encrypted: true, sessionOnly: false }
// }
```

---

## Threat Model

### Protected Against

| Threat | Mitigation |
|--------|------------|
| localStorage disclosure | AES-GCM encryption with PIN |
| Memory dumps via DevTools | Keys only in memory when unlocked |
| Browser session hijacking | Auto-lock after 15 minutes |
| XSS attacks | PIN in sessionStorage (not accessible via JS) |
| Physical access to workstation | OS-level security + auto-lock |
| Browser localStorage theft | Encrypted format requires PIN |

### Not Protected Against

| Threat | Notes |
|--------|-------|
| Compromised browser extensions | Extensions can access sessionStorage |
| Malicious JavaScript on page | Can read keys from memory when unlocked |
| Keylogging | PIN entered via keyboard can be captured |
| Browser memory dumps | Decrypted keys in memory when unlocked |

**Recommendation**: Use in trusted environments only. For production, implement server-side key management.

---

## Audit Trail

### Recent Security Improvements

1. **Session-Only Storage** (2026-02-09)
   - Added `sessionOnly` flag to `ProviderConfig`
   - Keys with `sessionOnly: true` never persisted to localStorage
   - Stored in memory cache (`sessionOnlyKeys` Map)

2. **Auto-Lock Enhancement** (2026-02-09)
   - Activity monitoring on mouse/keyboard/touch events
   - Automatic lock after 15 minutes of inactivity
   - Clears both decrypted cache and session-only keys

3. **Key Rotation Support** (2026-02-09)
   - `reEncryptAllKeys()` method for PIN changes
   - Re-encrypts all encrypted keys with new PIN
   - Maintains backward compatibility with legacy keys

4. **Security Status API** (2026-02-09)
   - `getSecurityStatus()` returns encryption status for all providers
   - `isKeySessionOnly()` checks session-only flag
   - Enhanced visibility into key storage state

---

## Additional Resources

- [Web Crypto API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [AES-GCM Specification](https://csrc.nist.gov/publications/detail/fips/197/final)
- [PBKDF2 Specification](https://csrc.nist.gov/publications/detail/sp/800-132/final)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
