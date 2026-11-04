import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { BenchProvider } from './context/BenchContext.jsx';
import { NoticeProvider } from './context/NoticeContext.jsx';
import { ReceiptProvider } from './context/ReceiptContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <NoticeProvider>
          <AuthProvider>
            <ReceiptProvider>
              <BenchProvider>
                <App />
              </BenchProvider>
            </ReceiptProvider>
          </AuthProvider>
        </NoticeProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
