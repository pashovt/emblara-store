import { useEffect } from 'react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Header, CartDrawer, Footer, LogoPanel } from './components/Chrome.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Admin from './pages/Admin.jsx';
import Privacy from './pages/Privacy.jsx';
import RequestQuote from './pages/RequestQuote.jsx';
import Quote from './pages/Quote.jsx';
import ConsentBanner from './components/ConsentBanner.jsx';
import { pageview, useConsent } from './lib/analytics.js';
import { scrollToId, scrollToY, useRoute, useSmoothScroll } from './lib/utils.js';

const titles = {
  home: 'EMBLARA — Branded Clothing Store',
  shop: 'Shop — EMBLARA',
  checkout: 'Checkout — EMBLARA',
  'order-success': 'Order confirmed — EMBLARA',
  privacy: 'Privacy & cookies — EMBLARA',
  request: 'Request a quote — EMBLARA',
  q: 'Quotation — EMBLARA',
  admin: 'Store Dashboard — EMBLARA',
};

export default function App() {
  const route = useRoute();
  useSmoothScroll();
  const consent = useConsent();

  // New page: jump to top (or to a home section), then let ScrollTrigger
  // re-measure once the new layout has painted.
  useEffect(() => {
    // The product page sets its own title (product name).
    if (route.page !== 'product') document.title = titles[route.page] ?? 'EMBLARA';
    if (route.section) {
      requestAnimationFrame(() => scrollToId(route.section));
    } else {
      scrollToY(0, true);
    }
    const id = setTimeout(() => ScrollTrigger.refresh(), 120);
    return () => clearTimeout(id);
  }, [route.page, route.param, route.section]);

  // Analytics page view, once per route and only with consent. Runs after the title
  // effect above (and after Product's own), so the title it reports is already set.
  useEffect(() => {
    pageview();
  }, [route.page, route.param, route.section, consent]);

  if (route.page === 'admin') {
    return (
      <main id="main" tabIndex={-1}>
        <Admin route={route} />
      </main>
    );
  }

  let page;
  if (route.page === 'shop') page = <Shop category={route.param} />;
  else if (route.page === 'product') page = <Product slug={route.param} />;
  else if (route.page === 'checkout') page = <Checkout />;
  else if (route.page === 'order-success') page = <OrderSuccess />;
  else if (route.page === 'privacy') page = <Privacy />;
  else if (route.page === 'request') page = <RequestQuote />;
  else if (route.page === 'q') page = <Quote token={route.param ?? ''} />;
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
      <LogoPanel />
      <ConsentBanner />
    </>
  );
}
