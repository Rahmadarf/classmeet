"use client";

import { AlertCircle } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { signInStaff } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

/** Formulir masuk staf. Tidak menyimpan kata sandi di URL atau penyimpanan peramban; dikirim lewat server action. */
export function LoginForm() {
  const uid = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await signInStaff({ username, password });
        if (result.ok) {
          // Muat ulang penuh: proxy dan server harus membaca cookie sesi yang baru.
          window.location.href = result.redirectTo;
          return;
        }
        setMessage(result.message);
        setPassword("");
      } catch {
        setMessage("Koneksi bermasalah. Coba lagi.");
      }
    });
  };

  const field =
    "rounded-control border-line bg-field text-ink min-h-12 w-full border px-4 text-lg focus:border-brand-text";

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-user`} className="text-ink-muted text-[15px] font-semibold">
          Nama akun
        </label>
        <input
          id={`${uid}-user`}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-pass`} className="text-ink-muted text-[15px] font-semibold">
          Kata sandi
        </label>
        <input
          id={`${uid}-pass`}
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </div>

      <div aria-live="polite" className="min-h-6">
        {message ? (
          <p className="text-bad-text flex items-start gap-2 text-base font-medium">
            <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        block
        loading={pending}
        loadingText="Masuk…"
        disabled={!username || !password}
      >
        Masuk
      </Button>
    </form>
  );
}
