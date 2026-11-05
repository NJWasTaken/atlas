"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, Compass, GraduationCap, Library, LogOut, Orbit, Plus, Sparkles, X, ChevronRight, MoonStar } from "lucide-react";
import { api, clearToken, getToken, setToken } from "../lib/api";
import DashboardCalendar from "./components/DashboardCalendar";
import AcademicsWorkspace from "./components/AcademicsWorkspace";

type Subject = { id: number; name: string; code?: string | null; description?: string | null; term?: string | null; academic_year?: string | null };
type Quote = { quote: string; author: string; work?: string | null };
type OverviewActivity = { concept_id:number; concept_title:string; topic_title:string; subject_id:number; subject_name:string; understanding:string; recall:string; last_reviewed:string };
type OverviewSuggestion = { concept_id:number; concept_title:string; topic_title:string; subject_id:number; subject_name:string; reason:string[]; priority:number; days_until_exam:number|null; exam_title:string|null };
type OverviewExam = { id:number; subject_id:number; subject_name:string; title:string; exam_date:string; days_until:number };
type OverviewData = { learning_summary:{total_concepts:number;strong:number;developing:number;weak:number;not_assessed:number;due_for_review:number}; recent_activity:OverviewActivity[]; continue_learning:OverviewActivity[]; revision_suggestions:OverviewSuggestion[]; upcoming_exams:OverviewExam[] };
type AuthMode = "login" | "register";
const nav = [
  { label: "Overview", icon: Orbit },
  { label: "Academics", icon: GraduationCap },
  { label: "Explore", icon: Compass },
  { label: "My Universe", icon: Library },
];
const copy: Record<string, { eyebrow: string; title: string; description: string }> = {
  Overview: { eyebrow: "YOUR SPACE", title: "Leave a little room to wonder.", description: "A clear view of what you are learning, what is coming up, and what deserves a second look." },
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
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);
  const [subjectNotice, setSubjectNotice] = useState("");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");
  const [active, setActive] = useState("Overview");
  const [academicsFocus, setAcademicsFocus] = useState<{subjectId:number;conceptId:number}|null>(null);
  const handleAcademicsFocusHandled = useCallback(() => setAcademicsFocus(null), []);
  const [showAdd, setShowAdd] = useState(false);
  const [modalError, setModalError] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [subjectDescription, setSubjectDescription] = useState("");
  const [subjectTerm, setSubjectTerm] = useState("");
  const [subjectYear, setSubjectYear] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [quotePhase, setQuotePhase] = useState<"idle" | "out" | "in">("idle");

  async function loadSubjects() {
    setSubjectsLoading(true);
    setSubjectsError("");
    try {
      const next = await api<Subject[]>("/subjects");
      setSubjects(next);
      return next;
    } catch (e) {
      setSubjectsError(e instanceof Error ? e.message : "Could not load your subjects.");
      throw e;
    } finally {
      setSubjectsLoading(false);
    }
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
  useEffect(() => { if (token) void loadSubjects().catch(() => {}); }, [token]);
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      setOverview(await api<OverviewData>("/overview"));
      setOverviewError("");
    } catch(e) {
      setOverviewError(e instanceof Error ? e.message : "Could not load your learning overview");
    } finally {
      setOverviewLoading(false);
    }
  }, []);
  useEffect(() => {
    if (token && active === "Overview") void loadOverview();
  }, [token, active, loadOverview]);
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
    setSubjectName(""); setSubjectCode(""); setSubjectDescription(""); setSubjectTerm(""); setSubjectYear("");
    setModalError("");
    setShowAdd(true);
  }
  function openEditSubject(subject: Subject) {
    setEditingSubjectId(subject.id);
    setSubjectName(subject.name);
    setSubjectCode(subject.code ?? "");
    setSubjectDescription(subject.description ?? "");
    setSubjectTerm(subject.term ?? "");
    setSubjectYear(subject.academic_year ?? "");
    setModalError("");
    setShowAdd(true);
  }
  async function addSubject(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    setBusy(true);
    try {
      const payload = { name: subjectName.trim(), code: subjectCode.trim() || null, description: subjectDescription.trim() || null, term: subjectTerm.trim() || null, academic_year: subjectYear.trim() || null };
      const editing = editingSubjectId !== null;
      if (editing) {
        await api<Subject>(`/subjects/${editingSubjectId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api<Subject>("/subjects", { method: "POST", body: JSON.stringify(payload) });
      }
      setSubjectName(""); setSubjectCode(""); setSubjectDescription(""); setSubjectTerm(""); setSubjectYear(""); setEditingSubjectId(null); setShowAdd(false);
      setSubjectNotice(editing ? "Subject updated." : "Subject added.");
      await loadSubjects().catch(() => {});
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Could not save subject");
    } finally { setBusy(false); }
  }
  async function deleteSubject(id: number) {
    const subject = subjects.find(item => item.id === id);
    if (!subject || !window.confirm(`Remove "${subject.name}"? Its syllabus, concepts, progress and exam records will also be deleted.`)) return;
    setDeletingSubjectId(id);
    setError("");
    setSubjectNotice("");
    try {
      await api<void>(`/subjects/${id}`, { method: "DELETE" });
      await loadSubjects();
      setSubjectNotice(`"${subject.name}" was removed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete subject");
    } finally {
      setDeletingSubjectId(null);
    }
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
          {subjectNotice&&<div className="atlas-academics-notice" role="status">{subjectNotice}<button type="button" onClick={()=>setSubjectNotice("")} aria-label="Dismiss notification">×</button></div>}

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
                  {quote ? `“${quote.quote}”` : quoteLoading ? "Finding today's thought…" : "Today's thought is waiting."}
                </h2>
                {quote && <p className="atlas-quote-author">— {quote.author}{quote.work ? `, ${quote.work}` : ""}</p>}
                {quoteError && <p className="atlas-quote-error" role="alert">{quoteError}</p>}
                <p className="atlas-quote-hint">{quoteLoading ? "Turning the page…" : "Click anywhere to discover another thought"}</p>
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
              <div className="atlas-subject-filter"><label htmlFor="atlas-subject-filter">SHOW</label><select id="atlas-subject-filter" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="all">All subjects</option>{Array.from(new Set(subjects.map(s=>s.term).filter((term): term is string => Boolean(term)))).sort().map(term=><option key={term} value={term}>{term}</option>)}</select></div>
              {subjectsError ? <div className="atlas-state-card atlas-state-error" role="alert"><div><strong>Could not load your subjects.</strong><p>{subjectsError}</p></div><button type="button" className="atlas-button atlas-secondary" onClick={()=>void loadSubjects().catch(()=>{})} disabled={subjectsLoading}>{subjectsLoading?"Trying again…":"Try again"}</button></div> : subjectsLoading ? <div className="atlas-state-card" role="status" aria-live="polite" aria-busy="true"><span className="atlas-state-spinner" aria-hidden="true"/><div><strong>Gathering your subjects…</strong><p>Your academic space will be ready in a moment.</p></div></div> : subjects.filter(s=>subjectFilter==="all"||s.term===subjectFilter).length===0 && subjects.length>0 ? <div className="atlas-empty-subjects"><p>No subjects match this term.</p><span>Try another term or show all your subjects.</span><button type="button" className="atlas-button atlas-secondary" onClick={()=>setSubjectFilter("all")}>Show all subjects</button></div> : <SubjectGrid subjects={subjects.filter(s=>subjectFilter==="all"||s.term===subjectFilter)} onDelete={deleteSubject} onEdit={openEditSubject} deletingSubjectId={deletingSubjectId}/> }
              <section className="atlas-overview-learning" aria-label="Learning overview">
                <div className="atlas-overview-section-heading"><div><p className="eyebrow">YOUR LEARNING THREAD</p><h2>Pick up where you left off</h2><p>Small steps add up. Continue from the concepts you last checked in with.</p></div></div>
                {overview&&<div className="atlas-overview-stats"><div><span>IN YOUR SYLLABI</span><strong>{overview.learning_summary.total_concepts}</strong><small>concepts</small></div><div><span>STRONG</span><strong>{overview.learning_summary.strong}</strong><small>feeling solid</small></div><div><span>DEVELOPING</span><strong>{overview.learning_summary.developing}</strong><small>taking shape</small></div><div><span>NEEDS ATTENTION</span><strong>{overview.learning_summary.weak+overview.learning_summary.not_assessed}</strong><small>{overview.learning_summary.due_for_review} due to revisit</small></div></div>}
                {overviewError ? <div className="atlas-overview-inline-error" role="status"><p>Your learning summary is temporarily unavailable. Your subjects and calendar are still here.</p><button type="button" onClick={()=>void loadOverview()} disabled={overviewLoading}>{overviewLoading?"Trying again…":"Try again"}</button></div> : overviewLoading && !overview ? <p className="atlas-overview-muted" role="status" aria-live="polite">Gathering your recent learning…</p> : overview?.continue_learning.length ? <div className="atlas-overview-activity-grid">{overview.continue_learning.map(item=><button key={item.concept_id} className="atlas-overview-activity-card" onClick={()=>{setAcademicsFocus({subjectId:item.subject_id,conceptId:item.concept_id});setActive("Academics");}}><span>{item.subject_name}</span><strong>{item.concept_title}</strong><small>{item.topic_title} · {new Date(item.last_reviewed).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</small><i>Continue learning <ArrowUpRight size={13}/></i></button>)}</div> : <p className="atlas-overview-muted">Your first concept check-in will show up here. Open Academics and start with any concept.</p>}
                <div className="atlas-overview-secondary-grid">
                  <section className="atlas-overview-mini-panel"><div><p className="eyebrow">A GENTLE NUDGE</p><h3>Worth a revisit</h3></div>{overview?.revision_suggestions.length ? overview.revision_suggestions.slice(0,4).map(item=><button key={item.concept_id} className="atlas-overview-suggestion" onClick={()=>{setAcademicsFocus({subjectId:item.subject_id,conceptId:item.concept_id});setActive("Academics");}}><span><strong>{item.concept_title}</strong><small>{item.subject_name} · {item.topic_title}</small></span><i>{item.days_until_exam!==null?`Exam in ${item.days_until_exam}d`:"Review"} <ArrowUpRight size={12}/></i></button>) : <p className="atlas-overview-muted">No revision suggestions yet. Add concepts and record how they feel.</p>}</section>
                  <section className="atlas-overview-mini-panel"><div><p className="eyebrow">ON THE HORIZON</p><h3>Coming up</h3></div>{overview?.upcoming_exams.length ? overview.upcoming_exams.slice(0,4).map(exam=><div key={exam.id} className="atlas-overview-exam"><span>{new Date(exam.exam_date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span><div><strong>{exam.title}</strong><small>{exam.subject_name}</small></div><i>{exam.days_until===0?"Today":`${exam.days_until}d`}</i></div>) : <p className="atlas-overview-muted">No upcoming exams on your calendar.</p>}</section>
                </div>
              </section>
            </section>
            <section className="atlas-overview-section atlas-calendar-section"><DashboardCalendar onDataChange={loadOverview} /></section>
          </>}

          {active==="Academics"&&<section className="atlas-overview-section">
            <div className="atlas-section-heading"><div><p className="eyebrow">THE BUILDING BLOCKS</p><h2>Your subjects</h2><p className="atlas-section-subtitle">A home for syllabi, concepts and revision.</p></div><button className="atlas-button atlas-primary" onClick={openAddSubject}><Plus size={15}/> Add subject</button></div>
            <AcademicsWorkspace subjects={subjects} initialSubjectId={academicsFocus?.subjectId} focusConceptId={academicsFocus?.conceptId} onFocusHandled={handleAcademicsFocusHandled} onOverviewRefresh={loadOverview}/>
          </section>}

          {active==="Explore"&&<FeatureEmpty icon={<Sparkles size={23}/>} eyebrow="THE CURIOSITY PLAYGROUND" title={<>What have you been<br/><em>wondering about?</em></>} text="Exploration is on its way. For now, remember: your interests don't need to fit inside a syllabus." foot="A LITTLE SPACE FOR THE UNEXPECTED"/>}
          {active==="My Universe"&&<FeatureEmpty icon={<Library size={23}/>} eyebrow="YOUR PERSONAL KNOWLEDGE LIBRARY" title={<>A universe<br/><em>of your own.</em></>} text="Saved concepts, notes and connections will live here. A place for the ideas you want to return to." foot="COLLECT THOUGHTS. CONNECT IDEAS."/>}
        </div>
      </section>

      {showAdd&&<div className="atlas-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setShowAdd(false);}}>
        <form onSubmit={addSubject} className="atlas-modal" role="dialog" aria-modal="true" aria-labelledby="subject-modal-title">
          <div className="atlas-modal-heading"><div><p className="eyebrow">ACADEMICS</p><h2 id="subject-modal-title">{editingSubjectId === null ? "Add a subject" : "Edit subject"}</h2></div><button type="button" className="atlas-icon-button" onClick={()=>setShowAdd(false)} disabled={busy} aria-label="Close"><X size={18}/></button></div>
          <label className="atlas-modal-label">Subject name<input autoFocus required value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder="e.g. Machine Learning"/></label>
          <label className="atlas-modal-label">Course code <small>OPTIONAL</small><input value={subjectCode} onChange={e=>setSubjectCode(e.target.value)} placeholder="e.g. CS402"/></label>
          <label className="atlas-modal-label">Description <small>OPTIONAL</small><textarea rows={3} value={subjectDescription} onChange={e=>setSubjectDescription(e.target.value)} placeholder="What does this subject cover?"/></label>
          <div className="atlas-subject-term-fields"><label className="atlas-modal-label">Semester / term <small>OPTIONAL</small><input value={subjectTerm} onChange={e=>setSubjectTerm(e.target.value)} placeholder="e.g. Semester 5"/></label><label className="atlas-modal-label">Academic year <small>OPTIONAL</small><input value={subjectYear} onChange={e=>setSubjectYear(e.target.value)} placeholder="e.g. 2026–27"/></label></div>
          {modalError && <p className="atlas-error" role="alert">{modalError}</p>}
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
function SubjectGrid({subjects,onDelete,onEdit,deletingSubjectId}:{subjects:Subject[];onDelete:(id:number)=>void;onEdit:(subject:Subject)=>void;deletingSubjectId:number|null}){
  if(!subjects.length)return <div className="atlas-empty-subjects"><div className="atlas-empty-icon"><BookOpen size={19}/></div><p>Your map is waiting for its first pin.</p><span>Add a subject to begin building your academic space.</span></div>;
  return <div className="atlas-subject-grid">{subjects.map((s,i)=><article key={s.id} className="atlas-subject-card" style={{animationDelay:`${i*65}ms`}}>
    <div className="atlas-subject-card-top"><div className="atlas-subject-glyph"><BookOpen size={17}/></div><div className="atlas-subject-card-actions"><button onClick={()=>onEdit(s)} className="atlas-remove atlas-edit-subject" disabled={deletingSubjectId!==null}>Edit</button><button onClick={()=>onDelete(s.id)} className="atlas-remove" disabled={deletingSubjectId!==null}>{deletingSubjectId===s.id?"Removing…":"Remove"}</button></div></div>
    <p className="atlas-subject-code">{s.code||`SUBJECT ${String(i+1).padStart(2,"0")}`}</p><h3>{s.name}</h3>{(s.term||s.academic_year)&&<p className="atlas-subject-term">{[s.term,s.academic_year].filter(Boolean).join(" · ")}</p>}<p className="atlas-subject-description">{s.description||"Syllabus and concepts will live here."}</p>
    <div className="atlas-card-bottom"><span>YOUR ACADEMIC SPACE</span><ArrowUpRight size={14}/></div>
  </article>)}</div>;
}
