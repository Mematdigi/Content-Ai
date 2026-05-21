import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import store from './store/store';
import App from './App';

import './styles/main.scss';

// Inter font for the design system. Loaded once at the document level so
// every component picks it up via the SCSS font stack.
const interLink = document.createElement('link');
interLink.rel = 'stylesheet';
interLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
document.head.appendChild(interLink);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-md)',
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
