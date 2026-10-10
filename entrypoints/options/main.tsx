import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/ui/shared/page.css';
import { OptionsApp } from './OptionsApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
