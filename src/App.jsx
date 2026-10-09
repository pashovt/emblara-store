import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Header, CartDrawer, Footer } from './components/Chrome.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Checkout from './pages/Checkout.jsx';
import { scrollToId, scrollToY, useRoute, useSmoothScroll } from './lib/utils.js';

const titles = {
  home: 'EMBLARA — Branded Clothing Store (Demo)',
  shop: 'Shop — EMBLARA (Demo)',
  checkout: 'Checkout — EMBLARA (Demo)',
};

export default function App() {
  const route = useRoute();
  useSmoothScroll();

  // New page: jump to top (or to a home section), then let ScrollTrigger
  // re-measure once the new layout has painted.
  useEffect(() => {
    document.title = titles[route.page] ?? 'EMBLARA (Demo)';
    if (route.section) {
      requestAnimationFrame(() => scrollToId(route.section));
    } else {
      scrollToY(0, true);
    }
    const id = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(id);
  }, [route.page, route.param, route.section]);

  let page;
  if (route.page === 'shop') page = <Shop category={route.param} />;
  else if (route.page === 'product') page = <Product slug={route.param} />;
  else if (route.page === 'checkout') page = <Checkout />;
  else page = <Home />;

  return (
    <>
      <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header route={route} />
      <main id="main" tabIndex={-1} key={`${route.page}-${route.param ?? ''}`}>
        {page}
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
