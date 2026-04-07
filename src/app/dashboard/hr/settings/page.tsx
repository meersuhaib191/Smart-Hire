import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";

export default function HrSettingsPage() {
  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>HR Settings</CardTitle>
          <CardDescription>Company-level hiring preferences and defaults.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Settings scaffolding is now in place. Next step can be wiring stage thresholds and scoring defaults.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
