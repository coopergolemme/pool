import { useState } from "react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";

interface AuthFormProps {
  onSignIn: (data: any) => void;
  onSignUp: (data: any) => void;
  loading: boolean;
}

export function AuthForm({ onSignIn, onSignUp, loading }: AuthFormProps) {
  const [form, setForm] = useState({ email: "", password: "", username: "" });

  return (
    <Card>
      <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
        Sign In
      </h3>
      <p className="mt-2 text-sm text-white/60">Use your email and password to continue.</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSignIn(form);
        }}
        data-testid="auth-form"
      >
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Input
          label="Username"
          type="text"
          autoComplete="username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing In..." : "Sign In"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            className="w-full"
            onClick={() => onSignUp(form)}
          >
            {loading ? "Creating..." : "Create Account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
