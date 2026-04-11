"use client";

import { SecurityCard } from "@/components/settings/SecurityCard";

type Props = {
  email?: string;
};

export function SettingsPage({ email }: Props) {
  return <SecurityCard email={email} />;
}
