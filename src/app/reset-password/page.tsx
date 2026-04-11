"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordModal } from "@/components/settings/PasswordModal";
import { Button } from "@/components/ui/Button";

function parseHash(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  return {
    accessToken: params.get("access_token") || "",
    refreshToken: params.get("refresh_token") || "",
    type: params.get("type") || "",
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  useEffect(() => {
    const parsed = parseHash(window.location.hash);
    setAccessToken(parsed.accessToken);
    setRefreshToken(parsed.refreshToken);
  }, []);

  const tokenReady = useMemo(() => Boolean(accessToken && refreshToken), [accessToken, refreshToken]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-6">
      <div className="w-full rounded-3xl border border-white/40 bg-white/90 p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900/75">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Reset Password</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          Create a new secure password for your SmartHire account.
        </p>
        {!tokenReady ? (
          <p className="mt-4 text-sm text-amber-600">Reset token missing or expired. Please request a new reset link.</p>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => setOpen(true)} disabled={!tokenReady}>
            Open Reset Form
          </Button>
          <Button variant="outline" onClick={() => router.push("/login")}>
            Back to Login
          </Button>
        </div>
      </div>

      <PasswordModal
        open={open}
        mode="reset"
        accessToken={accessToken}
        refreshToken={refreshToken}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) router.push("/login");
        }}
      />
    </div>
  );
}
