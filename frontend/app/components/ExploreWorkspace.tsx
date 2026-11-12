"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, FileText, FolderOpen, Link2, LoaderCircle, Search, Trash2, Upload, X,
} from "lucide-react";
import { api, apiBlob } from "../../lib/api";
import PdfReaderWorkspace from "./PdfReaderWorkspace";

type DocumentItem = {
  id:number; title:string; filename:string; source_url:string|null; page_count:number;
  size_bytes:number; last_page:number; last_opened_at:string|null; created_at:string;
};
type BookmarkItem = {id:number;page_number:number;label:string};
type AnnotationItem = {id:number;page_number:number;selected_text:string|null;highlight_rects:{x:number;y:number;width:number;height:number}[]|null;note:string;annotation_type:"highlight"|"underline"|"strikeout"|"comment";color:"yellow"|"green"|"blue"|"pink";created_at:string;updated_at:string};

function formatBytes(bytes:number) {
  if(bytes < 1024*1024) return `${Math.max(1,Math.round(bytes/1024))} KB`;
  return `${(bytes/(1024*1024)).toFixed(1)} MB`;
}

export default function ExploreWorkspace() {
  const [documents,setDocuments] = useState<DocumentItem[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [selected,setSelected] = useState<DocumentItem|null>(null);
  const [pdfUrl,setPdfUrl] = useState("");
  const [page,setPage] = useState(1);
  const [bookmarks,setBookmarks] = useState<BookmarkItem[]>([]);
  const [annotations,setAnnotations] = useState<AnnotationItem[]>([]);
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
    setSelected(item); setPage(item.last_page);
    setPdfUrl(""); setBookmarks([]); setAnnotations([]);
    try {
      const [detail,blob,marks,annotations] = await Promise.all([
        api<DocumentItem>(`/explore/documents/${item.id}`),
        apiBlob(`/explore/documents/${item.id}/file`),
        api<BookmarkItem[]>(`/explore/documents/${item.id}/bookmarks`),
        api<AnnotationItem[]>(`/explore/documents/${item.id}/annotations`),
      ]);
      setSelected(detail); setPage(detail.last_page);
      setBookmarks(marks); setAnnotations(annotations); setPdfUrl(URL.createObjectURL(blob));
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
  async function closeReader(lastPage:number) {
    if(selected) {
      try {
        const updated=await api<DocumentItem>(`/explore/documents/${selected.id}`,{method:"PATCH",body:JSON.stringify({last_page:lastPage})});
        setDocuments(current=>current.map(doc=>doc.id===updated.id?updated:doc));
      } catch(e) { setError(e instanceof Error?e.message:"Could not save your reading position."); return; }
    }
    setSelected(null);setPdfUrl("");setError("");
  }
  async function deleteDocument(item:DocumentItem) {
    if(!window.confirm(`Remove "${item.title}" and its annotations?`))return;
    try {await api<void>(`/explore/documents/${item.id}`,{method:"DELETE"});setDocuments(current=>current.filter(doc=>doc.id!==item.id));if(selected?.id===item.id){setSelected(null);setPdfUrl("");}}
    catch(e){setError(e instanceof Error?e.message:"Could not remove this document.");}
  }
  const goToPage = useCallback((value:number) => {
    const next=Math.min(Math.max(1,value),selected?.page_count??1);
    setPage(next);
  },[selected?.page_count]);

  return (
    <section className={`atlas-explore ${readerMode?"reader-mode":""}`} aria-label="Explore PDF library">
      {!selected ? (
        <>
          <div className="atlas-explore-intro">
            <div><p className="eyebrow">THE READING ROOM</p><h2>Make room for <em>deep reading.</em></h2><p>A calm space for research papers, course readings, and passages worth marking.</p></div>
            <div className="atlas-explore-actions">
              <label className="atlas-button atlas-primary atlas-upload-button"><Upload size={15}/>{uploading?"Adding PDF…":"Upload PDF"}<input type="file" accept="application/pdf,.pdf" disabled={uploading} onChange={e=>{void uploadFile(e.target.files?.[0]);e.currentTarget.value="";}}/></label>
              <button className="atlas-button atlas-secondary" onClick={()=>setShowImport(true)}><Link2 size={15}/> Import from URL</button>
            </div>
          </div>
          {error&&<div className="atlas-explore-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
          <div className="atlas-library-toolbar"><div><p className="eyebrow">YOUR COLLECTION</p><h3>Reading library <span>{documents.length.toString().padStart(2,"0")}</span></h3></div><label className="atlas-library-search"><Search size={15}/><input value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Find a document…"/></label></div>
          {loading?<div className="atlas-explore-state"><LoaderCircle className="atlas-spin" size={19}/><span>Gathering your library…</span></div>:filtered.length===0?<div className="atlas-library-empty"><div><FolderOpen size={24}/></div><h3>{documents.length?"No matching documents.":"Your reading room is waiting."}</h3><p>{documents.length?"Try another title or filename.":"Upload a PDF or import one from a public link. Your reading progress, bookmarks and annotations will stay here."}</p></div>:<div className="atlas-document-grid">{filtered.map(doc=><article className="atlas-document-card" key={doc.id}>
            <button className="atlas-document-open" onClick={()=>void openDocument(doc)}><div className="atlas-document-cover"><FileText size={31}/><span>PDF</span><i>{doc.page_count} PAGES</i></div><div className="atlas-document-meta"><strong>{doc.title}</strong><small>{doc.filename}</small><span>{formatBytes(doc.size_bytes)} · {doc.last_page>1?`Page ${doc.last_page} of ${doc.page_count}`:`${doc.page_count} pages`}</span><div className="atlas-reading-progress"><i style={{width:`${Math.min(100,doc.last_page/doc.page_count*100)}%`}}/></div></div></button>
            <button className="atlas-document-remove" onClick={()=>void deleteDocument(doc)} aria-label={`Remove ${doc.title}`}><Trash2 size={14}/></button>
          </article>)}</div>}
          <div className="atlas-explore-footnote"><span/>YOUR LIBRARY IS PRIVATE TO YOUR ATLAS ACCOUNT</div>
          {showImport&&<div className="atlas-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!uploading)setShowImport(false);}}><form className="atlas-modal atlas-import-modal" onSubmit={importUrl} role="dialog" aria-modal="true" aria-labelledby="import-pdf-title"><div className="atlas-modal-heading"><div><p className="eyebrow">ADD TO YOUR LIBRARY</p><h2 id="import-pdf-title">Import a PDF</h2></div><button type="button" className="atlas-icon-button" onClick={()=>setShowImport(false)} disabled={uploading} aria-label="Close"><X size={18}/></button></div><label className="atlas-modal-label">Public PDF URL<input type="url" required value={remoteUrl} onChange={e=>setRemoteUrl(e.target.value)} placeholder="https://example.com/research-paper.pdf"/></label><label className="atlas-modal-label">Display title <small>OPTIONAL</small><input value={remoteTitle} onChange={e=>setRemoteTitle(e.target.value)} placeholder="A name you'll recognise"/></label><p className="atlas-import-hint">Atlas downloads and stores a local copy (up to 50 MB). Links to private networks and password-protected PDFs are not supported.</p>{error&&<p className="atlas-error" role="alert">{error}</p>}<button className="atlas-button atlas-primary atlas-full" disabled={uploading}>{uploading?"Importing…":"Import document"}<ArrowUpRight size={15}/></button></form></div>}
        </>
      ) : (
        <div className="atlas-reader">
          <PdfReaderWorkspace
            documentId={selected.id}
            title={selected.title}
            pageCount={selected.page_count}
            pdfUrl={pdfUrl}
            initialPage={page}
            bookmarks={bookmarks}
            annotations={annotations}
            readerMode={readerMode}
            onExit={lastPage=>void closeReader(lastPage)}
            onToggleFocus={()=>setReaderMode(v=>!v)}
            onProgressChange={goToPage}
            onBookmarksChange={setBookmarks}
            onAnnotationsChange={setAnnotations}
            onError={setError}
          />
        </div>
      )}
    </section>
  );
}
