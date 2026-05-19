import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/sidebar";

const { auth, workspace } = vi.hoisted(() => ({
  auth: {
    accessToken: vi.fn(),
    loading: false,
    mode: "supabase",
    resendSignUpCode: vi.fn(),
    session: {
      user: {
        email: "haichao@example.com",
        user_metadata: {
          avatar_url: "https://example.com/avatar.png",
          full_name: "Haichao Zhu",
        },
      },
    },
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    verifySignUpOtp: vi.fn(),
  },
  workspace: {
    activeProject: {
      createdAt: new Date().toISOString(),
      id: "project-1",
      name: "Launch Lab",
      rootDir: "/tmp/launch-lab",
    },
    loading: false,
    projects: [],
    refreshWorkspace: vi.fn(),
    setWorkspace: vi.fn(),
  },
}));

vi.mock("@/state/auth-context", () => ({
  useAuth: () => auth,
}));

vi.mock("@/state/workspace-context", () => ({
  useWorkspace: () => workspace,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Sidebar", () => {
  it("shows the signed-in user menu and logs out from the dropdown", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/connectors"]}>
        <Sidebar />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /haichao zhu haichao@example.com/i,
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: /logout/i }));

    expect(auth.signOut).toHaveBeenCalledOnce();
  });
});
