import { LockKeyhole } from "lucide-react";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useAuth } from "@/state/auth-context";

export function AuthPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      try {
        if (mode === "sign-in") {
          await auth.signIn(email, password);
        } else {
          await auth.signUp(email, password);
        }
      } catch (signInError) {
        setError(
          signInError instanceof Error
            ? signInError.message
            : "Authentication failed.",
        );
      }
    });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <form
        className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40"
        onSubmit={submit}
      >
        <div className="grid size-12 place-items-center rounded-xl bg-cyan-300 text-slate-950">
          <LockKeyhole className="size-6" />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Supabase Auth protects workspace, project, content, publishing,
          tracking, and trends data.
        </p>

        <label className="mt-6 block">
          <span className="text-sm font-medium text-slate-300">Email</span>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-300"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-300">Password</span>
          <input
            className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-300"
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-900/70 bg-rose-950/60 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        <button
          className="mt-6 h-11 w-full rounded-xl bg-cyan-300 px-4 text-sm font-bold text-slate-950 disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
        <button
          className="mt-4 w-full text-sm font-semibold text-cyan-200"
          onClick={() =>
            setMode((current) =>
              current === "sign-in" ? "sign-up" : "sign-in",
            )
          }
          type="button"
        >
          {mode === "sign-in" ? "Need an account?" : "Already have an account?"}
        </button>
      </form>
    </div>
  );
}
