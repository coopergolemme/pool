import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";

export interface AuthFormData {
  email: string;
  password?: string;
  username?: string;
}

interface AuthFormProps {
  onSignIn: (data: AuthFormData) => void;
  onSignUp: (data: AuthFormData) => void;
  loading: boolean;
  error?: string | null;
}

export function AuthForm({ onSignIn, onSignUp, loading, error }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", username: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      onSignUp(form);
    } else {
      onSignIn(form);
    }
  };

  return (
    <Card>
      <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
        {isSignUp ? "Create Account" : "Sign In"}
      </h3>
      <p className="mt-2 text-sm text-white/60">
        {isSignUp
          ? "Enter your details to create a new account."
          : "Use your email and password to continue."}
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      <form
        className="mt-4 space-y-4"
        onSubmit={handleSubmit}
        data-testid="auth-form"
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        {isSignUp && (
          <Input
            label="Username"
            type="text"
            autoComplete="username"
            required
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        )}

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {!isSignUp && (
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[10px] sm:text-xs text-white/60 hover:text-white transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
        )}

        <div className="space-y-3">
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? (isSignUp ? "Creating..." : "Signing In...")
              : (isSignUp ? "Create Account" : "Sign In")}
          </Button>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-white/60 hover:text-white transition-colors"
              disabled={loading}
            >
              {isSignUp
                ? "Already have an account? Sign In"
                : "Need an account? Sign Up"}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
