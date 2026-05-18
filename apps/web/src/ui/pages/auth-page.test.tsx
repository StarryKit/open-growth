import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "./auth-page";

const { auth } = vi.hoisted(() => ({
  auth: {
    accessToken: vi.fn(),
    loading: false,
    mode: "supabase",
    resendSignUpCode: vi.fn(),
    session: null,
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    verifySignUpOtp: vi.fn(),
  },
}));

vi.mock("@/state/auth-context", () => ({
  useAuth: () => auth,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthPage", () => {
  it("starts Google OAuth from the login page", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(
      screen.getByRole("button", { name: /continue with google/i }),
    );

    expect(auth.signInWithGoogle).toHaveBeenCalledOnce();
  });

  it("registers with email and verifies the signup code", async () => {
    const user = userEvent.setup();
    render(<AuthPage />);

    await user.click(screen.getByRole("button", { name: /need an account/i }));
    await user.type(screen.getByLabelText(/email/i), "founder@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(auth.signUp).toHaveBeenCalledWith(
      "founder@example.com",
      "correct-horse",
    );
    expect(
      await screen.findByLabelText(/verification code/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/verification code/i), "123456");
    await user.click(screen.getByRole("button", { name: /verify email/i }));

    expect(auth.verifySignUpOtp).toHaveBeenCalledWith(
      "founder@example.com",
      "123456",
    );
  });
});
