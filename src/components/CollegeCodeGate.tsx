import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Check, X } from "lucide-react";

const STORAGE_KEY = "college_code_verified_v1";

export function isCollegeCodeVerified(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const rules = [
  { label: "At least 8 characters", test: (s: string) => s.length >= 8 },
  { label: "One uppercase letter (A-Z)", test: (s: string) => /[A-Z]/.test(s) },
  { label: "One lowercase letter (a-z)", test: (s: string) => /[a-z]/.test(s) },
  { label: "One number (0-9)", test: (s: string) => /\d/.test(s) },
  { label: "One special character (!@#$…)", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
];

export function CollegeCodeGate({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const results = rules.map((r) => ({ ...r, ok: r.test(code) }));
  const allOk = results.every((r) => r.ok);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!allOk) return;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    onVerified();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle>Enter College Code</CardTitle>
          <CardDescription>
            Enter the code provided by your college to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="college-code">College Code</Label>
              <Input
                id="college-code"
                type="text"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. MyCollege@2026"
                autoFocus
              />
            </div>

            <ul className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
              {results.map((r) => (
                <li
                  key={r.label}
                  className={`flex items-center gap-2 ${
                    r.ok ? "text-green-600" : submitted ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {r.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>

            <Button type="submit" className="w-full" disabled={!allOk}>
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
