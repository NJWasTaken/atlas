"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, ChevronDown, ChevronRight, Plus, Trash2, Pencil, Brain, Target,
  CalendarDays, RefreshCw, Check, AlertCircle, Layers3, Sparkles, FileUp, X
} from "lucide-react";
import { api } from "../../lib/api";

type Subject = { id: number; name: string; code?: string | null; description?: string | null; term?: string | null; academic_year?: string | null };
type Topic = { id: number; subject_id: number; parent_topic_id: number | null; title: string; description?: string | null; source_pages?: number[] | null; position: number };
type Concept = { id: number; topic_id: number; title: string; description?: string | null; source_pages?: number[] | null; position: number };
type Progress = {
  id?: number; concept_id: number; exposure: "not_started" | "studied";
  understanding: "not_assessed" | "weak" | "developing" | "strong";
  recall: "not_assessed" | "needs_practice" | "comfortable";
  confidence: number | null; notes: string | null; last_reviewed?: string | null; next_review_at?: string | null;
};
type Review = { id:number; concept_id:number; reviewed_at:string; exposure:string; understanding:string; recall:string; confidence:number|null; notes:string|null };
type Prerequisite = { id:number; title:string; topic_title:string; understanding:string; recall:string };
type SyllabusVersion = { id:number; subject_id:number; version_number:number; label:string; created_at:string };
type SyllabusVersionDetail = SyllabusVersion & { snapshot:{topics:{id:number;title:string;concepts:{id:number;title:string}[]}[]} };
type Readiness = { subject_id: number; total_concepts: number; strong: number; developing: number; weak: number; not_assessed: number; due_for_review?:number; next_exam?:{title:string;exam_date:string;days_until:number}|null; recommendations: {reason:string;count:number;message:string}[] };
type Exam = { id:number; subject_id:number; title:string; exam_date:string };
type DraftConcept = { title:string; source_pages:number[] };
type DraftTopic = { title:string; source_pages:number[]; concepts:DraftConcept[] };
type SyllabusDraft = { file_name:string; page_count:number; extracted_characters:number; topics:DraftTopic[]; warnings:string[] };

const blankProgress: Progress = { concept_id: 0, exposure:"not_started", understanding:"not_assessed", recall:"not_assessed", confidence:null, notes:"" };

export default function AcademicsWorkspace({ subjects, initialSubjectId, focusConceptId, onFocusHandled, onOverviewRefresh }: { subjects: Subject[]; initialSubjectId?:number; focusConceptId?:number; onFocusHandled?:()=>void; onOverviewRefresh?:()=>void }) {
  const [subjectId, setSubjectId] = useState<number | null>(initialSubjectId ?? subjects[0]?.id ?? null);
  const [termFilter, setTermFilter] = useState("all");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [prerequisiteIds, setPrerequisiteIds] = useState<number[]>([]);
  const [prerequisiteSearch, setPrerequisiteSearch] = useState("");
  const [versions, setVersions] = useState<SyllabusVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<SyllabusVersionDetail | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<Concept | null>(null);
  const [progress, setProgress] = useState<Progress>(blankProgress);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [topicTitle, setTopicTitle] = useState("");
  const [conceptTitle, setConceptTitle] = useState("");
  const [editingItem, setEditingItem] = useState<{kind:"topic"|"concept";id:number}|null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [examTitle, setExamTitle] = useState("End-semester examination");
  const [examDate, setExamDate] = useState("");
  const [editingExamId, setEditingExamId] = useState<number | null>(null);
  const [parentId, setParentId] = useState<number | null>(null);
  const [addingTopic, setAddingTopic] = useState(false);
  const [addingConcept, setAddingConcept] = useState<number | null>(null);
  const [addingExam, setAddingExam] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importDraft, setImportDraft] = useState<SyllabusDraft | null>(null);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);

  const terms = useMemo(() => [...new Set(subjects.map(s => s.term).filter((term): term is string => Boolean(term)))].sort(), [subjects]);
  const visibleSubjects = useMemo(() => termFilter === "all" ? subjects : subjects.filter(s => s.term === termFilter), [subjects, termFilter]);
  const subject = visibleSubjects.find(s => s.id === subjectId) ?? null;
  const topicMap = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics]);
  const conceptsByTopic = useMemo(() => {
    const map = new Map<number, Concept[]>();
    concepts.forEach(c => map.set(c.topic_id, [...(map.get(c.topic_id) ?? []), c]));
    return map;
  }, [concepts]);
  const roots = topics.filter(t => !t.parent_topic_id);

  async function loadWorkspace(id: number) {
    setError("");
    try {
      const [nextTopics, nextConcepts, nextReadiness, nextExams, nextVersions] = await Promise.all([
        api<Topic[]>(`/subjects/${id}/topics`),
        api<Concept[]>(`/subjects/${id}/concepts`),
        api<Readiness>(`/subjects/${id}/readiness`),
        api<Exam[]>(`/exams`),
        api<SyllabusVersion[]>(`/subjects/${id}/syllabus/versions`),
      ]);
      setTopics(nextTopics); setConcepts(nextConcepts); setReadiness(nextReadiness); setVersions(nextVersions);
      setExpanded(nextTopics.filter(t => !t.parent_topic_id).map(t => t.id));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load this subject."); }
  }

  useEffect(() => {
    if (!visibleSubjects.length) { setSubjectId(null); return; }
    if (!visibleSubjects.some(s => s.id === subjectId)) setSubjectId(visibleSubjects[0].id);
  }, [visibleSubjects, subjectId]);
  useEffect(() => {
    if (initialSubjectId && subjects.some(s => s.id === initialSubjectId)) setSubjectId(initialSubjectId);
  }, [initialSubjectId, subjects]);
  useEffect(() => { if (subjectId !== null) void loadWorkspace(subjectId); }, [subjectId]);

  async function addTopic(e: React.FormEvent) {
    e.preventDefault(); if (subjectId === null || !topicTitle.trim()) return;
    setBusy(true); setError("");
    try {
      await api<Topic>(`/subjects/${subjectId}/topics`, { method:"POST", body:JSON.stringify({title:topicTitle.trim(), parent_topic_id:parentId, position:topics.length}) });
      setTopicTitle(""); setParentId(null); setAddingTopic(false); await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice("Topic added to your syllabus.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add topic."); }
    finally { setBusy(false); }
  }

  async function addConcept(e: React.FormEvent) {
    e.preventDefault(); if (addingConcept === null || !conceptTitle.trim()) return;
    setBusy(true); setError("");
    try {
      await api<Concept>(`/topics/${addingConcept}/concepts`, {method:"POST",body:JSON.stringify({title:conceptTitle.trim(),position:(conceptsByTopic.get(addingConcept)?.length ?? 0)})});
      setConceptTitle(""); setAddingConcept(null); if(subjectId!==null) await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice("Concept added.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not add concept."); }
    finally { setBusy(false); }
  }

  async function uploadSyllabus(file: File) {
    if (subjectId === null) return;
    if (file.size > 12 * 1024 * 1024) { setError("This PDF is larger than the 12 MB upload limit."); return; }
    setUploadingSyllabus(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const draft = await api<SyllabusDraft>("/subjects/" + subjectId + "/syllabus/draft", {method:"POST",body:form});
      setImportDraft(draft);
      setNotice("Draft extracted. Review every section before adding it to your syllabus.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not read this PDF."); }
    finally { setUploadingSyllabus(false); }
  }

  function updateDraftTopic(index:number, changes:Partial<DraftTopic>) {
    setImportDraft(current => current ? {...current,topics:current.topics.map((topic,i)=>i===index?{...topic,...changes}:topic)} : current);
  }

  function updateDraftConcept(topicIndex:number, conceptIndex:number, changes:Partial<DraftConcept>) {
    setImportDraft(current => current ? {...current,topics:current.topics.map((topic,i)=>i===topicIndex?{...topic,concepts:topic.concepts.map((concept,j)=>j===conceptIndex?{...concept,...changes}:concept)}:topic)} : current);
  }

  function addDraftTopic() {
    setImportDraft(current => current ? {...current,topics:[...current.topics,{title:"New chapter",source_pages:[],concepts:[]}]} : current);
  }

  function addDraftConcept(topicIndex:number) {
    setImportDraft(current => current ? {...current,topics:current.topics.map((topic,i)=>i===topicIndex?{...topic,concepts:[...topic.concepts,{title:"New concept",source_pages:[]}]}:topic)} : current);
  }

  async function confirmSyllabusImport() {
    if (subjectId === null || !importDraft?.topics.length) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await api<{topics_created:number;concepts_created:number}>(
        "/subjects/" + subjectId + "/syllabus/confirm",
        {method:"POST",body:JSON.stringify({topics:importDraft.topics})}
      );
      setImportDraft(null);
      await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice("Added " + result.topics_created + " chapters and " + result.concepts_created + " concepts to your syllabus.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not add the reviewed syllabus."); }
    finally { setBusy(false); }
  }

  function beginItemEdit(kind: "topic" | "concept", item: Topic | Concept) {
    setEditingItem({kind, id:item.id});
    setEditTitle(item.title);
    setError("");
  }

  async function saveItemEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem || !editTitle.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const path = editingItem.kind === "topic" ? "topics" : "concepts";
      const updated = await api<Topic | Concept>(`/${path}/${editingItem.id}`, {
        method:"PATCH",
        body:JSON.stringify({title:editTitle.trim()})
      });
      if (editingItem.kind === "concept" && selectedConcept?.id === editingItem.id) {
        setSelectedConcept(updated as Concept);
      }
      setEditingItem(null);
      if (subjectId !== null) await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice(`${editingItem.kind === "topic" ? "Topic" : "Concept"} updated.`);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Could not update this item.");
    } finally { setBusy(false); }
  }

  async function chooseConcept(concept: Concept) {
    setSelectedConcept(concept); setReviews([]); setPrerequisites([]); setPrerequisiteIds([]); setProgress({...blankProgress,concept_id:concept.id}); setPrerequisiteSearch(""); setError("");
    try {
      const [result, history, prerequisiteRows] = await Promise.all([
        api<Progress | null>(`/concepts/${concept.id}/progress`),
        api<Review[]>(`/concepts/${concept.id}/reviews`),
        api<Prerequisite[]>(`/concepts/${concept.id}/prerequisites`),
      ]);
      setProgress(result ?? {...blankProgress, concept_id:concept.id});
      setReviews(history);
      setPrerequisites(prerequisiteRows);
      setPrerequisiteIds(prerequisiteRows.map(item=>item.id));
    } catch(e) { setError(e instanceof Error ? e.message : "Could not load progress."); }
  }

  useEffect(() => {
    if (!focusConceptId) return;
    const concept = concepts.find(item => item.id === focusConceptId);
    if (!concept) return;
    const toExpand:number[] = [];
    let topic = topics.find(item => item.id === concept.topic_id);
    while (topic) {
      toExpand.push(topic.id);
      topic = topic.parent_topic_id ? topics.find(item => item.id === topic?.parent_topic_id) : undefined;
    }
    setExpanded(current => Array.from(new Set([...current, ...toExpand])));
    void chooseConcept(concept);
    onFocusHandled?.();
  }, [focusConceptId, concepts, topics, onFocusHandled]);

  async function savePrerequisites() {
    if(!selectedConcept) return;
    setBusy(true); setError("");
    try {
      const saved = await api<Prerequisite[]>("/concepts/" + selectedConcept.id + "/prerequisites", {
        method:"PUT", body:JSON.stringify({prerequisite_ids:prerequisiteIds})
      });
      setPrerequisites(saved);
      setPrerequisiteIds(saved.map(item=>item.id));
      if(subjectId!==null) await loadWorkspace(subjectId);
      setNotice("Prerequisite links saved.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save prerequisites."); }
    finally { setBusy(false); }
  }

  async function saveProgress(e: React.FormEvent) {
    e.preventDefault(); if(!selectedConcept) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await api<Progress>(`/concepts/${selectedConcept.id}/progress`, {method:"PATCH",body:JSON.stringify({
        exposure:progress.exposure, understanding:progress.understanding, recall:progress.recall,
        confidence:progress.confidence, notes:progress.notes
      })});
      setProgress(saved);
      setReviews(await api<Review[]>(`/concepts/${selectedConcept.id}/reviews`));
      if(subjectId!==null) await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice("Progress saved. Nice work showing up.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save progress."); }
    finally { setBusy(false); }
  }


  async function createSyllabusSnapshot() {
    if(subjectId===null) return;
    setBusy(true); setError("");
    try {
      const version = await api<SyllabusVersion>("/subjects/" + subjectId + "/syllabus/versions", {
        method:"POST", body:JSON.stringify({label:"Manual checkpoint"})
      });
      setVersions(old=>[version,...old]);
      setShowVersionHistory(true);
      setNotice("Syllabus checkpoint saved.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not save a syllabus checkpoint."); }
    finally { setBusy(false); }
  }

  async function inspectSyllabusVersion(versionId:number) {
    if(subjectId===null) return;
    try {
      setSelectedVersion(await api<SyllabusVersionDetail>("/subjects/" + subjectId + "/syllabus/versions/" + versionId));
    } catch(e) { setError(e instanceof Error ? e.message : "Could not open this version."); }
  }

  async function restoreSyllabusVersion(version:SyllabusVersion) {
    if(subjectId===null || !confirm("Restore version " + version.version_number + "? Your current syllabus will be checkpointed first. Concepts not present in that version will be removed along with their progress and review history.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api("/subjects/" + subjectId + "/syllabus/versions/" + version.id + "/restore",{method:"POST"});
      setSelectedVersion(null);
      setSelectedConcept(null); setReviews([]); setPrerequisites([]); setPrerequisiteIds([]);
      await loadWorkspace(subjectId);
      setNotice("Syllabus restored. The previous version is kept in history.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not restore this syllabus version."); }
    finally { setBusy(false); }
  }

  async function addExam(e: React.FormEvent) {
    e.preventDefault(); if(subjectId===null || !examDate) return;
    setBusy(true); setError("");
    try {
      await api<Exam>("/exams",{method:"POST",body:JSON.stringify({subject_id:subjectId,title:examTitle,exam_date:new Date(examDate).toISOString()})});
      setExamTitle("End-semester examination"); setExamDate(""); setAddingExam(false); await loadWorkspace(subjectId); onOverviewRefresh?.();
    } catch(e) { setError(e instanceof Error ? e.message : "Could not add exam."); }
    finally { setBusy(false); }
  }

  function editExam(exam: Exam) {
    const date = new Date(exam.exam_date);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    setExamTitle(exam.title);
    setExamDate(localDate.toISOString().slice(0, 16));
    setEditingExamId(exam.id);
    setAddingExam(true);
    setError("");
  }

  function cancelExamEdit() {
    setEditingExamId(null);
    setExamTitle("End-semester examination");
    setExamDate("");
    setAddingExam(false);
  }

  async function saveExamEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingExamId === null || !examDate) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api<Exam>(`/exams/${editingExamId}`, {
        method:"PATCH",
        body:JSON.stringify({title:examTitle.trim(),exam_date:new Date(examDate).toISOString()})
      });
      cancelExamEdit();
      if(subjectId!==null) await loadWorkspace(subjectId);
      onOverviewRefresh?.();
      setNotice("Exam updated.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not update exam."); }
    finally { setBusy(false); }
  }

  async function removeExam(exam: Exam) {
    if(!confirm(`Delete "${exam.title}"?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api<void>(`/exams/${exam.id}`,{method:"DELETE"});
      if(subjectId!==null) await loadWorkspace(subjectId);
      setNotice("Exam deleted.");
      onOverviewRefresh?.();
    } catch(e) { setError(e instanceof Error ? e.message : "Could not delete exam."); }
    finally { setBusy(false); }
  }

  async function removeTopic(id:number) {
    if(!confirm("Delete this topic, its nested topics, concepts and progress?")) return;
    try { await api<void>(`/topics/${id}`,{method:"DELETE"}); if(subjectId!==null) await loadWorkspace(subjectId); if(selectedConcept && topics.some(t=>t.id===id)) setSelectedConcept(null); }
    catch(e) { setError(e instanceof Error ? e.message : "Could not delete topic."); }
  }
  async function removeConcept(id:number) {
    if(!confirm("Delete this concept and its progress?")) return;
    try { await api<void>(`/concepts/${id}`,{method:"DELETE"}); if(subjectId!==null) await loadWorkspace(subjectId); if(selectedConcept?.id===id) setSelectedConcept(null); }
    catch(e) { setError(e instanceof Error ? e.message : "Could not delete concept."); }
  }

  function renderTopic(topic: Topic, depth = 0): React.ReactNode {
    const children = topics.filter(t => t.parent_topic_id === topic.id);
    const items = conceptsByTopic.get(topic.id) ?? [];
    const isOpen = expanded.includes(topic.id);
    return <div className="atlas-topic-node" key={topic.id}>
      <div className="atlas-topic-row" style={{"--topic-depth":depth} as React.CSSProperties}>
        <button className="atlas-topic-toggle" onClick={()=>setExpanded(old=>isOpen?old.filter(x=>x!==topic.id):[...old,topic.id])} aria-label={isOpen?"Collapse topic":"Expand topic"}>
          {isOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
        </button>
        <Layers3 size={15} className="atlas-topic-icon"/>
        <span className="atlas-topic-title">{topic.title}</span>
        {topic.source_pages?.length ? <span className="atlas-topic-source">p. {topic.source_pages.join(", ")}</span> : null}
        <span className="atlas-topic-count">{items.length} concepts</span>
        <button className="atlas-mini-action" onClick={()=>{setAddingConcept(topic.id);setExpanded(old=>old.includes(topic.id)?old:[...old,topic.id]);}} title="Add concept"><Plus size={14}/></button>
        <button className="atlas-mini-action" onClick={()=>beginItemEdit("topic",topic)} title="Rename topic" aria-label={`Rename ${topic.title}`}><Pencil size={13}/></button>
        <button className="atlas-mini-action danger" onClick={()=>removeTopic(topic.id)} title="Delete topic"><Trash2 size={13}/></button>
      </div>
      {editingItem?.kind === "topic" && editingItem.id === topic.id && <form className="atlas-inline-form atlas-edit-inline-form" onSubmit={saveItemEdit}>
        <label>Rename topic<input autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} required maxLength={180}/></label>
        <div><button className="atlas-button atlas-primary" disabled={busy}>Save name</button><button type="button" className="atlas-button atlas-secondary" onClick={()=>setEditingItem(null)}>Cancel</button></div>
      </form>}
      {isOpen && <div className="atlas-topic-children">
        {items.map(c=><div className="atlas-concept-entry" key={c.id}>
          <div className={`atlas-concept-row ${selectedConcept?.id===c.id?"selected":""}`}>
            <button onClick={()=>void chooseConcept(c)}><Brain size={14}/><span>{c.title}</span></button>
            {c.source_pages?.length ? <small className="atlas-concept-source">p. {c.source_pages.join(", ")}</small> : null}
            <button className="atlas-mini-action" onClick={()=>beginItemEdit("concept",c)} title="Rename concept" aria-label={`Rename ${c.title}`}><Pencil size={12}/></button>
            <button className="atlas-mini-action danger" onClick={()=>removeConcept(c.id)} title="Delete concept"><Trash2 size={12}/></button>
          </div>
          {editingItem?.kind === "concept" && editingItem.id === c.id && <form className="atlas-inline-form atlas-edit-inline-form" onSubmit={saveItemEdit}>
            <label>Rename concept<input autoFocus value={editTitle} onChange={e=>setEditTitle(e.target.value)} required maxLength={180}/></label>
            <div><button className="atlas-button atlas-primary" disabled={busy}>Save name</button><button type="button" className="atlas-button atlas-secondary" onClick={()=>setEditingItem(null)}>Cancel</button></div>
          </form>}
        </div>)}
        {children.map(child=>renderTopic(child,depth+1))}
        {!items.length&&!children.length&&<p className="atlas-topic-empty">No concepts here yet. Add the first one.</p>}
      </div>}
      {isOpen && addingConcept===topic.id && <form className="atlas-inline-form atlas-add-concept-form" onSubmit={addConcept}>
        <label>New concept<input autoFocus value={conceptTitle} onChange={e=>setConceptTitle(e.target.value)} placeholder="e.g. Backpropagation" required maxLength={180}/></label>
        <div><button className="atlas-button atlas-primary" disabled={busy}>{busy?"Saving…":"Add concept"}<Check size={14}/></button><button type="button" className="atlas-button atlas-secondary" onClick={()=>{setAddingConcept(null);setConceptTitle("");}}>Cancel</button></div>
      </form>}
    </div>;
  }

  if (!subjects.length) return <div className="atlas-academics-empty"><div className="atlas-academics-empty-icon"><BookOpen size={24}/></div><h3>Start with a subject</h3><p>Add a subject first, then build its syllabus manually or import a PDF and review the suggested chapters before saving.</p></div>;

  return <div className="atlas-academics-workspace">
    {error && <div className="atlas-academics-alert" role="alert"><AlertCircle size={15}/>{error}<button onClick={()=>setError("")}>Dismiss</button></div>}
    {notice && <div className="atlas-academics-notice" role="status"><Check size={15}/>{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    <div className="atlas-academics-toolbar">
      <label><span>FILTER BY TERM</span><select value={termFilter} onChange={e=>{setTermFilter(e.target.value);setSelectedConcept(null);setReviews([]);setPrerequisites([]);setPrerequisiteIds([]);setSelectedVersion(null);setImportDraft(null);}}><option value="all">All terms</option>{terms.map(term=><option key={term} value={term}>{term}</option>)}</select></label>
      <label><span>WORKING IN</span><select value={subjectId ?? ""} onChange={e=>{setSubjectId(Number(e.target.value));setSelectedConcept(null);setReviews([]);setPrerequisites([]);setPrerequisiteIds([]);setPrerequisiteSearch("");setSelectedVersion(null);setShowVersionHistory(false);setImportDraft(null);}}>{visibleSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <div className="atlas-academics-actions"><button className="atlas-button atlas-secondary" onClick={()=>void loadWorkspace(subjectId!)}><RefreshCw size={14}/> Refresh</button><button className="atlas-button atlas-secondary" onClick={()=>setShowVersionHistory(value=>!value)}>History ({versions.length})</button><button className="atlas-button atlas-primary" onClick={()=>{setParentId(null);setAddingTopic(true);}}><Plus size={14}/> Add chapter</button></div>
    </div>

    {!visibleSubjects.length && <div className="atlas-academics-empty">No subjects in this term yet.</div>}

    {showVersionHistory && <section className="atlas-syllabus-history"><div className="atlas-panel-heading"><div><p className="eyebrow">SYLLABUS TIMELINE</p><h3>Saved versions</h3></div><button type="button" className="atlas-mini-action" onClick={()=>setShowVersionHistory(false)} aria-label="Close version history"><X size={15}/></button></div>{versions.length ? versions.map(version=><div className="atlas-version-row" key={version.id}><span>v{version.version_number}</span><div><strong>{version.label}</strong><small>{new Date(version.created_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</small></div><button type="button" className="atlas-button atlas-secondary" onClick={()=>void inspectSyllabusVersion(version.id)}>Inspect</button></div>) : <p className="atlas-topic-empty">Your syllabus changes will create a version history as you edit.</p>}{selectedVersion&&<div className="atlas-version-preview"><div><strong>Version {selectedVersion.version_number}</strong><button type="button" className="atlas-mini-action" onClick={()=>setSelectedVersion(null)} aria-label="Close preview"><X size={14}/></button></div>{selectedVersion.snapshot.topics.map(topic=><p key={topic.id}><span>{topic.title}</span><small>{topic.concepts.length} concepts</small></p>)}<button type="button" className="atlas-button atlas-secondary" disabled={busy} onClick={()=>void restoreSyllabusVersion(selectedVersion)}>Restore this version</button></div>}</section>}

    <div className="atlas-academics-summary">
      <div><p className="eyebrow">YOUR SYLLABUS</p><h2>{subject?.name ?? "Subject workspace"}</h2><p>{subject?.description || "Build a map of what you need to learn. Small, clear pieces beat one intimidating syllabus."}</p></div>
      <div className="atlas-summary-stats"><div><strong>{topics.length}</strong><span>TOPICS</span></div><div><strong>{concepts.length}</strong><span>CONCEPTS</span></div><div><strong>{readiness?.weak ?? 0}</strong><span>NEEDS ATTENTION</span></div></div>
    </div>

    <div className="atlas-academics-columns">
      <section className="atlas-academics-panel atlas-syllabus-panel">
        <div className="atlas-panel-heading"><div><p className="eyebrow">THE KNOWLEDGE MAP</p><h3>Chapters & concepts</h3></div><div className="atlas-syllabus-heading-actions"><button type="button" className="atlas-button atlas-secondary" onClick={()=>void createSyllabusSnapshot()} disabled={busy}>Save version</button>
          <button type="button" className="atlas-button atlas-secondary" onClick={()=>{setParentId(null);setTopicTitle("");setAddingTopic(true);}}><Plus size={14}/> Build manually</button>
          <label className="atlas-button atlas-secondary atlas-upload-button"><FileUp size={14}/>{uploadingSyllabus?"Reading PDF…":"Import from PDF"}<input type="file" accept="application/pdf,.pdf" disabled={uploadingSyllabus||busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void uploadSyllabus(file);}}/></label>
        </div></div>
        {addingTopic && <form className="atlas-inline-form atlas-manual-topic-form" onSubmit={addTopic}>
          <div className="atlas-manual-form-intro"><strong>Build your syllabus</strong><span>Add a chapter or nest it under an existing one. You can add concepts as you go.</span></div>
          <label>Chapter or subchapter title<input autoFocus value={topicTitle} onChange={e=>setTopicTitle(e.target.value)} placeholder="e.g. Neural Networks" required maxLength={180}/></label>
          <label>Parent chapter<select value={parentId??""} onChange={e=>setParentId(e.target.value?Number(e.target.value):null)}><option value="">Top-level chapter</option>{topics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
          <div><button className="atlas-button atlas-primary" disabled={busy}>{busy?"Saving…":"Add chapter"}<Check size={14}/></button><button type="button" className="atlas-button atlas-secondary" onClick={()=>{setAddingTopic(false);setTopicTitle("");setParentId(null);}}>Cancel</button></div>
        </form>}
        {importDraft && <section className="atlas-import-review">
          <div className="atlas-import-review-heading">
            <div><p className="eyebrow">NOT SAVED YET</p><h4>Review your syllabus draft</h4><p>{importDraft.file_name} · {importDraft.page_count} pages · {importDraft.topics.length} detected chapters</p></div>
            <button className="atlas-mini-action" onClick={()=>setImportDraft(null)} title="Discard draft" aria-label="Discard draft"><X size={16}/></button>
          </div>
          {importDraft.warnings.map((warning,i)=><p className="atlas-import-warning" key={i}><AlertCircle size={14}/>{warning}</p>)}
          <p className="atlas-import-explainer">Check the detected headings, rename anything odd, and remove anything that doesn't belong. Page references are kept when you confirm.</p>
          <div className="atlas-import-draft-list">
            {importDraft.topics.map((topic,i)=><article className="atlas-import-topic" key={i}>
              <div className="atlas-import-topic-title">
                <label><span>CHAPTER {i+1}</span><input value={topic.title} onChange={e=>updateDraftTopic(i,{title:e.target.value})} maxLength={180}/></label>
                <span className="atlas-source-page">{topic.source_pages.length ? "PDF p. " + topic.source_pages.join(", ") : "Added manually"}</span>
                <button className="atlas-mini-action danger" onClick={()=>setImportDraft(current=>current?{...current,topics:current.topics.filter((_,j)=>j!==i)}:current)} title="Remove chapter" aria-label={"Remove " + topic.title}><Trash2 size={14}/></button>
              </div>
              {topic.concepts.map((concept,j)=><div className="atlas-import-concept" key={j}>
                <input value={concept.title} onChange={e=>updateDraftConcept(i,j,{title:e.target.value})} maxLength={180} aria-label={"Concept " + (j+1) + " in " + topic.title}/>
                <span>{concept.source_pages.length ? "p. " + concept.source_pages.join(", ") : "Manual"}</span>
                <button className="atlas-mini-action danger" onClick={()=>updateDraftTopic(i,{concepts:topic.concepts.filter((_,k)=>k!==j)})} title="Remove concept" aria-label="Remove concept"><X size={13}/></button>
              </div>)}
              <button className="atlas-import-add-concept" onClick={()=>addDraftConcept(i)}><Plus size={13}/> Add concept</button>
            </article>)}
          </div>
          <div className="atlas-import-review-actions">
            <button className="atlas-button atlas-secondary" onClick={addDraftTopic}><Plus size={14}/> Add chapter</button>
            <div><button className="atlas-button atlas-secondary" onClick={()=>setImportDraft(null)} disabled={busy}>Discard</button><button className="atlas-button atlas-primary" onClick={()=>void confirmSyllabusImport()} disabled={busy||!importDraft.topics.length||importDraft.topics.some(t=>!t.title.trim()||t.concepts.some(x=>!x.title.trim()))}>{busy?"Adding…":"Add to syllabus"}<Check size={14}/></button></div>
          </div>
          <p className="atlas-import-footnote">This adds the reviewed items alongside any chapters already in this subject. It does not replace your existing syllabus.</p>
        </section>}
        {roots.length ? roots.map(t=>renderTopic(t)) : <div className="atlas-syllabus-empty"><BookOpen size={22}/><strong>Your syllabus is a blank page.</strong><span>Start from scratch with a chapter, or bring in an existing syllabus PDF.</span><button type="button" className="atlas-button atlas-primary" onClick={()=>{setParentId(null);setTopicTitle("");setAddingTopic(true);}}><Plus size={14}/> Add your first chapter</button></div>}
      </section>

      <section className="atlas-academics-panel atlas-progress-panel">
        <div className="atlas-panel-heading"><div><p className="eyebrow">LEARNING, NOT JUST CHECKLISTS</p><h3>Concept progress</h3></div><span className="atlas-panel-icon"><Target size={17}/></span></div>
        {selectedConcept ? <form className="atlas-progress-form" onSubmit={saveProgress}>
          <div className="atlas-selected-concept"><span>SELECTED CONCEPT</span><h4>{selectedConcept.title}</h4><p>{topicMap.get(selectedConcept.topic_id)?.title}</p></div>
          <section className="atlas-prerequisite-panel">
            <div><p className="eyebrow">BUILD THE FOUNDATION</p><h4>Prerequisites</h4><span>What should you understand before tackling this concept?</span></div>
            <input className="atlas-prerequisite-search" value={prerequisiteSearch} onChange={e=>setPrerequisiteSearch(e.target.value)} placeholder="Find a concept in this subject…"/>
            <div className="atlas-prerequisite-list">
              {concepts.filter(item=>item.id!==selectedConcept.id&&item.title.toLowerCase().includes(prerequisiteSearch.toLowerCase())).map(item=><label key={item.id}><input type="checkbox" checked={prerequisiteIds.includes(item.id)} onChange={e=>setPrerequisiteIds(current=>e.target.checked?[...current,item.id]:current.filter(id=>id!==item.id))}/><span><strong>{item.title}</strong><small>{topicMap.get(item.topic_id)?.title} · {prerequisites.find(link=>link.id===item.id)?.understanding??"not assessed"}</small></span></label>)}
              {!concepts.some(item=>item.id!==selectedConcept.id&&item.title.toLowerCase().includes(prerequisiteSearch.toLowerCase()))&&<p>No matching concepts in this subject yet.</p>}
            </div>
            <button type="button" className="atlas-button atlas-secondary" disabled={busy} onClick={()=>void savePrerequisites()}>Save prerequisites</button>
          </section>
          <label>Exposure<select value={progress.exposure} onChange={e=>setProgress({...progress,exposure:e.target.value as Progress["exposure"]})}><option value="not_started">Not started</option><option value="studied">I've studied this</option></select></label>
          <label>Understanding<select value={progress.understanding} onChange={e=>setProgress({...progress,understanding:e.target.value as Progress["understanding"]})}><option value="not_assessed">Not assessed</option><option value="weak">Weak — needs a rethink</option><option value="developing">Developing — getting there</option><option value="strong">Strong — I can explain it</option></select></label>
          <label>Recall<select value={progress.recall} onChange={e=>setProgress({...progress,recall:e.target.value as Progress["recall"]})}><option value="not_assessed">Not assessed</option><option value="needs_practice">Needs practice</option><option value="comfortable">Comfortable</option></select></label>
          <div className="atlas-confidence-control">
            <div className="atlas-confidence-heading"><label>Confidence</label><strong className="atlas-confidence-value">{progress.confidence===null?"Not rated":`${progress.confidence} / 5`}</strong></div>
            <p>How sure are you that you could explain this without looking at your notes?</p>
            <div className="atlas-confidence-options" role="group" aria-label="Confidence level">
              {[1,2,3,4,5].map(value=><button key={value} type="button" aria-pressed={progress.confidence===value} className={progress.confidence===value?"active":""} onClick={()=>setProgress({...progress,confidence:value})}><span>{value}</span><small>{["Unsure","Shaky","Okay","Good","Solid"][value-1]}</small></button>)}
            </div>
            <div className="atlas-confidence-scale"><span>Still learning</span><span>Could teach it</span></div>
          </div>
          <label>Personal notes<textarea rows={3} value={progress.notes??""} onChange={e=>setProgress({...progress,notes:e.target.value})} placeholder="What clicked? What still feels fuzzy?"/></label>
          {progress.next_review_at&&<p className="atlas-next-review">Next suggested review · {new Date(progress.next_review_at).toLocaleDateString("en-IN",{dateStyle:"medium"})}</p>}
          <button className="atlas-button atlas-primary atlas-full" disabled={busy}><Check size={14}/> Save progress</button>
          <section className="atlas-review-history"><p className="eyebrow">YOUR REVIEW HISTORY</p>{reviews.length?reviews.slice(0,5).map(review=><div key={review.id}><span>{new Date(review.reviewed_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span><strong>{review.understanding.replace("_"," ")} · {review.recall.replace("_"," ")}</strong>{review.confidence!==null&&<small>Confidence {review.confidence}/5</small>}</div>):<p>No check-ins yet. Your progress saves will appear here.</p>}</section>
        </form> : <div className="atlas-progress-empty"><Brain size={25}/><strong>Pick a concept to check in with yourself.</strong><span>Track understanding and recall separately. Being exposed to a topic isn't the same as knowing it.</span></div>}
      </section>
    </div>

    <div className="atlas-academics-bottom">
      <section className="atlas-academics-panel atlas-readiness-panel">
        <div className="atlas-panel-heading"><div><p className="eyebrow">NO MADE-UP SCORES</p><h3>Where things stand</h3></div><span className="atlas-panel-icon"><Sparkles size={17}/></span></div>
        {readiness && <><div className="atlas-readiness-total"><strong>{readiness.total_concepts}</strong><span>concepts in this syllabus</span></div>{readiness.next_exam&&<p className="atlas-readiness-exam">{readiness.next_exam.title} · {readiness.next_exam.days_until===0?"today":"in "+readiness.next_exam.days_until+" days"}</p>}{Boolean(readiness.due_for_review)&&<p className="atlas-recommendation"><span>{readiness.due_for_review}</span>Concepts are due for a spaced review.</p>}
          <div className="atlas-readiness-bars">
            <ReadinessBar label="Strong" value={readiness.strong} total={readiness.total_concepts} tone="teal"/>
            <ReadinessBar label="Developing" value={readiness.developing} total={readiness.total_concepts} tone="blue"/>
            <ReadinessBar label="Weak" value={readiness.weak} total={readiness.total_concepts} tone="coral"/>
            <ReadinessBar label="Not assessed" value={readiness.not_assessed} total={readiness.total_concepts} tone="lilac"/>
          </div><p className="atlas-readiness-foot">This is a count of your self-assessments, not a predicted grade or exam score.</p>
          {readiness.recommendations.filter(r=>r.count>0).map(r=><p className="atlas-recommendation" key={r.reason}><span>{r.count}</span>{r.message}</p>)}
        </>}
      </section>
      <section className="atlas-academics-panel atlas-exams-panel">
        <div className="atlas-panel-heading"><div><p className="eyebrow">DATES THAT MATTER</p><h3>Upcoming exams</h3></div><button className="atlas-mini-action" onClick={()=>setAddingExam(!addingExam)} title="Add exam"><Plus size={16}/></button></div>
        {addingExam && <form className="atlas-exam-form" onSubmit={editingExamId===null?addExam:saveExamEdit}><input value={examTitle} onChange={e=>setExamTitle(e.target.value)} aria-label="Exam title" placeholder="Exam title" required/><input type="datetime-local" value={examDate} onChange={e=>setExamDate(e.target.value)} required aria-label="Exam date"/><div className="atlas-exam-form-actions"><button className="atlas-button atlas-primary" disabled={busy}>{editingExamId===null?"Add exam":"Save changes"}</button>{editingExamId!==null&&<button type="button" className="atlas-button atlas-secondary" onClick={cancelExamEdit} disabled={busy}>Cancel</button>}</div></form>}
        {exams.length ? exams.map(ex=><div className="atlas-exam-row" key={ex.id}><CalendarDays size={16}/><div className="atlas-exam-details"><strong>{ex.title}</strong><span>{new Date(ex.exam_date).toLocaleString(undefined,{dateStyle:"medium",timeStyle:"short"})}</span></div><div className="atlas-exam-actions"><button type="button" className="atlas-mini-action" onClick={()=>editExam(ex)} disabled={busy} title={`Edit ${ex.title}`} aria-label={`Edit ${ex.title}`}><Pencil size={14}/></button><button type="button" className="atlas-mini-action danger" onClick={()=>void removeExam(ex)} disabled={busy} title={`Delete ${ex.title}`} aria-label={`Delete ${ex.title}`}><Trash2 size={14}/></button></div></div>) : <p className="atlas-exams-empty">No exam dates yet. Add one when you know it.</p>}
      </section>
    </div>
  </div>;
}

function ReadinessBar({label,value,total,tone}:{label:string;value:number;total:number;tone:string}) {
  const width = total ? `${Math.round(value/total*100)}%` : "0%";
  return <div className="atlas-readiness-row"><div><span>{label}</span><strong>{value}</strong></div><div className="atlas-readiness-track"><i className={tone} style={{width}}/></div></div>;
}
