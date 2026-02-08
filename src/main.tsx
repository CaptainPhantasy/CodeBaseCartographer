import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ConfigProvider } from './hooks/useConfig';
import ErrorBoundary from './components/ErrorBoundary';
import { SecurityProvider } from './components/SecurityProvider';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider>
        <SecurityProvider>
          <App />
        </SecurityProvider>
      </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// APP_BOOT_OK marker for automated testing verification
console.log('APP_BOOT_OK');
