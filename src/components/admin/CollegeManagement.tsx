import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus, ChevronLeft, Trash2, Pencil, ArrowUp, Copy, Building2, GraduationCap, Loader2,
} from "lucide-react";

type College = { id: string; name: string; photo_url: string | null; created_at: string };
type Klass = {
  id: string; name: string; division: string | null; year: string | null; academic_year: string | null;
  teacher_class_code: string | null; student_class_code: string | null; college_id: string | null;
};

export function CollegeManagement() {
  const [openCollegeId, setOpenCollegeId] = React.useState<string | null>(null);
  return openCollegeId
    ? <CollegeDetail collegeId={openCollegeId} onBack={() => setOpenCollegeId(null)} />
    : <CollegesList onOpen={setOpenCollegeId} />;
}

function CollegesList({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const [items, setItems] = React.useState<College[] | null>(null);
  const [name, setName] = React.useState("");
  const [photo, setPhoto] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from("colleges").select("*").eq("admin_id", user.id).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems((data ?? []) as College[]);
  }, [user]);
  React.useEffect(() => { load(); }, [load]);

  async function create() {
    if (!name.trim() || !user) return;
    setBusy(true);
    const { error } = await supabase.from("colleges").insert({ admin_id: user.id, name: name.trim(), photo_url: photo.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setName(""); setPhoto(""); setOpen(false); load();
    toast.success("College created");
  }
  async function remove(id: string) {
    const { error } = await supabase.from("colleges").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("College deleted"); load();
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="brand-font text-2xl">Your Colleges</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" className="rounded-full"><Plus className="mr-1 h-4 w-4" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create College</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>College Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mhatre College" />
              </div>
              <div className="space-y-1.5">
                <Label>Profile Photo URL (optional)</Label>
                <Input value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <DialogFooter><Button onClick={create} disabled={busy || !name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items === null && <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      {items && items.length === 0 && (
        <Card className="card-soft rounded-2xl p-8 text-center text-sm text-muted-foreground">
          No colleges yet. Tap “New” to create one.
        </Card>
      )}

      <div className="space-y-3">
        {items?.map((c) => (
          <Card key={c.id} className="card-soft rounded-2xl p-0">
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => onOpen(c.id)} className="flex flex-1 items-center gap-3 text-left">
                {c.photo_url
                  ? <img src={c.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                  : <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-6 w-6" /></div>}
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Tap to manage classes</p>
                </div>
              </button>
              <ConfirmDelete title="Delete college?" desc="This will remove all classes inside it. This cannot be undone." onConfirm={() => remove(c.id)} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CollegeDetail({ collegeId, onBack }: { collegeId: string; onBack: () => void }) {
  const [college, setCollege] = React.useState<College | null>(null);
  const [classes, setClasses] = React.useState<Klass[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Klass | null>(null);
  const [form, setForm] = React.useState({ name: "", division: "", year: "" });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const [{ data: c }, { data: cls }] = await Promise.all([
      supabase.from("colleges").select("*").eq("id", collegeId).maybeSingle(),
      supabase.from("classes").select("id,name,division,year,academic_year,teacher_class_code,student_class_code,college_id").eq("college_id", collegeId).order("created_at", { ascending: false }),
    ]);
    setCollege((c ?? null) as College | null);
    setClasses((cls ?? []) as Klass[]);
  }, [collegeId]);
  React.useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setForm({ name: "", division: "", year: String(new Date().getFullYear()) }); setOpen(true); }
  function openEdit(k: Klass) { setEditing(k); setForm({ name: k.name, division: k.division ?? "", year: k.year ?? "" }); setOpen(true); }

  async function save() {
    if (!form.name.trim()) return;
    setBusy(true);
    if (editing) {
      const { error } = await supabase.from("classes").update({
        name: form.name.trim(), division: form.division.trim() || null, year: form.year.trim() || null,
      }).eq("id", editing.id);
      if (error) { setBusy(false); return toast.error(error.message); }
      toast.success("Class updated");
    } else {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { setBusy(false); return toast.error("Not signed in"); }
      const { error } = await supabase.from("classes").insert({
        name: form.name.trim(), division: form.division.trim() || null, year: form.year.trim() || null,
        college_id: collegeId, semester: form.year.trim() || "1", academic_year: form.year.trim() || String(new Date().getFullYear()),
        class_code: "", teacher_id: uid,
      });
      if (error) { setBusy(false); return toast.error(error.message); }
      toast.success("Class created");
    }
    setBusy(false); setOpen(false); load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Class deleted"); load();
  }
  async function promote(k: Klass) {
    const y = parseInt((k.year ?? k.academic_year ?? "").replace(/\D/g, ""), 10);
    const nextYear = Number.isFinite(y) ? String(y + 1) : String(new Date().getFullYear() + 1);
    const { error } = await supabase.from("classes").update({ year: nextYear, academic_year: nextYear }).eq("id", k.id);
    if (error) return toast.error(error.message);
    toast.success(`Promoted to ${nextYear}`); load();
  }

  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); toast.success("Copied"); } catch { toast.error("Copy failed"); } };

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-4">
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm font-medium text-primary">
        <ChevronLeft className="h-4 w-4" /> Back to colleges
      </button>
      <div className="mb-4">
        <h2 className="brand-font text-2xl">{college?.name ?? "…"}</h2>
        <p className="text-xs text-muted-foreground">{classes?.length ?? 0} class{classes?.length === 1 ? "" : "es"}</p>
      </div>

      <Button onClick={openCreate} className="mb-4 w-full rounded-xl"><Plus className="mr-1 h-4 w-4" />Add Class</Button>

      <div className="space-y-3">
        {classes?.map((k) => (
          <Card key={k.id} className="card-soft rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[k.division && `Div ${k.division}`, k.year && `Year ${k.year}`].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => openEdit(k)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => promote(k)} className="h-8 w-8" title="Promote to next year"><ArrowUp className="h-4 w-4" /></Button>
                <ConfirmDelete title="Delete class?" desc="This removes the class and all its data." onConfirm={() => remove(k.id)} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <CodeRow label="Teacher Code" code={k.teacher_class_code} onCopy={copy} />
              <CodeRow label="Student Code" code={k.student_class_code} onCopy={copy} />
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Class" : "Add Class"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Class Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. BSc IT" /></div>
            <div className="space-y-1.5"><Label>Division</Label>
              <Input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} placeholder="e.g. A" /></div>
            <div className="space-y-1.5"><Label>Year</Label>
              <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="e.g. 2026" /></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={busy || !form.name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CodeRow({ label, code, onCopy }: { label: string; code: string | null; onCopy: (t: string) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm font-semibold">{code ?? "—"}</p>
      </div>
      {code && (
        <Button size="icon" variant="ghost" onClick={() => onCopy(code)} className="h-8 w-8">
          <Copy className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function ConfirmDelete({ title, desc, onConfirm }: { title: string; desc: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{desc}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Extra unused import guards
void GraduationCap;
