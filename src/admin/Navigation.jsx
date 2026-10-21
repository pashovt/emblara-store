const sections = [['orders', 'Orders'], ['sales', 'Sales'], ['support', 'Support'], ['catalogue', 'Catalogue'], ['products', 'Products'], ['settings', 'Settings']];

export default function Navigation({ section }) {
  return <nav className="adm__sections" aria-label="Dashboard sections">{sections.map(([id, label]) => <a key={id} href={`#/admin/${id}`} aria-current={section === id ? 'page' : undefined}>{label}</a>)}</nav>;
}
