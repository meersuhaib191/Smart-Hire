"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, LogOut, MailQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/store/useStore";
import { PasswordModal } from "@/components/settings/PasswordModal";

type Props = {
  email?: string;
};

function ActionRow({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-100">{icon}</div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{description}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function SecurityCard({ email = "" }: Props) {
  const router = useRouter();
  const { logout } = useStore();
  const [changeOpen, setChangeOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(email);
  const [sendingReset, setSendingReset] = useState(false);
  const [logoutAllDevices, setLogoutAllDevices] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const canSendReset = useMemo(() => /\S+@\S+\.\S+/.test(forgotEmail.trim()), [forgotEmail]);

  const sendForgotPassword = async () => {
    if (!canSendReset) {
      toast.error("Enter a valid registered email.");
      return;
    }
    setSendingReset(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Could not send reset link.");
      setSendingReset(false);
      return;
    }
    toast.success("Password reset link sent.");
    setSendingReset(false);
    setForgotOpen(false);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    if (logoutAllDevices) {
      const response = await fetch("/api/auth/logout-all", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(payload.error || "Failed to logout all devices.");
        setLoggingOut(false);
        return;
      }
    }
    await logout();
    toast.success("Logged out successfully.");
    router.push("/login");
    setLoggingOut(false);
  };

  return (
    <div className="rounded-3xl border border-white/40 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/75">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Security & Account</h3>
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Manage credentials and account session controls from one place.
        </p>
      </div>

      <div className="space-y-3">
        <ActionRow
          icon={<Lock size={16} />}
          title="Change Password"
          description="Verify current password and set a stronger one."
          action={
            <Button onClick={() => setChangeOpen(true)} className="rounded-xl">
              Change Password
            </Button>
          }
        />

        <ActionRow
          icon={<MailQuestion size={16} />}
          title="Forgot Password"
          description="Send a secure reset link to your registered email."
          action={
            <Button variant="outline" onClick={() => setForgotOpen(true)} className="rounded-xl">
              Forgot Password
            </Button>
          }
        />

        <ActionRow
          icon={<LogOut size={16} />}
          title="Logout"
          description="End your current session and optionally revoke all active sessions."
          action={
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="rounded-xl">
                  Logout
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Logout from account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You can sign in again anytime. Optionally logout from all devices for extra security.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <span className="flex items-center gap-2">
                    <KeyRound size={14} />
                    Logout from all devices
                  </span>
                  <Switch checked={logoutAllDevices} onCheckedChange={setLogoutAllDevices} />
                </label>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLogout} disabled={loggingOut}>
                    {loggingOut ? "Logging out..." : "Confirm Logout"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          }
        />
      </div>

      <PasswordModal open={changeOpen} mode="change" onOpenChange={setChangeOpen} />

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Forgot Password</DialogTitle>
            <DialogDescription>Enter your registered email to receive a reset link.</DialogDescription>
          </DialogHeader>
          <label className="block text-sm text-slate-600 dark:text-slate-300">
            Registered email
            <input
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgotOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendForgotPassword} disabled={!canSendReset || sendingReset}>
              {sendingReset ? "Sending..." : "Send Reset Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
