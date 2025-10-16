import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'; // 추가
import { AuthProvider } from './useAuth';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* 추가 */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter> {/* 추가 */}
  </React.StrictMode>,
)