/**
 * Security Provider Component
 * Wraps the app and handles PIN-based encryption/unlocking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PinModal } from './PinModal';
import { getConfigManager } from '../config/configManager';
import { isPinSetUp, getPinFromSession } from '../utils/cryptoUtils';

interface SecurityProviderProps {
  children: React.ReactNode;
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  // Check if we need to show PIN modal on mount
  useEffect(() => {
    const checkLockStatus = async () => {
      const configManager = getConfigManager();
      const pinSetUp = isPinSetUp();
      const sessionPin = getPinFromSession();
      const hasEncryptedKeys = configManager.hasEncryptedKeys();

      if (pinSetUp && hasEncryptedKeys) {
        if (sessionPin) {
          // PIN is in session, auto-unlock
          try {
            await configManager.unlock();

            // Check if we have legacy keys to migrate
            if (configManager.hasLegacyKeys()) {
              setIsMigrating(true);
              const count = await configManager.migrateAllKeys();
              if (count > 0) {
                console.log(`Migrated ${count} keys to encrypted storage`);
              }
              setIsMigrating(false);
            }

            setIsUnlocked(true);
          } catch (error) {
            console.error('Failed to unlock:', error);
            setShowPinModal(true);
          }
        } else {
          // PIN is set up but not in session - show PIN modal
          setShowPinModal(true);
        }
      } else {
        // No PIN set up yet or no encrypted keys - unlock immediately
        setIsUnlocked(true);
      }
    };

    checkLockStatus();
  }, []);

  // Handle successful PIN entry
  const handleUnlock = useCallback(async () => {
    const configManager = getConfigManager();

    try {
      await configManager.unlock();

      // Migrate legacy keys if needed
      if (configManager.hasLegacyKeys()) {
        setIsMigrating(true);
        const count = await configManager.migrateAllKeys();
        if (count > 0) {
          console.log(`Migrated ${count} keys to encrypted storage`);
        }
        setIsMigrating(false);
      }

      setIsUnlocked(true);
      setShowPinModal(false);
    } catch (error) {
      console.error('Failed to unlock:', error);
      throw error;
    }
  }, []);

  // Show loading state while checking
  if (!isUnlocked && !showPinModal) {
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {isUnlocked ? children : null}
      {showPinModal && (
        <PinModal
          onUnlock={handleUnlock}
          allowReset={true}
        />
      )}
      {/* Show migration indicator */}
      {isMigrating && (
        <div className="fixed bottom-4 right-4 bg-cyan-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span className="text-sm font-medium">Encrypting API keys...</span>
        </div>
      )}
    </>
  );
};

export default SecurityProvider;
