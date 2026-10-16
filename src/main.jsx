import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/mona-sans/wdth.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/global.css';
import { CartProvider } from './store/cart.jsx';
import { LogoProvider } from './store/logo.jsx';
import App from './App.jsx';
import { loadCatalogue } from './data/products.js';
import CatalogueDown from './pages/CatalogueDown.jsx';

const catalogueLoaded = await loadCatalogue();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {catalogueLoaded || window.location.hash.startsWith('#/admin') ? (
    <LogoProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </LogoProvider>
    ) : (
      <CatalogueDown />
    )}
  </StrictMode>,
);
