import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap } from "lucide-react";

const STORAGE_KEY = "college_code_verified_v2";
export const COLLEGE_CODE = "mhatrecollege@badlapur2000";

export function isCollegeCodeVerified(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
}

export function CollegeCodeGate({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() !== COLLEGE_CODE) {
      setError("Incorrect college code. Please check with your college.");
      return;
    }
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    onVerified();
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-8">
      <Card className="w-full max-w-md card-soft">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10">
            <GraduationCap className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Enter College Code</CardTitle>
          <CardDescription>Enter the code provided by your college to unlock the app on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="college-code">College Code</Label>
              <Input id="college-code" type="text" autoComplete="off" value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                placeholder="Enter your college code" autoFocus className="h-11 rounded-xl" />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl">Continue</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
