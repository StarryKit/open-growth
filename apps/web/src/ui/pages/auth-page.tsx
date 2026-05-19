import { ArrowRight, LockKeyhole, MailCheck, UserCheck } from "lucide-react";
import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { useAuth } from "@/state/auth-context";

type AuthView = "sign-in" | "sign-up" | "verify";

const demoAccount = {
  email:
    (import.meta.env.VITE_DEMO_ACCOUNT_EMAIL as string | undefined) ??
    "local-dev@open-growth.test",
  password:
    (import.meta.env.VITE_DEMO_ACCOUNT_PASSWORD as string | undefined) ??
    "open-growth-local",
};

export function AuthPage() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [mode, setMode] = useState<AuthView>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        if (mode === "sign-in") {
          await auth.signIn(email, password);
        } else if (mode === "sign-up") {
          await auth.signUp(email, password);
          setVerificationEmail(email);
          setMode("verify");
          setNotice("We sent a verification code to your inbox.");
        } else {
          await auth.verifySignUpOtp(verificationEmail || email, otp);
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

  const signInWithGoogle = () => {
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        await auth.signInWithGoogle();
      } catch (googleError) {
        setError(
          googleError instanceof Error
            ? googleError.message
            : "Google authentication failed.",
        );
      }
    });
  };

  const signInWithDemoAccount = () => {
    startTransition(async () => {
      setError(null);
      setNotice(null);
      setEmail(demoAccount.email);
      setPassword(demoAccount.password);
      try {
        await auth.signIn(demoAccount.email, demoAccount.password);
      } catch (demoError) {
        setError(
          demoError instanceof Error
            ? demoError.message
            : "Demo account authentication failed.",
        );
      }
    });
  };

  const resendCode = () => {
    const targetEmail = verificationEmail || email;

    if (!targetEmail) {
      setError("Enter your email before requesting another code.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        await auth.resendSignUpCode(targetEmail);
        setNotice("A new verification code is on the way.");
      } catch (resendError) {
        setError(
          resendError instanceof Error
            ? resendError.message
            : "Unable to resend the verification code.",
        );
      }
    });
  };

  const title =
    mode === "sign-in"
      ? "Welcome back"
      : mode === "sign-up"
        ? "Create your workspace"
        : "Verify your email";
  const subtitle =
    mode === "verify"
      ? `Enter the 6-digit code sent to ${verificationEmail || email}.`
      : "Sign in to manage projects, content, publishing, tracking, and trends.";

  return (
    <div className="min-h-screen bg-[#11100d] text-stone-100">
      <main className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden bg-[#f4efe6] text-[#18140f] lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(232,94,64,0.20),rgba(31,122,104,0.18)_45%,rgba(32,31,28,0.08))]" />
          <div className="relative flex h-full flex-col justify-between p-12">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-lg bg-[#18140f] text-stone-50">
                <LockKeyhole className="size-5" />
              </div>
              <span className="text-sm font-bold uppercase tracking-[0.24em]">
                Open Growth
              </span>
            </div>

            <div className="max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#a7462e]">
                Growth operations workbench
              </p>
              <h1 className="mt-5 text-6xl font-black leading-[0.95] tracking-normal">
                One private workspace for every growth project.
              </h1>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm font-semibold">
              {["Connect", "Publish", "Track"].map((item) => (
                <div
                  className="rounded-lg border border-[#18140f]/10 bg-white/55 px-4 py-3 shadow-sm"
                  key={item}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid min-h-screen place-items-center px-5 py-10 sm:px-8">
          <form
            className="w-full max-w-[430px] rounded-lg border border-white/10 bg-[#1b1915]/95 p-6 shadow-2xl shadow-black/40 sm:p-8"
            onSubmit={submit}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-lg bg-[#f0c85a] text-[#17130f]">
                {mode === "verify" ? (
                  <MailCheck className="size-5" />
                ) : (
                  <LockKeyhole className="size-5" />
                )}
              </div>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-stone-300">
                Supabase Auth
              </span>
            </div>

            <h1 className="mt-7 text-3xl font-black tracking-normal text-white">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-400">{subtitle}</p>

            {mode !== "verify" ? (
              <div className="mt-7 space-y-3">
                <button
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/12 bg-white px-4 text-sm font-bold text-[#17130f] shadow-sm transition hover:bg-[#f4efe6] disabled:opacity-60"
                  disabled={isPending}
                  onClick={signInWithGoogle}
                  type="button"
                >
                  <span className="grid size-5 place-items-center rounded-full bg-[#4285f4] text-xs font-black text-white">
                    G
                  </span>
                  Continue with Google
                </button>

                {mode === "sign-in" ? (
                  <button
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#f0c85a]/35 bg-[#f0c85a]/12 px-4 text-sm font-bold text-[#f5d87d] transition hover:bg-[#f0c85a]/18 disabled:opacity-60"
                    disabled={isPending}
                    onClick={signInWithDemoAccount}
                    type="button"
                  >
                    <UserCheck className="size-4" />
                    Use Demo Account
                  </button>
                ) : null}
              </div>
            ) : null}

            {mode !== "verify" ? (
              <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
                <span className="h-px flex-1 bg-white/10" />
                Email
                <span className="h-px flex-1 bg-white/10" />
              </div>
            ) : null}

            {mode === "verify" ? (
              <label className="mt-7 block">
                <span className="text-sm font-semibold text-stone-200">
                  Verification code
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#11100d] px-3 text-center text-lg font-bold tracking-[0.3em] text-white outline-none transition focus:border-[#f0c85a] focus:ring-2 focus:ring-[#f0c85a]/20"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setOtp(event.target.value)}
                  pattern="[0-9]{6}"
                  required
                  type="text"
                  value={otp}
                />
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="text-sm font-semibold text-stone-200">
                    Email
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#11100d] px-3 text-sm text-white outline-none transition focus:border-[#f0c85a] focus:ring-2 focus:ring-[#f0c85a]/20"
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-stone-200">
                    Password
                  </span>
                  <input
                    className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#11100d] px-3 text-sm text-white outline-none transition focus:border-[#f0c85a] focus:ring-2 focus:ring-[#f0c85a]/20"
                    minLength={6}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
              </>
            )}

            {notice ? (
              <p className="mt-4 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                {notice}
              </p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <button
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#f0c85a] px-4 text-sm font-black text-[#17130f] transition hover:bg-[#f5d87d] disabled:opacity-60"
              disabled={isPending}
              type="submit"
            >
              {mode === "sign-in"
                ? "Sign in"
                : mode === "sign-up"
                  ? "Create account"
                  : "Verify email"}
              <ArrowRight className="size-4" />
            </button>

            {mode === "verify" ? (
              <button
                className="mt-4 w-full text-sm font-semibold text-[#f0c85a]"
                disabled={isPending}
                onClick={resendCode}
                type="button"
              >
                Send a new code
              </button>
            ) : (
              <button
                className="mt-4 w-full text-sm font-semibold text-[#f0c85a]"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode((current) =>
                    current === "sign-in" ? "sign-up" : "sign-in",
                  );
                }}
                type="button"
              >
                {mode === "sign-in"
                  ? "Need an account?"
                  : "Already have an account?"}
              </button>
            )}
          </form>
        </section>
      </main>
    </div>
  );
}
