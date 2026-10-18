import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";

export function SignInScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    const nextEmail = email.trim().toLowerCase();
    if (!nextEmail.includes("@") || password.length < 8) {
      setError("Use a real email and a password of at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              email: nextEmail,
              password,
              name: name.trim() || nextEmail.split("@")[0] || "Writer",
            })
          : await authClient.signIn.email({ email: nextEmail, password });
      if (result.error) {
        setError(result.error.message || "That sign-in didn’t work.");
        return;
      }
      await router.invalidate();
      await router.navigate({ to: "/", search: { page: undefined, view: "page" } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That sign-in didn’t work.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-10 text-ink">
      <div className="w-full max-w-sm">
        <span className="inline-block h-3.5 w-4 -skew-x-12 rounded-sm bg-copper" aria-hidden="true" />
        <h1 className="mt-4 font-serif text-5xl text-balance">Motion</h1>
        <p className="mt-3 text-pretty leading-relaxed text-muted">
          Sign in to keep a private studio. Pages, templates, and notes stay on your account.
        </p>
        <form
          className="mt-8 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {mode === "up" ? (
            <label className="block text-sm">
              <span className="text-muted">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1 h-11 w-full rounded-md border border-line bg-paper-3 px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper-3 px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              required
              minLength={8}
              className="mt-1 h-11 w-full rounded-md border border-line bg-paper-3 px-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-copper-deep">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 h-11 rounded-md bg-copper px-3 text-sm font-medium text-paper disabled:opacity-50"
          >
            {pending ? "Working" : mode === "up" ? "Create account" : "Sign in"}
          </button>
          <button
            type="button"
            className="h-11 text-sm text-muted"
            onClick={() => {
              setMode((value) => (value === "in" ? "up" : "in"));
              setError(null);
            }}
          >
            {mode === "up" ? "I already have an account" : "Create an account"}
          </button>
        </form>
        <div className="mt-4 flex flex-col gap-2">
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              className="h-11 rounded-md border border-line bg-paper-3 px-3 text-sm font-medium hover:bg-paper-2"
              onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
