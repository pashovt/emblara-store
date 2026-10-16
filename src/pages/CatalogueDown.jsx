// Shown instead of the shop when the product list cannot be loaded. There is deliberately
// no cached or bundled list to show: it could include products that are no longer public.
export default function CatalogueDown() {
  return (
    <main className="page page--missing" id="main">
      <p className="eyebrow">EMBLARA</p>
      <h1 className="h2">The shop is <em>unavailable</em> right now.</h1>
      <p>We couldn’t load the range. Please try again in a moment.</p>
      <button type="button" className="pill pill--copper" onClick={() => window.location.reload()}>Try again</button>
    </main>
  );
}
