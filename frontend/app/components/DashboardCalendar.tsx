"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bold, CalendarDays, Check, Code, Heading1, Heading2, Heading3, Italic, Link, List, ListOrdered, ListTodo, LoaderCircle, Minus, Pencil, Quote, Save, Strikethrough, Table2, Trash2, Underline } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { api } from "../../lib/api";

type DayNote = { day: string; note: string };
type Exam = { id: number; subject_id: number; title: string; exam_date: string };
type MarkdownAction = "bold" | "italic" | "underline" | "strike" | "h1" | "h2" | "h3" | "bullet" | "numbered" | "task" | "quote" | "code" | "link" | "table" | "rule";
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const shift = (d: Date, n: number) => { const x = new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; };
const examDateOf = (value: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
const noteSchema = { ...defaultSchema, tagNames: [...(defaultSchema.tagNames ?? []), "u"] };
const markdownTools: { action: MarkdownAction; label: string; icon: typeof Bold }[] = [
  { action: "bold", label: "Bold", icon: Bold },
  { action: "italic", label: "Italic", icon: Italic },
  { action: "underline", label: "Underline", icon: Underline },
  { action: "strike", label: "Strikethrough", icon: Strikethrough },
  { action: "h1", label: "Heading 1", icon: Heading1 },
  { action: "h2", label: "Heading 2", icon: Heading2 },
  { action: "h3", label: "Heading 3", icon: Heading3 },
  { action: "bullet", label: "Bulleted list", icon: List },
  { action: "numbered", label: "Numbered list", icon: ListOrdered },
  { action: "task", label: "Task list", icon: ListTodo },
  { action: "quote", label: "Block quote", icon: Quote },
  { action: "code", label: "Code", icon: Code },
  { action: "link", label: "Link", icon: Link },
  { action: "table", label: "Table", icon: Table2 },
  { action: "rule", label: "Divider", icon: Minus },
];

export default function DashboardCalendar() {
  const today = useMemo(() => new Date(), []);
  const [month,setMonth] = useState(() => new Date(today.getFullYear(),today.getMonth(),1));
  const [selected,setSelected] = useState(keyOf(today));
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [exams,setExams] = useState<Exam[]>([]);
  const [editingExamId,setEditingExamId] = useState<number | null>(null);
  const [examTitle,setExamTitle] = useState("");
  const [examDate,setExamDate] = useState("");
  const [examSaving,setExamSaving] = useState(false);
  const [draft,setDraft] = useState("");
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [saved,setSaved] = useState(false);
  const [editing,setEditing] = useState(false);
  const [error,setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const first = new Date(month.getFullYear(),month.getMonth(),1);
  const start = shift(first,-((first.getDay()+6)%7));
  const days = Array.from({length:42},(_,i)=>shift(start,i));
  const from = keyOf(days[0]), to = keyOf(days[41]);
  const examsByDay = useMemo(() => {
    const grouped: Record<string, Exam[]> = {};
    for (const exam of exams) {
      const day = keyOf(examDateOf(exam.exam_date));
      grouped[day] = [...(grouped[day] ?? []), exam];
    }
    return grouped;
  },[exams]);

  useEffect(() => {
    let live = true;
    setLoading(true); setError("");
    api<DayNote[]>(`/calendar?start=${from}&end=${to}`)
      .then(rows => { if(live) setNotes(Object.fromEntries(rows.map(r=>[r.day,r.note]))); })
      .catch(e => { if(live) setError(e instanceof Error ? e.message : "Calendar sync failed"); })
      .finally(() => { if(live) setLoading(false); });
    return () => { live = false; };
  },[from,to]);

  useEffect(() => {
    let live = true;
    api<Exam[]>("/exams")
      .then(rows => { if(live) setExams(rows); })
      .catch(e => { if(live) setError(e instanceof Error ? e.message : "Could not load exams"); });
    return () => { live = false; };
  },[]);

  useEffect(() => { setDraft(notes[selected] ?? ""); setSaved(false); setEditing(false); },[selected,notes]);
  const selectedDate = new Date(`${selected}T12:00:00`);
  const weekdays = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  const todayKey = keyOf(today);

  function startExamEdit(exam: Exam) {
    const date = examDateOf(exam.exam_date);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    setEditingExamId(exam.id);
    setExamTitle(exam.title);
    setExamDate(localDate.toISOString().slice(0, 16));
    setError("");
  }

  function cancelExamEdit() {
    setEditingExamId(null);
    setExamTitle("");
    setExamDate("");
  }

  async function saveExamEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingExamId === null || !examDate) return;
    setExamSaving(true);
    setError("");
    try {
      const updated = await api<Exam>(`/exams/${editingExamId}`, {
        method:"PATCH",
        body:JSON.stringify({title:examTitle.trim(),exam_date:new Date(examDate).toISOString()})
      });
      setExams(old => old.map(exam => exam.id === updated.id ? updated : exam));
      cancelExamEdit();
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not update exam");
    } finally {
      setExamSaving(false);
    }
  }

  async function deleteExam(exam: Exam) {
    if (!confirm(`Delete "${exam.title}"?`)) return;
    setExamSaving(true);
    setError("");
    try {
      await api<void>(`/exams/${exam.id}`,{method:"DELETE"});
      setExams(old => old.filter(item => item.id !== exam.id));
      if (editingExamId === exam.id) cancelExamEdit();
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not delete exam");
    } finally {
      setExamSaving(false);
    }
  }

  async function save() {
    setSaving(true); setError("");
    try {
      if(draft.trim()) {
        const row = await api<DayNote>(`/calendar/${selected}`,{method:"PUT",body:JSON.stringify({note:draft.trim()})});
        setNotes(old=>({...old,[selected]:row.note}));
      } else if(notes[selected]) {
        await api<void>(`/calendar/${selected}`,{method:"DELETE"});
        setNotes(old=>{const next={...old};delete next[selected];return next;});
      }
      setSaved(true);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save note"); }
    finally { setSaving(false); }
  }

  function applyMarkdown(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.slice(start, end);
    let before = "";
    let after = "";
    let placeholder = "text";
    let blockPrefix: string | null = null;
    let replacement = "";

    switch(action) {
      case "bold": before = "**"; after = "**"; placeholder = "bold text"; break;
      case "italic": before = "*"; after = "*"; placeholder = "italic text"; break;
      case "underline": before = "<u>"; after = "</u>"; placeholder = "underlined text"; break;
      case "strike": before = "~~"; after = "~~"; placeholder = "strikethrough text"; break;
      case "code": before = "`"; after = "`"; placeholder = "code"; break;
      case "link":
        replacement = `[${selected || "link text"}](url)`;
        break;
      case "h1": blockPrefix = "# "; break;
      case "h2": blockPrefix = "## "; break;
      case "h3": blockPrefix = "### "; break;
      case "bullet": blockPrefix = "- "; break;
      case "numbered": blockPrefix = "1. "; break;
      case "task": blockPrefix = "- [ ] "; break;
      case "quote": blockPrefix = "> "; break;
      case "rule": replacement = "\n\n---\n\n"; break;
      case "table":
        replacement = "\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n";
        break;
    }

    let replaceStart = start;
    let replaceEnd = end;
    let nextSelectionStart: number;
    let nextSelectionEnd: number;

    if (blockPrefix) {
      replaceStart = draft.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const newlineAfterSelection = draft.indexOf("\n", end);
      replaceEnd = newlineAfterSelection === -1 ? draft.length : newlineAfterSelection;
      const lines = draft.slice(replaceStart, replaceEnd).split("\n");
      const formattedLines = lines.map(line => `${blockPrefix}${line || "List item"}`);
      replacement = formattedLines.join("\n");
      nextSelectionStart = replaceStart;
      nextSelectionEnd = replaceStart + replacement.length;
    } else if (action === "link") {
      const linkText = selected || "link text";
      replacement = `[${linkText}](url)`;
      nextSelectionStart = replaceStart + linkText.length + 3;
      nextSelectionEnd = nextSelectionStart + 3;
    } else if (action === "rule" || action === "table") {
      nextSelectionStart = replaceStart + replacement.length;
      nextSelectionEnd = nextSelectionStart;
    } else {
      const content = selected || placeholder;
      replacement = `${before}${content}${after}`;
      nextSelectionStart = replaceStart + before.length;
      nextSelectionEnd = nextSelectionStart + content.length;
    }

    const nextDraft = draft.slice(0, replaceStart) + replacement + draft.slice(replaceEnd);
    setDraft(nextDraft);
    setSaved(false);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    });
  }

  return <section className="atlas-calendar-panel">
    <div className="atlas-calendar-main">
      <div className="atlas-calendar-heading">
        <div><p className="eyebrow">YOUR TIME, YOUR WAY</p><h2>Days on the map</h2><p className="atlas-calendar-caption">A little space to keep track of what matters.</p></div>
        <div className="atlas-calendar-controls">
          <button type="button" className="atlas-calendar-today" onClick={()=>{setMonth(new Date(today.getFullYear(),today.getMonth(),1));setSelected(todayKey);}}>Today</button>
          <button type="button" className="atlas-calendar-arrow" aria-label="Previous month" onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}><ArrowLeft size={15}/></button>
          <button type="button" className="atlas-calendar-arrow" aria-label="Next month" onClick={()=>setMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}><ArrowRight size={15}/></button>
        </div>
      </div>
      <div className="atlas-calendar-monthline"><h3>{month.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</h3><span>{loading?"SYNCING":"SYNCED"} <i className={loading?"is-syncing":""}/></span></div>
      <div className="atlas-calendar-grid" role="grid" aria-label="Calendar">
        {weekdays.map(d=><div key={d} className="atlas-calendar-weekday" role="columnheader">{d}</div>)}
        {days.map(d=>{const k=keyOf(d),hasNote=Boolean(notes[k]?.trim()),hasExam=Boolean(examsByDay[k]?.length);return <button key={k} type="button" role="gridcell" aria-pressed={selected===k} aria-label={`${d.toLocaleDateString()}${hasExam?`, ${examsByDay[k].length} exam${examsByDay[k].length===1?"":"s"}`:""}${hasNote?", has a note":""}`} onClick={()=>setSelected(k)} className={`atlas-calendar-day${d.getMonth()!==month.getMonth()?" outside":""}${selected===k?" selected":""}${k===todayKey?" today":""}${hasNote?" has-note":""}${hasExam?" has-event":""}`}><span>{d.getDate()}</span>{hasNote&&<i/>}{hasExam&&<i className="exam-dot"/>}</button>;})}
      </div>
      <div className="atlas-calendar-legend"><span><i className="today-dot"/> Today</span><span><i className="note-dot"/> Has a note</span><span><i className="exam-dot"/> Exam</span></div>
    </div>
    <aside className="atlas-day-note">
      <div className="atlas-day-note-top"><div className="atlas-day-note-icon"><CalendarDays size={17}/></div><p className="eyebrow">DAY NOTES</p></div>
      <h3>{selectedDate.toLocaleDateString("en-IN",{weekday:"long",day:"numeric"})}</h3>
      <p className="atlas-day-note-date">{selectedDate.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}</p>
      {examsByDay[selected]?.length ? <div className="atlas-calendar-exams" aria-label="Exams on this day"><p className="eyebrow">EXAMS THIS DAY</p>{examsByDay[selected].map(exam=><div className="atlas-calendar-exam-group" key={exam.id}>
        {editingExamId === exam.id ? <form className="atlas-calendar-exam-edit" onSubmit={saveExamEdit}>
          <label>Exam title<input value={examTitle} onChange={e=>setExamTitle(e.target.value)} required maxLength={160}/></label>
          <label>Date and time<input type="datetime-local" value={examDate} onChange={e=>setExamDate(e.target.value)} required/></label>
          <div><button type="submit" className="atlas-calendar-exam-save" disabled={examSaving}><Save size={13}/>{examSaving?"Saving…":"Save"}</button><button type="button" className="atlas-calendar-exam-cancel" onClick={cancelExamEdit} disabled={examSaving}>Cancel</button></div>
        </form> : <div className="atlas-calendar-exam">
          <CalendarDays size={13}/><span><strong>{exam.title}</strong><small>{examDateOf(exam.exam_date).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})}</small></span>
          <div className="atlas-calendar-exam-actions"><button type="button" onClick={()=>startExamEdit(exam)} disabled={examSaving} aria-label={`Edit ${exam.title}`} title="Edit exam"><Pencil size={13}/></button><button type="button" onClick={()=>void deleteExam(exam)} disabled={examSaving} aria-label={`Delete ${exam.title}`} title="Delete exam"><Trash2 size={13}/></button></div>
        </div>}
      </div>)}</div> : null}
      <label htmlFor="atlas-day-note-input">Leave something for this day</label>
      {editing ? (
        <>
          <div className="atlas-markdown-toolbar" role="toolbar" aria-label="Markdown formatting">
            {markdownTools.map(({action,label,icon:Icon})=>(
              <button
                key={action}
                type="button"
                title={label}
                aria-label={label}
                onMouseDown={e=>e.preventDefault()}
                onClick={()=>applyMarkdown(action)}
              >
                <Icon size={14}/>
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            id="atlas-day-note-input"
            rows={7}
            maxLength={4000}
            autoFocus
            value={draft}
            onChange={e=>{setDraft(e.target.value);setSaved(false);}}
            onBlur={e=>{
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) {
                setEditing(false);
              }
            }}
            placeholder="A deadline, a thought, a plan…"
            aria-describedby="atlas-day-note-markdown-hint"
          />
        </>
      ) : (
        <div
          className={`atlas-day-note-preview${draft.trim() ? "" : " is-empty"}`}
          role="button"
          tabIndex={0}
          aria-label="Edit day note"
          onClick={()=>setEditing(true)}
          onKeyDown={e=>{
            if(e.key==="Enter"||e.key===" "){e.preventDefault();setEditing(true);}
          }}
        >
          {draft.trim()
            ? <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, noteSchema]]}>{draft}</ReactMarkdown>
            : <p>A deadline, a thought, a plan…</p>}
        </div>
      )}
      {editing&&<p id="atlas-day-note-markdown-hint" className="atlas-day-note-markdown-hint">Markdown supported</p>}
      <div className="atlas-note-footer"><span>{draft.length}/4000</span>
        {notes[selected]&&!draft.trim()&&<button type="button" className="atlas-note-delete" onClick={()=>void save()} disabled={saving} aria-label="Delete note"><Trash2 size={14}/></button>}
        <button type="button" className="atlas-button atlas-primary atlas-note-save" onClick={()=>void save()} disabled={saving||draft.trim()===(notes[selected]??"")}>{saving?<LoaderCircle size={14} className="atlas-spin"/>:saved?<Check size={14}/>:<Save size={14}/>} {saving?"Saving":saved?"Saved":"Save note"}</button>
      </div>
      {error&&<p className="atlas-calendar-error" role="alert">{error}</p>}
      <p className="atlas-calendar-private">Notes sync to your Atlas account and will be here when you return.</p>
    </aside>
  </section>;
}
