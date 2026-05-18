import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/state/auth-context";
import { App } from "@/ui/app";
import "@/styles/globals.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
