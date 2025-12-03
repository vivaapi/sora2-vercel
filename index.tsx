import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Suppress benign ResizeObserver errors that can occur with complex layouts
// and other common harmless runtime errors
const errorHandlers = (e: ErrorEvent) => {
  const msg = e.message || '';
  // Catch both exact match and 'loop limit exceeded' variations
  if (
    msg.includes('ResizeObserver') || 
    msg.includes('loop completed') ||
    msg.includes('undelivered notifications')
  ) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return true;
  }
  return false;
};

window.addEventListener('error', errorHandlers);

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);