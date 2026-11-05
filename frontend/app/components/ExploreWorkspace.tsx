"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Bookmark, BookOpen, Check, ChevronLeft, ChevronRight,
  FilePlus2, FileText, FolderOpen, Link2, LoaderCircle, Maximize2, Minus, Plus,
  Search, StickyNote, Trash2, Upload, X,
} from "lucide-react";
import { api, apiBlob } from "../../lib/api";

type DocumentItem = {
  id:number; title:string; filename:string; source_url:string|null; page_count:number;
  size_bytes:number; last_page:number; last_opened_at:string|null; created_at:string;
};
type BookmarkItem = {id:number;page_number:number;label:string};
type AnnotationItem = {id:number;page_number:number;selected_text:string|null;note:string;created_at:string;updated_at:string};

function formatBytes(bytes:number) {
  if(bytes < 1024*1024) return `${Math.max(1,Math.round(bytes/1024))} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

export default function ExploreWorkspace() {
  const [documents,setDocuments] = useState<DocumentItem[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState<DocumentItem|null>(null);
  const [pdfUrl,setPdfUrl] = useState("");
  const [page,setPage] = useState(1);
  const [pageDraft,setPageDraft] = useState("1");
  const [zoom,setZoom] = useState("page-width");
  const [bookmarks,setBookmarks] = useState<BookmarkItem[]>([]);
  const [annotations,setAnnotations] = useState<AnnotationItem[]>([]);
  const [panel,setPanel] = useState<"notes"|"bookmarks">("notes");
  const [noteText,setNoteText] = useState("");
  const [selectedText,setSelectedText] = useState("");
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [showImport,setShowImport] = useState(false);
  const [remoteUrl,setRemoteUrl] = useState("");
  const [remoteTitle,setRemoteTitle] = useState("");
  const [librarySearch,setLibrarySearch] = useState("");
  const [readerMode,setReaderMode] = useState(false);

  const loadLibrary = useCallback(async () => {
    setLoading(true); setError("");
    try { setDocuments(await api<DocumentItem[]>("/explore/documents")); }
    catch(e) { setError(e instanceof Error?e.message:"Could not load your library."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{void loadLibrary();},[loadLibrary]);
  useEffect(()=>()=>{if(pdfUrl) URL.revokeObjectURL(pdfUrl);},[pdfUrl]);

  const openDocument = useCallback(async (item:DocumentItem) => {
    setError("");
    setSelected(item); setPage(item.last_page); setPageDraft(String(item.last_page));
    setPdfUrl(""); setBookmarks([]); setAnnotations([]);
    try {
      const [detail,blob,marks,notes] = await Promise.all([
        api<DocumentItem>(`/explore/documents/${item.id}`),
        apiBlob(`/explore/documents/${item.id}/file`),
        api<BookmarkItem[]>(`/explore/documents/${item.id}/bookmarks`),
        api<AnnotationItem[]>(`/explore/documents/${item.id}/annotations`),
      ]);
      setSelected(detail); setPage(detail.last_page); setPageDraft(String(detail.last_page));
      setBookmarks(marks); setAnnotations(notes); setPdfUrl(URL.createObjectURL(blob));
      setDocuments(current=>current.map(doc=>doc.id===detail.id?detail:doc));
    } catch(e) { setError(e instanceof Error?e.message:"Could not open this PDF."); setSelected(null); }
  },[]);

  useEffect(()=>{
    if(!selected) return;
    const id=selected.id;
    const timer=window.setTimeout(()=>{
      void api<DocumentItem>(`/explore/documents/${id}`,{method:"PATCH",body:JSON.stringify({last_page:page})})
        .then(updated=>setDocuments(current=>current.map(doc=>doc.id===id?updated:doc)))
        .catch(()=>{});
    },650);
    return ()=>window.clearTimeout(timer);
  },[page,selected]);

  const filtered = useMemo(()=>documents.filter(doc=>`${doc.title} ${doc.filename}`.toLowerCase().includes(librarySearch.toLowerCase())),[documents,librarySearch]);
  const viewerUrl = pdfUrl ? `${pdfUrl}#page=${page}&zoom=${zoom}&toolbar=1&navpanes=1` : "";

  async function uploadFile(file?:File) {
    if(!file) return;
    setUploading(true);setError("");
    try {
      const body=new FormData();body.append("file",file);
      const created=await api<DocumentItem>("/explore/documents",{method:"POST",body});
      setDocuments(current=>[created,...current]);await openDocument(created);
    } catch(e) {setError(e instanceof Error?e.message:"Could not upload this PDF.");}
    finally {setUploading(false);}
  }
  async function importUrl(e:React.FormEvent) {
    e.preventDefault();setUploading(true);setError("");
    try {
      const created=await api<DocumentItem>("/explore/documents/import-url",{method:"POST",body:JSON.stringify({url:remoteUrl,title:remoteTitle.trim()||null})});
      setDocuments(current=>[created,...current]);setShowImport(false);setRemoteUrl("");setRemoteTitle("");await openDocument(created);
    } catch(e) {setError(e instanceof Error?e.message:"Could not import this PDF.");}
    finally {setUploading(false);}
  }
  async function addBookmark() {
    if(!selected) return;
    setSaving(true);
    try {
      const item=await api<BookmarkItem>(`/explore/documents/${selected.id}/bookmarks`,{method:"POST",body:JSON.stringify({page_number:page,label:`Page ${page}`})});
      setBookmarks(current=>[...current.filter(mark=>mark.page_number!==page),item].sort((a,b)=>a.page_number-b.page_number));
    } catch(e) {setError(e instanceof Error?e.message:"Could not save bookmark.");}
    finally {setSaving(false);}
  }
  async function saveNote(e:React.FormEvent) {
    e.preventDefault();if(!selected||!noteText.trim())return;
    setSaving(true);
    try {
      const item=await api<AnnotationItem>(`/explore/documents/${selected.id}/annotations`,{method:"POST",body:JSON.stringify({page_number:page,selected_text:selectedText.trim()||null,note:noteText.trim()})});
      setAnnotations(current=>[item,...current]);setNoteText("");setSelectedText("");setPanel("notes");
    } catch(e) {setError(e instanceof Error?e.message:"Could not save this note.");}
    finally {setSaving(false);}
  }
  async function removeBookmark(id:number) {
    if(!selected)return;
    try {await api<void>(`/explore/documents/${selected.id}/bookmarks/${id}`,{method:"DELETE"});setBookmarks(current=>current.filter(item=>item.id!==id));}
    catch(e){setError(e instanceof Error?e.message:"Could not remove bookmark.");}
  }
  async function removeNote(id:number) {
    if(!selected)return;
    try {await api<void>(`/explore/documents/${selected.id}/annotations/${id}`,{method:"DELETE"});setAnnotations(current=>current.filter(item=>item.id!==id));}
    catch(e){setError(e instanceof Error?e.message:"Could not remove note.");}
  }
  async function closeReader() {
    if(selected) {
      try {
        const updated=await api<DocumentItem>(`/explore/documents/${selected.id}`,{method:"PATCH",body:JSON.stringify({last_page:page})});
        setDocuments(current=>current.map(doc=>doc.id===updated.id?updated:doc));
      } catch(e) { setError(e instanceof Error?e.message:"Could not save your reading position."); return; }
    }
    setSelected(null);setPdfUrl("");setError("");
  }
  async function deleteDocument(item:DocumentItem) {
    if(!window.confirm(`Remove "${item.title}" and its reading notes?`))return;
    try {await api<void>(`/explore/documents/${item.id}`,{method:"DELETE"});setDocuments(current=>current.filter(doc=>doc.id!==item.id));if(selected?.id===item.id){setSelected(null);setPdfUrl("");}}
    catch(e){setError(e instanceof Error?e.message:"Could not remove this document.");}
  }
  function goToPage(value:number) {
    const next=Math.min(Math.max(1,value),selected?.page_count??1);
    setPage(next);setPageDraft(String(next));
  }

  return (
    <section className={`atlas-explore ${readerMode?"reader-mode":""}`} aria-label="Explore PDF library">
      {!selected ? (
        <>
          <div className="atlas-explore-intro">
            <div><p className="eyebrow">THE READING ROOM</p><h2>Make room for <em>curiosity.</em></h2><p>A quiet place for papers, books and ideas worth following.</p></div>
            <div className="atlas-explore-actions">
              <label className="atlas-button atlas-primary atlas-upload-button"><Upload size={15}/>{uploading?"Adding PDF…":"Upload PDF"}<input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={e=>{void uploadFile(e.target.files?.[0]);e.currentTarget.value="";}}/></label>
              <button className="atlas-button atlas-secondary" onClick={()=>setShowImport(true)}><Link2 size={15}/> Import from URL</button>
            </div>
          </div>
          {error&&<div className="atlas-explore-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
          <div className="atlas-library-toolbar"><div><p className="eyebrow">YOUR COLLECTION</p><h3>Reading library <span>{documents.length.toString().padStart(2,"0")}</span></h3></div><label className="atlas-library-search"><Search size={15}/><input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Find a document…"/></label></div>
          {loading?<div className="atlas-explore-state"><LoaderCircle className="atlas-spin" size={19}/><span>Gathering your library…</span></div>:filtered.length===0?<div className="atlas-library-empty"><div><FolderOpen size={24}/></div><h3>{documents.length?"No matching documents.":"Your reading room is waiting."}</h3><p>{documents.length?"Try another title or filename.":"Upload a PDF or import one from a public link. Your reading progress, bookmarks and notes will stay here."}</p></div>:<div className="atlas-document-grid">{filtered.map(doc=><article className="atlas-document-card" key={doc.id}>
            <button className="atlas-document-open" onClick={()=>void openDocument(doc)}><div className="atlas-document-cover"><FileText size={31}/><span>PDF</span><i>{doc.page_count} PAGES</i></div><div className="atlas-document-meta"><strong>{doc.title}</strong><small>{doc.filename}</small><span>{formatBytes(doc.size_bytes)} · {doc.last_page>1?`Page ${doc.last_page} of ${doc.page_count}`:`${doc.page_count} pages`}</span><div className="atlas-reading-progress"><i style={{width:`${Math.min(100,doc.last_page/doc.page_count*100)}%`}}/></div></div></button>
            <button className="atlas-document-remove" onClick={()=>void deleteDocument(doc)} aria-label={`Remove ${doc.title}`}><Trash2 size={14}/></button>
          </article>)}</div>}
          <div className="atlas-explore-footnote"><span/>YOUR LIBRARY IS PRIVATE TO YOUR ATLAS ACCOUNT</div>
          {showImport&&<div className="atlas-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!uploading)setShowImport(false);}}><form className="atlas-modal atlas-import-modal" onSubmit={importUrl} role="dialog" aria-modal="true" aria-labelledby="import-pdf-title"><div className="atlas-modal-heading"><div><p className="eyebrow">ADD TO YOUR LIBRARY</p><h2 id="import-pdf-title">Import a PDF</h2></div><button type="button" className="atlas-icon-button" onClick={()=>setShowImport(false)} disabled={uploading} aria-label="Close"><X size={18}/></button></div><label className="atlas-modal-label">Public PDF URL<input type="url" required value={remoteUrl} onChange={e=>setRemoteUrl(e.target.value)} placeholder="https://example.com/research-paper.pdf"/></label><label className="atlas-modal-label">Display title <small>OPTIONAL</small><input value={remoteTitle} onChange={e=>setRemoteTitle(e.target.value)} placeholder="A name you'll recognise"/></label><p className="atlas-import-hint">Atlas downloads and stores a copy (up to 12 MB). Links to private networks and password-protected PDFs are not supported.</p>{error&&<p className="atlas-error" role="alert">{error}</p>}<button className="atlas-button atlas-primary atlas-full" disabled={uploading}>{uploading?"Importing…":"Import document"}<ArrowUpRight size={15}/></button></form></div>}
        </>
      ) : (
        <div className="atlas-reader">
          <header className="atlas-reader-header">
            <button className="atlas-reader-back" onClick={()=>void closeReader()}><ArrowLeft size={15}/> Library</button>
            <div className="atlas-reader-document-title"><FileText size={16}/><span>{selected.title}</span><small>PDF</small></div>
            <button className="atlas-reader-mode" onClick={()=>setReaderMode(v=>!v)}><Maximize2 size={14}/>{readerMode?"Exit focus":"Focus mode"}</button>
          </header>
          {error&&<div className="atlas-explore-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
          <div className="atlas-reader-toolbar">
            <div className="atlas-reader-page-control"><button onClick={()=>goToPage(page-1)} disabled={page<=1} aria-label="Previous page"><ChevronLeft size={16}/></button><input aria-label="Current page" value={pageDraft} inputMode="numeric" onChange={e=>setPageDraft(e.target.value)} onBlur={()=>goToPage(Number(pageDraft)||page)} onKeyDown={e=>{if(e.key==="Enter")goToPage(Number(pageDraft)||page);}}/><span>/ {selected.page_count}</span><button onClick={()=>goToPage(page+1)} disabled={page>=selected.page_count} aria-label="Next page"><ChevronRight size={16}/></button></div>
            <div className="atlas-reader-toolbar-divider"/>
            <button className="atlas-reader-tool" onClick={()=>setZoom("page-width")} title="Fit width">Fit width</button><button className="atlas-reader-tool" onClick={()=>setZoom("page-fit")} title="Fit page">Fit page</button>
            <div className="atlas-reader-zoom"><button onClick={()=>setZoom(v=>String(Math.max(50,(Number(v)||100)-10)))} aria-label="Zoom out"><Minus size={14}/></button><span>{zoom==="page-width"?"Width":zoom==="page-fit"?"Page":`${zoom}%`}</span><button onClick={()=>setZoom(v=>String(Math.min(200,(Number(v)||100)+10)))} aria-label="Zoom in"><Plus size={14}/></button></div>
            <button className={`atlas-reader-tool ${bookmarks.some(mark=>mark.page_number===page)?"active":""}`} onClick={()=>void addBookmark()} disabled={saving} title="Bookmark this page"><Bookmark size={15}/> Bookmark</button>
          </div>
          <div className="atlas-reader-body">
            <main className="atlas-pdf-stage">
              {pdfUrl?<iframe key={viewerUrl} title={`PDF reader: ${selected.title}`} src={viewerUrl} className="atlas-pdf-frame"/>:<div className="atlas-explore-state"><LoaderCircle className="atlas-spin" size={20}/>Preparing your reader…</div>}
              <div className="atlas-reader-status"><span>PAGE {page} OF {selected.page_count}</span><span>{Math.round(page/selected.page_count*100)}% THROUGH</span></div>
            </main>
            <aside className="atlas-reader-sidebar">
              <div className="atlas-reader-tabs"><button className={panel==="notes"?"active":""} onClick={()=>setPanel("notes")}><StickyNote size={14}/> Notes <span>{annotations.length}</span></button><button className={panel==="bookmarks"?"active":""} onClick={()=>setPanel("bookmarks")}><Bookmark size={14}/> Bookmarks <span>{bookmarks.length}</span></button></div>
              {panel==="notes"?<>
                <form className="atlas-reader-note-form" onSubmit={saveNote}><p className="eyebrow">CAPTURE A THOUGHT</p><span>Page {page}</span><label>Passage <small>OPTIONAL · COPY TEXT FROM THE PDF AND PASTE HERE</small><textarea rows={3} value={selectedText} onChange={e=>setSelectedText(e.target.value)} placeholder="A sentence worth keeping…"/></label><label>Your note<textarea rows={4} required value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="What stood out? What do you want to investigate?"/></label><button className="atlas-button atlas-primary atlas-full" disabled={saving||!noteText.trim()}>{saving?"Saving…":"Save note"}<Check size={14}/></button></form>
                <div className="atlas-reader-list-heading">YOUR NOTES</div>
                {annotations.length?annotations.map(note=><article className="atlas-reader-note" key={note.id}><button className="atlas-reader-note-page" onClick={()=>goToPage(note.page_number)}>PAGE {note.page_number} <ArrowUpRight size={11}/></button>{note.selected_text&&<blockquote>{note.selected_text}</blockquote>}<p>{note.note}</p><button className="atlas-reader-note-delete" onClick={()=>void removeNote(note.id)} aria-label="Delete note"><Trash2 size={12}/></button></article>):<p className="atlas-reader-empty">Your page notes and saved passages will appear here.</p>}
              </>:<><div className="atlas-reader-list-heading">BOOKMARKED PAGES</div>{bookmarks.length?bookmarks.map(mark=><article className="atlas-reader-bookmark" key={mark.id}><button onClick={()=>goToPage(mark.page_number)}><Bookmark size={13}/><span><strong>{mark.label}</strong><small>Page {mark.page_number}</small></span><ArrowUpRight size={13}/></button><button className="atlas-reader-note-delete" onClick={()=>void removeBookmark(mark.id)} aria-label="Remove bookmark"><Trash2 size={12}/></button></article>):<p className="atlas-reader-empty">Bookmark a page to find your way back to it.</p>}</>}
              <div className="atlas-reader-sidebar-foot"><BookOpen size={13}/> Notes stay attached to this document.</div>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}
