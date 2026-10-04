import { categories, products } from '../data/products.js';
import { ProductCard, ThreadLines } from '../components/ui.jsx';

export default function Shop({ category = 'all' }) {
  const active = categories.some((c) => c.id === category) ? category : 'all';
  const list = active === 'all' ? products : products.filter((p) => p.category === active);
  const label = categories.find((c) => c.id === active)?.label;

  return (
    <div className="page page--shop">
      <section className="shop-hero">
        <ThreadLines className="threads--light" />
        <p className="eyebrow">Shop</p>
        <h1 className="shop-hero__title">
          {active === 'all' ? (
            <>The full <em>range</em></>
          ) : (
            label
          )}
        </h1>
        <p className="shop-hero__sub">
          Every price includes your logo in the standard position and a digital proof. Team discounts start at 10 pieces of the same item, mixed sizes and colours.
        </p>
      </section>

      <nav className="filters" aria-label="Product categories">
        {categories.map((c) => (
          <a key={c.id} href={c.id === 'all' ? '#/shop' : `#/shop/${c.id}`} className="filter" aria-current={c.id === active ? 'page' : undefined}>
            {c.label}
            <span>{c.id === 'all' ? products.length : products.filter((p) => p.category === c.id).length}</span>
          </a>
        ))}
      </nav>

      <section className="shop-grid" aria-label={`${label} products`}>
        <p className="shop-grid__count">{list.length} products</p>
        <div className="grid">
          {list.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
