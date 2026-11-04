"use client";

import { useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "../lib/api";
import { BookOpen, Compass, GraduationCap, Library, Plus, Search, Sparkles, ArrowUpRight, LogOut, Orbit, X } from "lucide-react";

type Subject = { id: number; name: string; code?: string | null; description?: string | null };
type AuthMode = "login" | "register";

const nav = [
  { label: "Overview", icon: Orbit },
  { label: "Academics", icon: GraduationCap },
  { label: "Explore", icon: Compass },
  { label: "My Universe", icon: Library },
];

export default function Home() {
  const [token, setAuth] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [active, setActive] = useState("Overview");
  const [showAdd, setShowAdd] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSubjects() {
    const data = await api<Subject[]>("/subjects");
    setSubjects(data);
  }

  useEffect(() => {
    const saved = getToken();
    if (saved) setAuth(saved);
  }, []);

  useEffect(() => {
    if (token) loadSubjects().catch(e => setError(e.message));
  }, [token]);

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await api<{ access_token: string }>(`/auth/${mode}`, {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      setToken(result.access_token); setAuth(result.access_token);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  async function addSubject(e: React.FormEvent) {
    e.preventDefault(); setError("");
    try {
      await api<Subject>("/subjects", { method: "POST", body: JSON.stringify({ name: subjectName, code: subjectCode || null }) });
      setSubjectName(""); setSubjectCode(""); setShowAdd(false); await loadSubjects();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add subject"); }
  }

  async function deleteSubject(id: number) {
    try { await api<void>(`/subjects/${id}`, { method: "DELETE" }); await loadSubjects(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete subject"); }
  }

  if (!token) return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-md rounded-3xl border border-atlas-line bg-atlas-panel p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3"><div className="rounded-xl bg-atlas-gold/10 p-3 text-atlas-gold"><Orbit size={24}/></div><div><div className="text-xl font-semibold tracking-[0.18em]">ATLAS</div><div className="text-xs text-atlas-muted">get it cuz you can navigate your syllabus idk</div></div></div>
        <form onSubmit={authenticate} className="space-y-4">
          <input className="w-full rounded-xl border border-atlas-line bg-atlas-bg px-4 py-3 outline-none focus:border-atlas-gold" type="email" placeholder="Email address" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <input className="w-full rounded-xl border border-atlas-line bg-atlas-bg px-4 py-3 outline-none focus:border-atlas-gold" type="password" placeholder="Password (8+ characters)" value={password} onChange={e=>setPassword(e.target.value)} minLength={4} required/>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-atlas-gold py-3 font-semibold text-[#17140F] transition hover:brightness-110 disabled:opacity-50">{busy ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}} className="mt-5 w-full text-sm text-atlas-muted hover:text-atlas-text">{mode==="login"?"New here? Create an account":"Already have an account? Sign in"}</button>
        <p className="mt-4 text-center text-xs text-atlas-muted"><i>All the time in the world to be curious.</i></p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen md:flex">
      <aside className="border-b border-atlas-line bg-[#0E1118] p-5 md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="mb-10 flex items-center gap-3"><div className="rounded-xl bg-atlas-gold/10 p-2.5 text-atlas-gold"><Orbit size={22}/></div><div><div className="font-semibold tracking-[0.2em]">ATLAS</div><div className="text-[11px] text-atlas-muted">Find your way through knowledge</div></div></div>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-atlas-muted">Workspace</div>
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {nav.map(item=>{const Icon=item.icon;return <button key={item.label} onClick={()=>setActive(item.label)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${active===item.label?"bg-atlas-gold/10 text-atlas-gold":"text-atlas-muted hover:bg-white/5 hover:text-atlas-text"}`}><Icon size={18}/>{item.label}</button>})}
        </nav>
        <button onClick={()=>{clearToken();setAuth(null);}} className="mt-5 flex items-center gap-2 text-sm text-atlas-muted hover:text-atlas-text md:mt-auto"><LogOut size={16}/> Sign out</button>
      </aside>

      <section className="w-full px-5 py-8 md:ml-64 md:px-10 md:py-10">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div><p className="mb-2 text-xs uppercase tracking-[0.22em] text-atlas-gold">YOUR SPACE · NOVEMBER 2026</p><h1 className="text-3xl font-semibold md:text-4xl">{active==="Overview"?"Good to have you here.":active}</h1><p className="mt-2 text-sm text-atlas-muted">{active==="Overview"?"A little structure for your studies. Plenty of room for everything else.": "Your learning space, at your own pace."}</p></div>
          <div className="flex items-center gap-2 rounded-full border border-atlas-line bg-atlas-panel px-4 py-2 text-xs text-atlas-muted"><Search size={14}/> Your universe is yours</div>
        </header>

        {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">{error}<button onClick={()=>setError("")}><X size={16}/></button></div>}

        {active==="Overview" && <>
          <div className="mb-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="relative overflow-hidden rounded-3xl border border-atlas-line bg-gradient-to-br from-[#1B2432] to-[#121620] p-7 md:p-9">
              <div className="absolute -right-10 -top-16 h-64 w-64 rounded-full border border-atlas-gold/10"/><div className="absolute -right-2 -top-8 h-48 w-48 rounded-full border border-atlas-gold/10"/>
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-atlas-gold">A note to begin with</p><h2 className="max-w-lg text-2xl font-medium leading-snug md:text-3xl">Learning isn't a race to the finish line.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">Keep track of what matters for class. Leave a little room for the things that make you wonder.</p>
              <button onClick={()=>setActive("Explore")} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-atlas-gold px-4 py-3 text-sm font-semibold text-[#17140F] hover:brightness-110">Follow a curiosity <ArrowUpRight size={16}/></button>
            </div>
            <div className="rounded-3xl border border-atlas-line bg-atlas-panel p-7"><div className="mb-5 flex items-center justify-between"><span className="text-sm text-atlas-muted">Your academic space</span><GraduationCap className="text-atlas-gold" size={20}/></div><div className="text-5xl font-semibold">{subjects.length.toString().padStart(2,"0")}</div><p className="mt-2 text-sm text-atlas-muted">Subjects on your map</p><div className="mt-7 h-px bg-atlas-line"/><p className="mt-5 text-xs leading-5 text-atlas-muted">Start by adding the subjects you're studying this semester. We'll build from there.</p><button onClick={()=>{setActive("Academics");setShowAdd(true)}} className="mt-4 text-sm text-atlas-gold hover:underline">Add a subject →</button></div>
          </div>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-medium">Your subjects</h2><p className="mt-1 text-xs text-atlas-muted">The academic foundations of your universe</p></div><button onClick={()=>{setActive("Academics");setShowAdd(true)}} className="flex items-center gap-2 rounded-xl border border-atlas-line px-3 py-2 text-sm hover:border-atlas-gold"><Plus size={16}/> Add subject</button></div>
          <SubjectGrid subjects={subjects} onDelete={deleteSubject}/>
        </>}

        {active==="Academics" && <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-medium">Your subjects</h2><p className="mt-1 text-sm text-atlas-muted">A home for syllabi, concepts and revision.</p></div><button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 rounded-xl bg-atlas-gold px-4 py-3 text-sm font-semibold text-[#17140F]"><Plus size={16}/> Add subject</button></div>
          <SubjectGrid subjects={subjects} onDelete={deleteSubject}/>
        </>}

        {active==="Explore" && <div className="rounded-3xl border border-atlas-line bg-atlas-panel p-8 md:p-12"><Sparkles className="mb-5 text-atlas-gold" size={28}/><p className="mb-2 text-xs uppercase tracking-[0.2em] text-atlas-gold">The curiosity playground</p><h2 className="max-w-xl text-3xl font-medium">What have you been wondering about?</h2><p className="mt-3 max-w-xl text-sm leading-6 text-atlas-muted">Explore is coming in Sprint 3. For now, let this be a reminder that your interests don't need to fit inside a syllabus.</p></div>}
        {active==="My Universe" && <div className="rounded-3xl border border-atlas-line bg-atlas-panel p-8 md:p-12"><Library className="mb-5 text-atlas-gold" size={28}/><h2 className="text-3xl font-medium">A universe of your own.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-atlas-muted">Saved concepts, notes and connections will live here. We're giving them a home in a later sprint.</p></div>}
      </section>

      {showAdd && <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4"><form onSubmit={addSubject} className="w-full max-w-md rounded-3xl border border-atlas-line bg-atlas-panel p-7 shadow-2xl"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-atlas-gold">Academics</p><h2 className="mt-1 text-xl font-semibold">Add a subject</h2></div><button type="button" onClick={()=>setShowAdd(false)} className="text-atlas-muted hover:text-white"><X/></button></div><label className="mb-2 block text-sm text-atlas-muted">Subject name</label><input autoFocus required value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="e.g. Machine Learning" className="mb-4 w-full rounded-xl border border-atlas-line bg-atlas-bg px-4 py-3 outline-none focus:border-atlas-gold"/><label className="mb-2 block text-sm text-atlas-muted">Course code <span className="opacity-60">(optional)</span></label><input value={subjectCode} onChange={e=>setSubjectCode(e.target.value)} placeholder="e.g. CS402" className="w-full rounded-xl border border-atlas-line bg-atlas-bg px-4 py-3 outline-none focus:border-atlas-gold"/><button className="mt-6 w-full rounded-xl bg-atlas-gold py-3 font-semibold text-[#17140F]">Save subject</button></form></div>}
    </main>
  );
}

function SubjectGrid({subjects,onDelete}:{subjects:Subject[];onDelete:(id:number)=>void}) {
  if (!subjects.length) return <div className="rounded-2xl border border-dashed border-atlas-line px-6 py-14 text-center"><BookOpen className="mx-auto mb-3 text-atlas-muted" size={26}/><p className="font-medium">Your map is waiting for its first pin.</p><p className="mt-2 text-sm text-atlas-muted">Add a subject to begin building your academic space.</p></div>;
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{subjects.map((s,i)=><article key={s.id} className="group rounded-2xl border border-atlas-line bg-atlas-panel p-5 transition hover:border-atlas-gold/50"><div className="mb-5 flex items-start justify-between"><div className="rounded-xl bg-atlas-gold/10 p-3 text-atlas-gold"><BookOpen size={19}/></div><button onClick={()=>onDelete(s.id)} className="text-xs text-atlas-muted opacity-0 transition hover:text-rose-400 group-hover:opacity-100">Remove</button></div><p className="text-xs uppercase tracking-widest text-atlas-muted">{s.code || `SUBJECT ${String(i+1).padStart(2,"0")}`}</p><h3 className="mt-2 text-lg font-medium">{s.name}</h3><p className="mt-2 text-xs text-atlas-muted">{s.description || "Syllabus and concepts will live here."}</p></article>)}</div>;
}
