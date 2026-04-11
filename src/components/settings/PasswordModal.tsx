"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type Mode = "change" | "reset";

type Props = {
  open: boolean;
  mode: Mode;
  accessToken?: string;
  refreshToken?: string;
  onOpenChange: (open: boolean) => void;
};

const strengthLabel = (score: number) => {
  if (score <= 1) return "Weak";
  if (score <= 3) return "Moderate";
  return "Strong";
};

const strengthScore = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

export function PasswordModal({ open, mode, accessToken, refreshToken, onOpenChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const score = useMemo(() => strengthScore(newPassword), [newPassword]);
  const progress = (score / 5) * 100;

  const resetState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setSaving(false);
  };

  const submit = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (score < 4) {
      toast.error("Use a stronger password (8+ chars, mixed case, number, symbol).");
      return;
    }

    setSaving(true);
    const endpoint = mode === "change" ? "/api/auth/change-password" : "/api/auth/reset-password";
    const payload =
      mode === "change"
        ? { currentPassword, newPassword, confirmPassword }
        : { accessToken, refreshToken, newPassword, confirmPassword };
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Password update failed.");
      setSaving(false);
      return;
    }
    toast.success(mode === "change" ? "Password changed successfully." : "Password reset successfully.");
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resetState();
        onOpenChange(value);
      }}
    >
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "change" ? "Change Password" : "Reset Password"}</DialogTitle>
          <DialogDescription>
            {mode === "change"
              ? "Verify your current password, then set a new secure password."
              : "Set a new password for your account."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {mode === "change" ? (
            <label className="block text-sm text-slate-600">
              Current password
              <div className="mt-1 flex items-center rounded-xl border border-slate-200 px-3">
                <LockKeyhole size={15} className="text-slate-400" />
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="h-10 w-full bg-transparent px-2 outline-none"
                />
                <button type="button" onClick={() => setShowCurrent((prev) => !prev)} className="text-slate-500">
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          ) : null}

          <label className="block text-sm text-slate-600">
            New password
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 px-3">
              <LockKeyhole size={15} className="text-slate-400" />
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 w-full bg-transparent px-2 outline-none"
              />
              <button type="button" onClick={() => setShowNew((prev) => !prev)} className="text-slate-500">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Password strength</span>
              <span>{strengthLabel(score)}</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <label className="block text-sm text-slate-600">
            Confirm password
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 px-3">
              <LockKeyhole size={15} className="text-slate-400" />
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 w-full bg-transparent px-2 outline-none"
              />
              <button type="button" onClick={() => setShowConfirm((prev) => !prev)} className="text-slate-500">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving..." : mode === "change" ? "Change Password" : "Reset Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
