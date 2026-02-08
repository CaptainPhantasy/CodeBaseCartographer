/**
 * Tests for crypto utilities
 */

import {
  encryptData,
  decryptData,
  isEncryptedFormat,
  isValidPin,
  hashPin,
  verifyPin,
  setupPin,
  validatePin
} from './cryptoUtils';

describe('Crypto Utilities', () => {
  const testPin = '1234';
  const testData = 'test-api-key-sk-1234567890';

  describe('PIN Validation', () => {
    it('should accept valid 4-digit PINs', () => {
      expect(isValidPin('1234')).toBe(true);
      expect(isValidPin('0000')).toBe(true);
      expect(isValidPin('9999')).toBe(true);
    });

    it('should accept valid 5-6 digit PINs', () => {
      expect(isValidPin('12345')).toBe(true);
      expect(isValidPin('123456')).toBe(true);
    });

    it('should reject invalid PINs', () => {
      expect(isValidPin('123')).toBe(false); // Too short
      expect(isValidPin('1234567')).toBe(false); // Too long
      expect(isValidPin('abcd')).toBe(false); // Not digits
      expect(isValidPin('12a4')).toBe(false); // Mixed
      expect(isValidPin('')).toBe(false); // Empty
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt data with correct format', async () => {
      const result = await encryptData(testData, testPin);

      expect(result.storageString).toMatch(/^ENC:/);
      expect(result.storageString.split(':')).toHaveLength(4); // ENC:salt:iv:data
      expect(result.encrypted.version).toBe('1');
    });

    it('should decrypt data correctly', async () => {
      const encrypted = await encryptData(testData, testPin);
      const decrypted = await decryptData(encrypted.storageString, testPin);

      expect(decrypted).toBe(testData);
    });

    it('should fail to decrypt with wrong PIN', async () => {
      const encrypted = await encryptData(testData, testPin);

      await expect(decryptData(encrypted.storageString, 'wrong')).rejects.toThrow();
    });

    it('should produce different ciphertext for same input', async () => {
      const encrypted1 = await encryptData(testData, testPin);
      const encrypted2 = await encryptData(testData, testPin);

      // Different salt/IV means different ciphertext
      expect(encrypted1.storageString).not.toBe(encrypted2.storageString);

      // But both decrypt to same value
      expect(await decryptData(encrypted1.storageString, testPin)).toBe(testData);
      expect(await decryptData(encrypted2.storageString, testPin)).toBe(testData);
    });

    it('should handle empty strings', async () => {
      await expect(encryptData('', testPin)).rejects.toThrow();
      await expect(decryptData('', testPin)).rejects.toThrow();
    });

    it('should handle special characters', async () => {
      const specialData = 'sk-ant-key_with-special.chars!@#$%';
      const encrypted = await encryptData(specialData, testPin);
      const decrypted = await decryptData(encrypted.storageString, testPin);

      expect(decrypted).toBe(specialData);
    });
  });

  describe('isEncryptedFormat', () => {
    it('should identify encrypted format', () => {
      expect(isEncryptedFormat('ENC:salt:iv:data')).toBe(true);
      expect(isEncryptedFormat('ENC:abc:def:ghi')).toBe(true);
    });

    it('should reject non-encrypted format', () => {
      expect(isEncryptedFormat('OBF:some-data')).toBe(false);
      expect(isEncryptedFormat('plain-key')).toBe(false);
      expect(isEncryptedFormat('')).toBe(false);
      expect(isEncryptedFormat('ENC-incomplete')).toBe(false);
    });
  });

  describe('PIN Hashing', () => {
    it('should hash PIN consistently', async () => {
      const hash1 = await hashPin(testPin);
      const hash2 = await hashPin(testPin);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different PINs', async () => {
      const hash1 = await hashPin('1234');
      const hash2 = await hashPin('5678');

      expect(hash1).not.toBe(hash2);
    });

    it('should verify PIN correctly', async () => {
      const hash = await hashPin(testPin);
      const isValid = await verifyPin(testPin, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect PIN', async () => {
      const hash = await hashPin(testPin);
      const isValid = await verifyPin('wrong', hash);

      expect(isValid).toBe(false);
    });
  });
});
