import Link from "next/link";

/** Shared brand bar; pages pass their own navigation so session logic stays with the page. */
export function SiteHeader({ children, badge }: { children?: React.ReactNode; badge?: string }) {
  return <header className="site-header">
    <div className="site-header-inner">
      <Link href="/" className="brand" aria-label="JazzLink AI home"><span className="brand-mark" aria-hidden="true">J</span><span>jazzlink<span className="brand-ai"> ai</span></span></Link>
      <nav className="site-nav" aria-label="Main">
        {children}
        {badge && <span className="prototype-badge"><span aria-hidden="true" /> {badge}</span>}
      </nav>
    </div>
  </header>;
}

export function SiteFooter({ items }: { items: string[] }) {
  return <footer className="site-footer">{items.map((item) => <span key={item}>{item}</span>)}</footer>;
}
