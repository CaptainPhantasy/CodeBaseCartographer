/**
 * Cryptographic Utilities for Secure API Key Storage
 * Uses Web Crypto API with AES-GCM encryption and PBKDF2 key derivation
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result of encryption operation
 */
interface EncryptedData {
  version: string;
  salt: string;
  iv: string;
  data: string;
}

/**
 * Encryption result with storage format
 */
interface EncryptionResult {
  /** Storage format: ENC:salt:iv:encrypted_data */
  storageString: string;
  /** Raw encrypted data object */
  encrypted: EncryptedData;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ENCRYPTION_PREFIX = 'ENC:';
const CRYPTO_VERSION = '1';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============================================================================
// CRYPTOGRAPHIC FUNCTIONS
// ============================================================================

/**
 * Generate a random salt for key derivation
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a random initialization vector (IV)
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive a cryptographic key from a PIN using PBKDF2
 *
 * @param pin - User's PIN (4-6 digits)
 * @param salt - Salt for key derivation
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const pinBuffer = encoder.encode(pin);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-GCM
 *
 * @param data - Data to encrypt (UTF-8 string)
 * @param pin - User's PIN for key derivation
 * @returns EncryptionResult with storage format
 */
export async function encryptData(data: string, pin: string): Promise<EncryptionResult> {
  if (!data || !pin) {
    throw new Error('Data and PIN are required for encryption');
  }

  const salt = generateSalt();
  const iv = generateIV();
  const key = await deriveKeyFromPin(pin, salt);

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBuffer
  );

  const encrypted: EncryptedData = {
    version: CRYPTO_VERSION,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encryptedBuffer)
  };

  // Format: ENC:salt:iv:data
  const storageString = `${ENCRYPTION_PREFIX}${encrypted.salt}:${encrypted.iv}:${encrypted.data}`;

  return { storageString, encrypted };
}

/**
 * Decrypt data using AES-GCM
 *
 * @param storageString - Encrypted data string in format ENC:salt:iv:data
 * @param pin - User's PIN for key derivation
 * @returns Decrypted UTF-8 string
 * @throws Error if decryption fails or PIN is incorrect
 */
export async function decryptData(storageString: string, pin: string): Promise<string> {
  if (!storageString || !pin) {
    throw new Error('Storage string and PIN are required for decryption');
  }

  if (!storageString.startsWith(ENCRYPTION_PREFIX)) {
    throw new Error('Invalid encrypted data format');
  }

  // Parse: ENC:salt:iv:data
  const parts = storageString.slice(ENCRYPTION_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [saltBase64, ivBase64, dataBase64] = parts;

  const salt = base64ToUint8Array(saltBase64);
  const iv = base64ToUint8Array(ivBase64);
  const encryptedData = base64ToUint8Array(dataBase64);

  const key = await deriveKeyFromPin(pin, salt);

  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    // Provide more specific error information
    let errorMsg = 'Decryption failed';
    if (error instanceof Error) {
      if (error.name === 'OperationError') {
        errorMsg += ' - incorrect PIN or corrupted data';
      } else {
        errorMsg += ` - ${error.message}`;
      }
    } else {
      errorMsg += ' - unknown error';
    }
    throw new Error(errorMsg);
  }
}

/**
 * Check if a string is in the new encrypted format
 */
export function isEncryptedFormat(data: string): boolean {
  return data ? data.startsWith(ENCRYPTION_PREFIX) : false;
}

/**
 * Validate PIN format (4-6 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Hash a PIN for verification (not for encryption)
 * Uses SHA-256 to create a one-way hash
 *
 * @param pin - PIN to hash
 * @returns Base64-encoded hash
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return arrayBufferToBase64(hashBuffer);
}

/**
 * Verify a PIN against a stored hash
 */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

// ============================================================================
// SESSION STORAGE HELPERS
// ============================================================================

const SESSION_PIN_KEY = 'cartographer_session_pin';
const PIN_HASH_KEY = 'cartographer_pin_hash';

/**
 * Store PIN in sessionStorage (clears on browser close)
 */
export function storePinInSession(pin: string): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.setItem(SESSION_PIN_KEY, pin);
  }
}

/**
 * Retrieve PIN from sessionStorage
 */
export function getPinFromSession(): string | null {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return sessionStorage.getItem(SESSION_PIN_KEY);
  }
  return null;
}

/**
 * Clear PIN from sessionStorage
 */
export function clearPinFromSession(): void {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    sessionStorage.removeItem(SESSION_PIN_KEY);
  }
}

/**
 * Check if PIN is set up
 */
export function isPinSetUp(): boolean {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem(PIN_HASH_KEY) !== null;
  }
  return false;
}

/**
 * Store PIN hash in localStorage for verification
 */
export async function setupPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }

  const hash = await hashPin(pin);
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(PIN_HASH_KEY, hash);
  }
}

/**
 * Verify PIN against stored hash
 */
export async function validatePin(pin: string): Promise<boolean> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  const storedHash = localStorage.getItem(PIN_HASH_KEY);
  if (!storedHash) {
    return false;
  }

  return verifyPin(pin, storedHash);
}

/**
 * Clear PIN setup (for reset)
 */
export function clearPinSetup(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem(PIN_HASH_KEY);
  }
  clearPinFromSession();
}
