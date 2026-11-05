"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Compass, GraduationCap, Library, LogOut, Orbit, Plus, Sparkles, X, ChevronRight, MoonStar } from "lucide-react";
import { api, clearToken, getToken, setToken } from "../lib/api";
import DashboardCalendar from "./components/DashboardCalendar";
import AcademicsWorkspace from "./components/AcademicsWorkspace";

type Subject = { id: number; name: string; code?: string | null; description?: string | null; term?: string | null };
type OverviewData = {
  subjects: {subject_id:number;subject_name:string;term:string|null;total_concepts:number;assessed_concepts:number}[];
  upcoming_exams: {id:number;subject_id:number;title:string;exam_date:string}[];
  continue_learning: {concept_id:number;title:string;topic_title:string;subject_id:number;subject_name:string;reason:"needs_practice"|"review_due"|"not_assessed";next_review_at:string|null}[];
  recent_activity: {concept_title:string;subject_name:string;reviewed_at:string;understanding:string;recall:string}[];
};
type Quote = { quote: string; author: string; work?: string | null };
type AuthMode = "login" | "register";
const nav = [
  { label: "Overview", icon: Orbit },
  { label: "Academics", icon: GraduationCap },
  { label: "Explore", icon: Compass },
  { label: "My Universe", icon: Library },
];
const copy: Record<string, { eyebrow: string; title: string; description: string }> = {
  Overview: { eyebrow: "YOUR SPACE", title: "Leave a little room to wonder.", description: "this is like your homepage and dashboard stuff." },
  Academics: { eyebrow: "YOUR STUDIES", title: "The foundations.", description: "Keep your subjects, syllabi and learning progress in one quiet place." },
  Explore: { eyebrow: "BEYOND THE SYLLABUS", title: "Follow a question.", description: "Curiosity rarely follows a straight line. That's the interesting part." },
  "My Universe": { eyebrow: "YOUR KNOWLEDGE", title: "Things worth keeping.", description: "A growing collection of ideas, notes and connections that are yours." },
};

export default function Home() {
  const [token, setAuth] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [focusSubjectId, setFocusSubjectId] = useState<number | null>(null);
  const [active, setActive] = useState("Overview");
  const [showAdd, setShowAdd] = useState(false);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [subjectTerm, setSubjectTerm] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quotePhase, setQuotePhase] = useState<"idle" | "out" | "in">("idle");

  async function loadSubjects() { setSubjects(await api<Subject[]>("/subjects")); }
  async function loadOverview() {
    setOverviewLoading(true);
    try { setOverview(await api<OverviewData>("/overview")); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load your overview."); }
    finally { setOverviewLoading(false); }
  }
  const loadQuote = useCallback(async (random = false) => {
    setQuoteLoading(true);
    setQuoteError("");
    if (random) {
      setQuotePhase("out");
      await new Promise(resolve => window.setTimeout(resolve, 190));
    }
    try {
      const next = await api<Quote>(`/quotes/${random ? "random" : "daily"}`);
      setQuote(next);
      if (random) {
        setQuotePhase("in");
        window.setTimeout(() => setQuotePhase("idle"), 620);
      }
    } catch (e) {
      setQuoteError(e instanceof Error ? e.message : "Could not load a quote");
      setQuotePhase("idle");
    } finally {
      setQuoteLoading(false);
    }
  }, []);
  useEffect(() => {
    const saved = getToken();
    if (saved) setAuth(saved);
    setInitialized(true);
  }, []);
  useEffect(() => { if (token) { loadSubjects().catch(e => setError(e.message)); void loadOverview(); } }, [token]);
  useEffect(() => { if (token) void loadQuote(); }, [token, loadQuote]);

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
  function openAddSubject() {
    setEditingSubjectId(null);
    setSubjectName(""); setSubjectCode(""); setSubjectDescription(""); setSubjectTerm("");
    setShowAdd(true);
  }
  function openEditSubject(subject: Subject) {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code ?? "");
    setSubjectDescription(subject.description ?? "");
    setSubjectTerm(subject.term ?? "");
    setShowAdd(true);
  }
  async function addSubject(e: React.FormEvent) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const payload = { name: subjectName.trim(), code: subjectCode.trim() || null, description: subjectDescription.trim() || null, term: subjectTerm.trim() || null };
      if (editingSubjectId !== null) {
        await api<Subject>(`/subjects/${editingSubjectId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api<Subject>("/subjects", { method: "POST", body: JSON.stringify(payload) });
      }
      setSubjectName(""); setSubjectCode(""); setSubjectDescription(""); setSubjectTerm(""); setEditingSubjectId(null); setShowAdd(false); await Promise.all([loadSubjects(),loadOverview()]);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save subject"); }
    finally { setBusy(false); }
  }
  async function deleteSubject(id: number) {
    try { await api<void>(`/subjects/${id}`, { method: "DELETE" }); await Promise.all([loadSubjects(),loadOverview()]); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete subject"); }
  }

  if (!initialized) return <main className="atlas-loading"><Orbit size={25}/></main>;

  if (!token) return (
    <main className="atlas-auth-shell">
      <div className="atlas-auth-orbit" />
      <section className="atlas-auth-card">
        <Brand />
        <div className="atlas-auth-intro">
        </div>
        <form onSubmit={authenticate} className="atlas-form">
          <label>Email address<input type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></label>
          <label>Password<input type="password" placeholder="Your password" value={password} onChange={e=>setPassword(e.target.value)} minLength={4} required autoComplete={mode==="login"?"current-password":"new-password"}/></label>
          {error && <p className="atlas-error">{error}</p>}
          <button disabled={busy} className="atlas-button atlas-primary atlas-full">{busy?"One moment…":mode==="login"?"Sign in":"Create account"}<ArrowUpRight size={16}/></button>
        </form>
        <button className="atlas-auth-switch" onClick={()=>{setMode(mode==="login"?"register":"login");setError("");}}>{mode==="login"?"New to Atlas? Create an account":"Already have an account? Sign in"}</button>
        <div className="atlas-auth-foot"><span/>All the time in the world to be curious<span/></div>
      </section>
    </main>
  );

  const activeCopy = copy[active];
  return (
    <main className="atlas-app">
      <aside className="atlas-sidebar">
        <Brand/>
        <div className="atlas-sidebar-rule"/>
        <p className="atlas-nav-label">WORKSPACE</p>
        <nav className="atlas-nav">
          {nav.map(item=>{const Icon=item.icon;const selected=active===item.label;return (
            <button key={item.label} onClick={()=>setActive(item.label)} className={`atlas-nav-item ${selected?"active":""}`} aria-current={selected?"page":undefined}>
              <Icon size={17} strokeWidth={1.7}/><span>{item.label}</span>{selected&&<i/>}
            </button>
          );})}
        </nav>
        <div className="atlas-sidebar-bottom">
          <button className="atlas-signout" onClick={()=>{clearToken();setAuth(null);}}><LogOut size={15}/> Sign out</button>
        </div>
      </aside>

      <section className="atlas-main">
        <header className="atlas-topbar">
          <div className="atlas-breadcrumb"><b>ATLAS</b><ChevronRight size={13}/>{active}</div>
        </header>
        <div className="atlas-content">
          <header className="atlas-page-heading">
            <div><p className="eyebrow">{activeCopy.eyebrow}</p><h1 key={active} className="atlas-page-title">{activeCopy.title}</h1><p className="atlas-page-description">{activeCopy.description}</p></div>
          </header>
          {error&&<div className="atlas-alert" role="alert"><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}

          {active==="Overview"&&<>
            <section
              className={`atlas-welcome atlas-quote-card${quoteLoading ? " is-changing" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Show another quote"
              aria-disabled={quoteLoading}
              onClick={() => { if (!quoteLoading) void loadQuote(true); }}
              onKeyDown={e => {
                if ((e.key === "Enter" || e.key === " ") && !quoteLoading) {
                  e.preventDefault();
                  void loadQuote(true);
                }
              }}
            >
              <div className={`atlas-welcome-copy quote-${quotePhase}`}>
                <p className="eyebrow">A NUGGET OF KNOWLEDGE, JUST FOR YOU</p>
                <h2 className="atlas-quote-text" aria-live="polite">
                  {quote ? `“${quote.quote}”` : quoteLoading ? "Finding today's thought…" : quoteError ? "A little curiosity goes a long way." : "Today's thought is waiting."}
                </h2>
                {quote && <p className="atlas-quote-author">— {quote.author}{quote.work ? `, ${quote.work}` : ""}</p>}
                {quoteError && <p className="atlas-quote-error" role="status">The quote service is taking a breather. The rest of Atlas is still ready for you.</p>}
                <p className="atlas-quote-hint">{quoteLoading ? "Turning the page…" : quoteError ? "Tap to try again" : "Click anywhere to discover another thought"}</p>
              </div>
              <div className="atlas-orbit-art" aria-hidden="true">
                <div className="orbit-ring one"/><div className="orbit-ring two"/><div className="orbit-ring three"/>
                <div className="orbit-core"><Orbit size={32} strokeWidth={1}/></div>
                <span className="orbit-star a">✦</span><span className="orbit-star b">·</span><span className="orbit-star c">✧</span>
              </div>
              <div className="atlas-quote-shimmer" aria-hidden="true"/>
            </section>
            <section className="atlas-overview-section">
              <div className="atlas-section-heading">
                <div><p className="eyebrow">YOUR ACADEMIC SPACE</p><h2>Subjects on your map</h2></div>
                <button className="atlas-button atlas-secondary" onClick={()=>{setActive("Academics");openAddSubject();}}><Plus size={15}/> Add subject</button>
              </div>
              <div className="atlas-subject-summary">
                <div className="atlas-subject-count"><strong>{String(subjects.length).padStart(2,"0")}</strong><span>SUBJECTS</span></div>
                <div className="atlas-summary-divider"/>
                <p>{subjects.length?"Your semester, gathered in one place. Pick a subject and keep building your understanding.":"Your academic universe starts with the subjects you're studying this semester."}</p>
                <button className="atlas-round-arrow" onClick={()=>setActive("Academics")} aria-label="View academics"><ArrowUpRight size={17}/></button>
              </div>
              <SubjectGrid subjects={subjects} onDelete={deleteSubject} onEdit={openEditSubject}/>
            </section>
            <section className="atlas-overview-section atlas-dashboard-intelligence">
              <div className="atlas-section-heading"><div><p className="eyebrow">A LITTLE DIRECTION</p><h2>Your next study steps</h2><p className="atlas-section-subtitle">Suggestions based on your own progress, not guessed grades.</p></div><span className="atlas-overview-sync">{overviewLoading?"UPDATING":"FROM YOUR LEARNING RECORDS"}</span></div>
              <div className="atlas-overview-intelligence-grid">
                <section className="atlas-overview-card atlas-continue-card"><div className="atlas-overview-card-heading"><BookOpen size={16}/><h3>Continue learning</h3></div>
                  {overview?.continue_learning.length ? overview.continue_learning.slice(0,5).map(item=><button key={item.concept_id} className="atlas-continue-item" onClick={()=>{setFocusSubjectId(item.subject_id);setActive("Academics");}}><span><strong>{item.title}</strong><small>{item.topic_title} · {item.subject_name}</small></span><em>{item.reason==="needs_practice"?"Needs practice":item.reason==="review_due"?"Review due":"Not assessed"}</em><ArrowUpRight size={14}/></button>) : <p className="atlas-overview-empty">{overviewLoading?"Gathering your study map…":"Nothing is asking for attention right now. Add concepts to your syllabus or review one to get started."}</p>}
                </section>
                <section className="atlas-overview-card"><div className="atlas-overview-card-heading"><CalendarDays size={16}/><h3>Coming up</h3></div>
                  {overview?.upcoming_exams.length ? overview.upcoming_exams.slice(0,5).map(exam=><div className="atlas-upcoming-item" key={exam.id}><span><strong>{exam.title}</strong><small>{subjects.find(s=>s.id===exam.subject_id)?.name ?? "Subject"}</small></span><time>{new Date(exam.exam_date).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></div>) : <p className="atlas-overview-empty">{overviewLoading?"Loading dates…":"No upcoming exams. Add an exam date in Academics when you have one."}</p>}
                </section>
                <section className="atlas-overview-card"><div className="atlas-overview-card-heading"><Sparkles size={16}/><h3>Recent reviews</h3></div>
                  {overview?.recent_activity.length ? overview.recent_activity.slice(0,5).map((activity,i)=><div className="atlas-recent-item" key={activity.concept_title+activity.reviewed_at+i}><span><strong>{activity.concept_title}</strong><small>{activity.subject_name} · {activity.understanding.replace("_"," ")}</small></span><time>{new Date(activity.reviewed_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</time></div>) : <p className="atlas-overview-empty">{overviewLoading?"Loading activity…":"Your review history will appear here as you check in on concepts."}</p>}
                </section>
                <section className="atlas-overview-card atlas-subject-progress-card"><div className="atlas-overview-card-heading"><GraduationCap size={16}/><h3>Concept map</h3></div>
                  {overview?.subjects.length ? overview.subjects.map(item=><div className="atlas-subject-progress-item" key={item.subject_id}><span><strong>{item.subject_name}</strong><small>{item.term || "No term set"}</small></span><div><strong>{item.assessed_concepts}/{item.total_concepts}</strong><small>assessed</small></div></div>) : <p className="atlas-overview-empty">Add concepts to your subjects to see your learning map take shape.</p>}
                </section>
              </div>
            </section>
            <section className="atlas-overview-section atlas-calendar-section"><DashboardCalendar /></section>
          </>}

          {active==="Academics"&&<section className="atlas-overview-section">
            <div className="atlas-section-heading"><div><p className="eyebrow">THE BUILDING BLOCKS</p><h2>Your subjects</h2><p className="atlas-section-subtitle">A home for syllabi, concepts and revision.</p></div><button className="atlas-button atlas-primary" onClick={openAddSubject}><Plus size={15}/> Add subject</button></div>
            <AcademicsWorkspace subjects={subjects} focusSubjectId={focusSubjectId} onOverviewRefresh={loadOverview}/>
          </section>}

          {active==="Explore"&&<FeatureEmpty icon={<Sparkles size={23}/>} eyebrow="THE CURIOSITY PLAYGROUND" title={<>What have you been<br/><em>wondering about?</em></>} text="Exploration is on its way. For now, remember: your interests don't need to fit inside a syllabus." foot="A LITTLE SPACE FOR THE UNEXPECTED"/>}
          {active==="My Universe"&&<FeatureEmpty icon={<Library size={23}/>} eyebrow="YOUR PERSONAL KNOWLEDGE LIBRARY" title={<>A universe<br/><em>of your own.</em></>} text="Saved concepts, notes and connections will live here. A place for the ideas you want to return to." foot="COLLECT THOUGHTS. CONNECT IDEAS."/>}
        </div>
      </section>

      {showAdd&&<div className="atlas-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
        <form onSubmit={addSubject} className="atlas-modal">
          <div className="atlas-modal-heading"><div><p className="eyebrow">ACADEMICS</p><h2>{editingSubjectId === null ? "Add a subject" : "Edit subject"}</h2></div><button type="button" className="atlas-icon-button" onClick={()=>setShowAdd(false)} aria-label="Close"><X size={18}/></button></div>
          <label className="atlas-modal-label">Subject name<input autoFocus required value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="e.g. Machine Learning"/></label>
          <label className="atlas-modal-label">Course code <small>OPTIONAL</small><input value={subjectCode} onChange={e=>setSubjectCode(e.target.value)} placeholder="e.g. CS402"/></label>
          <label className="atlas-modal-label">Term / semester <small>OPTIONAL</small><input value={subjectTerm} onChange={e=>setSubjectTerm(e.target.value)} placeholder="e.g. Semester 5 · Fall 2026" maxLength={60}/></label>
          <label className="atlas-modal-label">Description <small>OPTIONAL</small><textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)} placeholder="What does this subject cover?"/></label>
          <button disabled={busy} className="atlas-button atlas-primary atlas-full">{busy?"Saving…":editingSubjectId === null ? "Save subject" : "Save changes"}<ArrowUpRight size={16}/></button>
        </form>
      </div>}
    </main>
  );
}

function Brand(){return <div className="atlas-brand"><div className="atlas-brand-mark"><Orbit size={22} strokeWidth={1.35}/></div><div className="atlas-brand-word"><b><big>ATLAS</big></b><small>get it? cuz you can map your syllabus idk</small></div></div>;}
function FeatureEmpty({icon,eyebrow,title,text,foot}:{icon:React.ReactNode;eyebrow:string;title:React.ReactNode;text:string;foot:string}){
  return <section className="atlas-feature-empty"><div className="atlas-feature-icon">{icon}</div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="atlas-feature-text">{text}</p><div className="atlas-feature-foot"><span/>{foot}</div></section>;
}
function SubjectGrid({subjects,onDelete,onEdit}:{subjects:Subject[];onDelete:(id:number)=>void;onEdit:(subject:Subject)=>void}){
  if(!subjects.length)return <div className="atlas-empty-subjects"><div className="atlas-empty-icon"><BookOpen size={19}/></div><p>Your map is waiting for its first pin.</p><span>Add a subject to begin building your academic space.</span></div>;
  return <div className="atlas-subject-grid">{subjects.map((s,i)=><article key={s.id} className="atlas-subject-card" style={{animationDelay:`${i*65}ms`}}>
    <div className="atlas-subject-card-top"><div className="atlas-subject-glyph"><BookOpen size={17}/></div><div className="atlas-subject-card-actions"><button onClick={()=>onEdit(s)} className="atlas-remove atlas-edit-subject">Edit</button><button onClick={()=>onDelete(s.id)} className="atlas-remove">Remove</button></div></div>
    <p className="atlas-subject-code">{s.code||`SUBJECT ${String(i+1).padStart(2,"0")}`}</p><h3>{s.name}</h3>{s.term&&<p className="atlas-subject-term">{s.term}</p>}<p className="atlas-subject-description">{s.description||"Syllabus and concepts will live here."}</p>
    <div className="atlas-card-bottom"><span>YOUR ACADEMIC SPACE</span><ArrowUpRight size={14}/></div>
  </article>)}</div>;
}
