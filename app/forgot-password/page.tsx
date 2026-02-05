'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import Link from 'next/link';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase) return;
        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/update-password`,
        });

        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else {
            setMessage({
                type: 'success',
                text: 'Check your email for the password reset link.',
            });
        }
        setLoading(false);
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <h3 className="font-[var(--font-display)] text-xl tracking-[0.06em] sm:text-2xl sm:tracking-[0.08em]">
                    Reset Password
                </h3>
                <p className="mt-2 text-sm text-white/60">
                    Enter your email to receive a reset link.
                </p>

                {message && (
                    <div className={`mt-4 rounded-lg border p-3 ${message.type === 'error'
                        ? 'bg-red-500/10 border-red-500/20 text-red-400'
                        : 'bg-green-500/10 border-green-500/20 text-green-400'
                        }`}>
                        <p className="text-sm text-center">{message.text}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                    />

                    <Button type="submit" disabled={loading} className="w-full">
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </Button>

                    <div className="flex justify-center">
                        <Link
                            href="/"
                            className="text-xs text-white/60 hover:text-white transition-colors"
                        >
                            Back to Sign In
                        </Link>
                    </div>
                </form>
            </Card>
        </main>
    );
}
