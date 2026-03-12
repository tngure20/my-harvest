import { useState } from "react";
import { Link } from "react-router-dom";
import { Leaf, Mail, ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    // In production, call supabase.auth.resetPasswordForEmail(email)
    setSent(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <Leaf className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="font-display text-2xl font-bold text-foreground">Reset Password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {sent
                  ? "Check your email for a reset link"
                  : "Enter your email to receive a reset link"}
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                If an account exists for <strong className="text-foreground">{email}</strong>, you'll receive a password reset email shortly.
              </p>
              <Link to="/login" className="text-sm font-medium text-primary">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!email.trim()}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
              >
                Send Reset Link
              </button>
            </form>
          )}

          <Link to="/login" className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to Sign In
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;
