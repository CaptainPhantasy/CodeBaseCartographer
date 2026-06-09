/**
 * ServerAuthGate - modal prompting for the backend server password.
 *
 * Listens for the `server-auth-required` event emitted by apiFetch when a
 * request hits 401 and silent refresh fails. On successful login, apiClient
 * dispatches `server-auth-success` so data hooks can refetch.
 *
 * The server prints a one-time password at startup when AUTH_PASSWORD is not
 * configured (see server/src/middleware/auth.ts).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { serverLogin, SERVER_AUTH_REQUIRED_EVENT } from '../services/apiClient';

export const ServerAuthGate: React.FC = () => {
  const [origin, setOrigin] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<{ origin?: string }>).detail;
      setOrigin(previous => previous ?? detail?.origin ?? '');
    };
    window.addEventListener(SERVER_AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => window.removeEventListener(SERVER_AUTH_REQUIRED_EVENT, handleAuthRequired);
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!password || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const result = await serverLogin(password, origin ?? '');
        if (result.ok) {
          setOrigin(null);
          setPassword('');
        } else {
          setError(result.message ?? 'Login failed');
        }
      } catch {
        setError('Could not reach the backend server');
      } finally {
        setSubmitting(false);
      }
    },
    [password, submitting, origin]
  );

  if (origin === null) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-100 mb-2">Server authentication required</h2>
        <p className="text-sm text-slate-400 mb-4">
          Enter the backend server password. If you did not set <code className="text-slate-300">AUTH_PASSWORD</code>,
          the server printed a one-time password to its console at startup.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Server password"
            autoFocus
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 mb-3"
          />
          {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
          <button
            type="submit"
            disabled={!password || submitting}
            className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ServerAuthGate;
