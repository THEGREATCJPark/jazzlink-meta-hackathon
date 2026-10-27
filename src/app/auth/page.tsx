import Link from "next/link";
import { Suspense } from "react";
import { SiteFooter, SiteHeader } from "@/components/site/SiteHeader";
import { signIn } from "./actions";
import styles from "./auth.module.css";

async function AuthForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <>
    {error && <p className={"callout callout-error " + styles.error} role="alert">Sign-in failed. Check your email and password and try again.</p>}
    <form className={styles.form} action={signIn}>
      <label>Email <input name="email" type="email" required autoComplete="email" /></label>
      <label>Password <input name="password" type="password" required autoComplete="current-password" /></label>
      <button className="btn btn-primary btn-block" type="submit">Sign in <span aria-hidden="true">→</span></button>
    </form>
  </>;
}

export default function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <div className={styles.page}>
    <SiteHeader><Link href="/demo">Try demo <span aria-hidden="true">↗</span></Link></SiteHeader>
    <main id="main" className={styles.main}>
      <div className={styles.card}>
        <p className="kicker">PRIVATE WORKSPACE</p>
        <h1>Sign in to JazzLink</h1>
        <p className={styles.lead}>Sign in with your demo account to save and review private gig details.</p>
        <Suspense fallback={<p className={styles.lead}>Loading sign-in…</p>}>
          <AuthForm searchParams={searchParams} />
        </Suspense>
        <p className={styles.alt}>No account? <Link href="/demo">Explore the fictional demo</Link> without signing in.</p>
      </div>
    </main>
    <SiteFooter items={["JAZZLINK AI", "EARLY PREVIEW · FICTIONAL DATA"]} />
  </div>;
}
