import { signIn } from "./actions";
import { Suspense } from "react";

async function AuthForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main>
    <h1>Sign in to JazzLink</h1>
    <p>Sign in with your demo account to save and review private gig details.</p>
    {error && <p role="alert">Sign-in failed. Check your email and password and try again.</p>}
    <form action={signIn}>
      <label>Email <input name="email" type="email" required autoComplete="email" /></label>
      <label>Password <input name="password" type="password" required autoComplete="current-password" /></label>
      <button type="submit">Sign in</button>
    </form>
  </main>;
}

export default function AuthPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <Suspense fallback={<main><h1>Sign in to JazzLink</h1><p>Loading sign-in…</p></main>}>
    <AuthForm searchParams={searchParams} />
  </Suspense>;
}
