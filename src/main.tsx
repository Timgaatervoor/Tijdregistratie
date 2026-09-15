import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { MobileModeProvider } from './hooks/useMobileMode';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MobileModeProvider><App /></MobileModeProvider>
  </StrictMode>,
);
