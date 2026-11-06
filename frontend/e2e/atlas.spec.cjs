function createPdfFixture() {
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R 7 0 R 8 0 R 9 0 R 10 0 R] /Count 8 >>";
  for (let i=0;i<8;i++) {
    objects[3+i] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 11 0 R >> >> /Contents ${12+i} 0 R >>`;
    const text = `BT /F1 18 Tf 50 740 Td (Page ${i+1} searchable text for Atlas reader tests) Tj ET`;
    objects[12+i] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  }
  objects[11] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i=1;i<objects.length;i++) { offsets[i]=Buffer.byteLength(pdf,"binary"); pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf,"binary");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i=1;i<objects.length;i++) pdf += `${String(offsets[i]).padStart(10,"0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf,"binary");
}

const { test, expect } = require("@playwright/test");

function installApiMock(page, options = {}) {
  const state = { subjects: [], topics: [], concepts: [], notes: {}, exams: [], progress: {}, reviews: [], versions: [] };
  let failSubjectsOnce = Boolean(options.failSubjectsOnce);
  let failSubjectCreateOnce = Boolean(options.failSubjectCreateOnce);
  let failCalendarNoteSaveOnce = Boolean(options.failCalendarNoteSaveOnce);
  let nextId = 1;

  page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    let body = {};
    if (method !== "GET" && method !== "DELETE") { try { body = request.postDataJSON?.() ?? {}; } catch { body = {}; } }
    const json = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    const created = data => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(data) });
    const empty = () => route.fulfill({ status: 204, body: "" });

    if (path === "/auth/login" || path === "/auth/register") return json({ access_token: "e2e-token" });
    if (path === "/subjects" && method === "GET") {
      if (failSubjectsOnce) {
        failSubjectsOnce = false;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Temporary subject service outage." }) });
      }
      const term = url.searchParams.get("term");
      return json(term ? state.subjects.filter(s => s.term === term) : state.subjects);
    }
    if (path === "/subjects" && method === "POST") {
      if (failSubjectCreateOnce) {
        failSubjectCreateOnce = false;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Subject save temporarily unavailable." }) });
      }
      const subject = { id: nextId++, created_at: new Date().toISOString(), ...body };
      state.subjects.push(subject);
      return created(subject);
    }
    const subjectPath = path.match(/^\/subjects\/(\d+)\/?$/);
    if (subjectPath && method === "PATCH") {
      const index = state.subjects.findIndex(s => s.id === Number(subjectPath[1]));
      if (index < 0) return route.fulfill({ status: 404 });
      state.subjects[index] = { ...state.subjects[index], ...body };
      return json(state.subjects[index]);
    }
    if (subjectPath && method === "DELETE") {
      const id = Number(subjectPath[1]);
      state.subjects = state.subjects.filter(s => s.id !== id);
      const removedTopicIds = state.topics.filter(t => t.subject_id === id).map(t => t.id);
      state.topics = state.topics.filter(t => t.subject_id !== id);
      state.concepts = state.concepts.filter(concept => !removedTopicIds.includes(concept.topic_id));
      return empty();
    }
    if (path === "/overview" && method === "GET") {
      const activity = state.reviews.map(r => ({
        concept_id:r.concept_id,
        concept_title:state.concepts.find(c=>c.id===r.concept_id)?.title ?? "Concept",
        topic_title:"Chapter",
        subject_id:state.topics.find(t=>t.id===state.concepts.find(c=>c.id===r.concept_id)?.topic_id)?.subject_id ?? 1,
        subject_name:state.subjects[0]?.name ?? "Subject",
        understanding:r.understanding,
        recall:r.recall,
        last_reviewed:r.reviewed_at,
      }));
      const upcoming = state.exams.map(e => ({...e,subject_name:state.subjects.find(s=>s.id===e.subject_id)?.name ?? "Subject",days_until:0}));
      return json({
        learning_summary:{total_concepts:state.concepts.length,strong:0,developing:0,weak:0,not_assessed:state.concepts.length,due_for_review:0},
        recent_activity:activity,
        continue_learning:activity,
        revision_suggestions:state.concepts.map(c=>({concept_id:c.id,concept_title:c.title,topic_title:"Chapter",subject_id:1,subject_name:state.subjects[0]?.name ?? "Subject",reason:["not_assessed"],priority:1,days_until_exam:null,exam_title:null})),
        upcoming_exams:upcoming,
      });
    }
    if (path === "/quotes/daily" || path === "/quotes/random") return json({ quote:"Curiosity is a compass.", author:"Atlas" });
    if (path.endsWith("/exams") && method === "GET") return json(state.exams);
    if (path.endsWith("/exams") && method === "POST") { const exam={id:nextId++,...body}; state.exams.push(exam); return created(exam); }
    const examPath=path.match(/\/exams\/(\d+)\/?$/);
    if (examPath && method === "PATCH") { const index=state.exams.findIndex(e=>e.id===Number(examPath[1])); state.exams[index]={...state.exams[index],...body}; return json(state.exams[index]); }
    if (examPath && method === "DELETE") { state.exams=state.exams.filter(e=>e.id!==Number(examPath[1])); return empty(); }
    if (path.startsWith("/calendar?") || (path === "/calendar" && method === "GET")) {
      return json(Object.entries(state.notes).map(([day,note])=>({day,note})).filter(row=>row.day>=url.searchParams.get("start")&&row.day<=url.searchParams.get("end")));
    }
    if (path.startsWith("/calendar/") && method === "PUT") {
      if (failCalendarNoteSaveOnce) {
        failCalendarNoteSaveOnce = false;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Calendar note save temporarily unavailable." }) });
      }
      const day = path.split("/").pop(); state.notes[day] = body.note;
      return json({ day, note:body.note, created_at:new Date().toISOString(), updated_at:new Date().toISOString() });
    }
    if (path.startsWith("/calendar/") && method === "DELETE") { delete state.notes[path.split("/").pop()]; return empty(); }
    const subjectTopics = path.match(/^\/subjects\/(\d+)\/topics$/);
    if (subjectTopics && method === "GET") return json(state.topics.filter(t=>t.subject_id===Number(subjectTopics[1])));
    if (subjectTopics && method === "POST") {
      const topic = { id:nextId++, subject_id:Number(subjectTopics[1]), parent_topic_id:body.parent_topic_id ?? null, position:state.topics.length, description:null, source_pages:null, ...body };
      state.topics.push(topic); return created(topic);
    }
    const subjectConcepts = path.match(/^\/subjects\/(\d+)\/concepts$/);
    if (subjectConcepts && method === "GET") return json(state.concepts.filter(c=>state.topics.some(t=>t.id===c.topic_id&&t.subject_id===Number(subjectConcepts[1]))));
    const readiness = path.match(/^\/subjects\/(\d+)\/readiness$/);
    if (readiness) return json({ subject_id:Number(readiness[1]), total_concepts:state.concepts.length, strong:0, developing:0, weak:0, not_assessed:state.concepts.length, recommendations:[], items:[], next_exam:null });
    const versions = path.match(/^\/subjects\/(\d+)\/syllabus\/versions$/);
    if (versions && method === "GET") return json(state.versions.filter(v=>v.subject_id===Number(versions[1])));
    if (versions && method === "POST") {
      const version={id:nextId++,subject_id:Number(versions[1]),version_number:state.versions.length+1,label:body.label ?? body.version_name ?? "Automatic snapshot",created_at:new Date().toISOString(),snapshot:{topics:state.topics}};
      state.versions.push(version); return created(version);
    }
    const topicDelete = path.match(/^\/topics\/(\d+)\/?$/);
    if (topicDelete && method === "DELETE") {
      const id = Number(topicDelete[1]);
      const topicIds = state.topics.filter(t => t.id === id || t.parent_topic_id === id).map(t => t.id);
      state.topics = state.topics.filter(t => !topicIds.includes(t.id));
      state.concepts = state.concepts.filter(concept => !topicIds.includes(concept.topic_id));
      return empty();
    }
    const conceptDelete = path.match(/^\/concepts\/(\d+)\/?$/);
    if (conceptDelete && method === "DELETE") {
      const id = Number(conceptDelete[1]);
      state.concepts = state.concepts.filter(concept => concept.id !== id);
      delete state.progress[id];
      state.reviews = state.reviews.filter(review => review.concept_id !== id);
      return empty();
    }
    const topicConcepts = path.match(/^\/topics\/(\d+)\/concepts$/);
    if (topicConcepts && method === "POST") {
      const concept={id:nextId++,topic_id:Number(topicConcepts[1]),position:state.concepts.length,description:null,source_pages:null,...body};
      state.concepts.push(concept); return created(concept);
    }
    const conceptProgress = path.match(/^\/concepts\/(\d+)\/progress$/);
    if (conceptProgress && method === "GET") return json(state.progress[conceptProgress[1]] ?? null);
    if (conceptProgress && method === "PATCH") {
      const id=Number(conceptProgress[1]); const saved={id:nextId++,concept_id:id,exposure:"studied",understanding:"developing",recall:"comfortable",confidence:3,notes:"",last_reviewed:new Date().toISOString(),next_review_at:new Date(Date.now()+86400000).toISOString(),...body};
      state.progress[id]=saved; state.reviews.unshift({id:nextId++,concept_id:id,reviewed_at:new Date().toISOString(),understanding:saved.understanding,recall:saved.recall,confidence:saved.confidence});
      return json(saved);
    }
    const conceptReviews = path.match(/^\/concepts\/(\d+)\/reviews$/);
    if (conceptReviews) return json(state.reviews.filter(r=>r.concept_id===Number(conceptReviews[1])));
    const conceptPrerequisites = path.startsWith("/concepts/") && path.endsWith("/prerequisites");
    if (conceptPrerequisites && method === "GET") return json([]);
    if (path.startsWith("/subjects/") && path.includes("/syllabus/versions/")) {
      const id=Number(path.split("/").pop()); const version=state.versions.find(v=>v.id===id);
      return json(version ?? {});
    }
    if (path.startsWith("/explore/")) return route.continue();
    return route.fulfill({ status:404, contentType:"application/json", body:JSON.stringify({detail:`Unmocked E2E API: ${method} ${path}`}) });
  });
}

async function signIn(page) {
  await page.goto("/");
  await page.getByLabel("Email address").fill("student@example.com");
  await page.getByLabel("Password").fill("test-password");
  await page.getByRole("button",{name:/Sign in/}).click();
  await expect(page.getByRole("heading",{name:"Subjects on your map"})).toBeVisible();
}

test("student can create a subject with a term and see it in Academics", async ({ page }) => {
  installApiMock(page);
  await signIn(page);
  await page.getByRole("button",{name:/Add subject/}).first().click();
  await page.getByLabel("Subject name").fill("Machine Learning");
  await page.getByLabel("Course code").fill("CS402");
  await page.getByPlaceholder("e.g. Semester 5").fill("Semester 5");
  await page.getByRole("button",{name:"Save subject"}).click();
  await expect(page.getByRole("heading",{name:"Machine Learning"})).toBeVisible();
  await page.getByRole("button",{name:"Academics"}).click();
  await expect(page.locator(".atlas-academics-toolbar label").first()).toBeVisible();
  await page.locator(".atlas-academics-toolbar label").first().locator("select").selectOption({label:"Semester 5"});
});

test("student can build a chapter and concept manually, then save a review", async ({ page }) => {
  installApiMock(page);
  await signIn(page);
  await page.getByRole("button",{name:/Add subject/}).first().click();
  await page.getByLabel("Subject name").fill("Algorithms");
  await page.getByRole("button",{name:"Save subject"}).click();
  await expect(page.getByRole("heading",{name:"Algorithms"})).toBeVisible();
  await page.getByRole("button",{name:"Academics"}).click();
  await page.getByRole("button",{name:"Build manually"}).click();
  await page.getByLabel("Chapter or subchapter title").fill("Graph Algorithms");
  await page.getByRole("button",{name:"Add chapter"}).last().click();
  await expect(page.getByText("Graph Algorithms",{exact:true})).toBeVisible();
  await page.getByTitle("Add concept").click();
  await page.getByLabel("New concept").fill("Dijkstra's algorithm");
  await page.locator(".atlas-add-concept-form").getByRole("button",{name:"Add concept"}).click();
  await page.getByText("Dijkstra's algorithm",{exact:true}).click();
  await page.getByRole("button",{name:/Save progress/}).click();
  await expect(page.getByText(/Next suggested review/)).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByTitle("Delete concept").click();
  await expect(page.getByRole("status").filter({ hasText: "Concept and its progress deleted." })).toBeVisible();
});

test("calendar offers a weekly view and saves a day note", async ({ page }) => {
  installApiMock(page);
  await signIn(page);
  await page.getByRole("button",{name:"Week"}).click();
  await expect(page.locator(".atlas-calendar-day")).toHaveCount(7);
  await page.getByLabel("Edit day note").click();
  await page.getByLabel("Leave something for this day").fill("Review lecture notes");
  await page.getByRole("button",{name:"Save note"}).click();
  await expect(page.locator(".atlas-note-save")).toBeDisabled();
  await expect(page.locator(".atlas-note-save")).toContainText("Saved");
});


test("student can create, edit and delete an exam from Academics and Overview", async ({ page }) => {
  installApiMock(page);
  page.on("dialog", dialog => dialog.accept());
  await signIn(page);
  await page.getByRole("button",{name:/Add subject/}).first().click();
  await page.getByLabel("Subject name").fill("Computer Networks");
  await page.getByRole("button",{name:"Save subject"}).click();
  await expect(page.getByRole("heading",{name:"Computer Networks"})).toBeVisible();
  await page.getByRole("button",{name:"Academics"}).click();

  await page.getByTitle("Add exam").click();
  await page.getByLabel("Exam title").fill("Networks midterm");
  const examDate = new Date(Date.now()+60*60*1000);
  const localDate = new Date(examDate.getTime()-examDate.getTimezoneOffset()*60000).toISOString().slice(0,16);
  await page.getByLabel("Exam date").fill(localDate);
  await page.locator(".atlas-exam-form").getByRole("button",{name:"Add exam"}).click();
  await expect(page.getByText("Networks midterm",{exact:true})).toBeVisible();

  await page.getByLabel("Edit Networks midterm").click();
  await page.getByLabel("Exam title").fill("Networks final");
  await page.getByRole("button",{name:"Save changes"}).click();
  await expect(page.getByText("Networks final",{exact:true})).toBeVisible();

  await page.getByLabel("Delete Networks final").click();
  await expect(page.getByText("No exam dates yet.",{exact:false})).toBeVisible();

  await page.getByTitle("Add exam").click();
  await page.getByLabel("Exam title").fill("Overview exam");
  await page.getByLabel("Exam date").fill(localDate);
  await page.locator(".atlas-exam-form").getByRole("button",{name:"Add exam"}).click();
  await page.getByRole("button",{name:"Overview"}).click();
  await expect(page.locator(".atlas-overview-exam").filter({hasText:"Overview exam"})).toBeVisible();
  const examDayLabel = new Date(examDate).toLocaleDateString();
  await page.locator(".atlas-calendar-day[aria-label^='" + examDayLabel + "']").click();
  await page.getByLabel("Edit Overview exam").click();
  await page.getByLabel("Exam title").fill("Overview exam revised");
  await page.locator(".atlas-calendar-exam-edit").getByRole("button",{name:"Save"}).click();
  await expect(page.getByLabel("Delete Overview exam revised")).toBeVisible();
  await page.getByLabel("Delete Overview exam revised").click();
  await expect(page.getByLabel("Delete Overview exam revised")).toHaveCount(0);
});

test("Home shows a recoverable subject loading error and retries successfully", async ({ page }) => {
  installApiMock(page, { failSubjectsOnce: true });
  await signIn(page);
  await expect(page.getByRole("alert").filter({ hasText: "Could not load your subjects" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Your map is waiting for its first pin.")).toBeVisible();
});

test("subject save errors stay visible inside the open modal", async ({ page }) => {
  installApiMock(page, { failSubjectCreateOnce: true });
  await signIn(page);
  await page.getByRole("button", { name: /Add subject/ }).first().click();
  await page.getByLabel("Subject name").fill("Distributed Systems");
  await page.getByRole("button", { name: "Save subject" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a subject" });
  await expect(dialog.getByRole("alert")).toContainText("Subject save temporarily unavailable.");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save subject" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Subject added." })).toBeVisible();
});

test("subject deletion explains its impact and confirms before removing it", async ({ page }) => {
  installApiMock(page);
  await signIn(page);
  await page.getByRole("button", { name: /Add subject/ }).first().click();
  await page.getByLabel("Subject name").fill("Operating Systems");
  await page.getByRole("button", { name: "Save subject" }).click();
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { name: "Operating Systems" })).toBeVisible();
  let confirmation = "";
  page.once("dialog", async dialog => { confirmation = dialog.message(); await dialog.accept(); });
  await page.getByRole("button", { name: "Remove" }).click();
  expect(confirmation).toContain("syllabus, concepts, progress and exam records");
  await expect(page.getByText("Your map is waiting for its first pin.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Operating Systems" })).toBeVisible();
});

test("calendar note deletion is confirmed and mutation errors do not offer a misleading sync retry", async ({ page }) => {
  installApiMock(page, { failCalendarNoteSaveOnce: true });
  await signIn(page);
  await page.getByLabel("Edit day note").click();
  await page.getByLabel("Leave something for this day").fill("Keep this note");
  await page.locator(".atlas-note-save").click();
  await expect(page.getByRole("alert").filter({ hasText: "Calendar note save temporarily unavailable." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry sync" })).toHaveCount(0);
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.locator(".atlas-note-save").click();
  await expect(page.getByRole("status").filter({ hasText: "Day note saved." })).toBeVisible();
  const originalDay = await page.locator(".atlas-calendar-day[aria-pressed=true]").getAttribute("aria-label");
  await page.getByLabel("Edit day note").click();
  await page.getByLabel("Leave something for this day").fill("");
  page.once("dialog", dialog => dialog.dismiss());
  await page.locator(".atlas-note-save").click();
  await expect(page.getByLabel("Leave something for this day")).toHaveValue("");
  await page.locator(".atlas-calendar-day[aria-pressed=false]").first().click();
  await page.locator(".atlas-calendar-day[aria-label]").evaluateAll((cells, label) => { const target = cells.find(cell => cell.getAttribute("aria-label") === label); target?.click(); }, originalDay);
  await expect(page.getByText("Keep this note")).toBeVisible();
  await page.getByLabel("Edit day note").click();
  await page.getByLabel("Leave something for this day").fill("");
  page.once("dialog", dialog => dialog.accept());
  await page.locator(".atlas-note-save").click();
  await expect(page.getByRole("status").filter({ hasText: "Day note deleted." })).toBeVisible();
});


test("Explore keeps a PDF in the library with reading progress, bookmarks and page notes", async ({ page }) => {
  installApiMock(page);
  const docs = [];
  const bookmarks = [];
  const annotations = [];
  let nextId = 40;
  await page.route("**/api/v1/explore/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    let body = {};
    if (method !== "GET" && method !== "DELETE") { try { body = request.postDataJSON?.() ?? {}; } catch { body = {}; } }
    const json = data => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
    const created = data => route.fulfill({status:201,contentType:"application/json",body:JSON.stringify(data)});
    const empty = () => route.fulfill({status:204,body:""});
    if(path==="/explore/documents"&&method==="POST"){
      const doc={id:nextId++,title:"Research paper",filename:"paper.pdf",source_url:null,page_count:8,size_bytes:1024,last_page:1,last_opened_at:null,created_at:new Date().toISOString()};
      docs.unshift(doc);return created(doc);
    }
    if(path==="/explore/documents"&&method==="GET")return json(docs);
    if(path==="/explore/documents/import-url"&&method==="POST"){
      const doc={id:nextId++,title:body.title||"Imported paper",filename:"paper.pdf",source_url:body.url,page_count:8,size_bytes:1024,last_page:1,last_opened_at:null,created_at:new Date().toISOString()};
      docs.unshift(doc);return created(doc);
    }
    const docPath=path.match(/^\/explore\/documents\/(\d+)(?:\/(file))?$/);
    if(docPath&&docPath[2]==="file")return route.fulfill({status:200,contentType:"application/pdf",body:createPdfFixture()});
    if(docPath&&method==="GET")return json({...docs.find(d=>d.id===Number(docPath[1])),last_opened_at:new Date().toISOString()});
    if(docPath&&method==="PATCH"){const doc=docs.find(d=>d.id===Number(docPath[1]));Object.assign(doc,body);return json(doc);}
    if(docPath&&method==="DELETE"){const id=Number(docPath[1]);docs.splice(docs.findIndex(d=>d.id===id),1);return empty();}
    const marksPath=path.match(/^\/explore\/documents\/(\d+)\/bookmarks$/);
    if(marksPath&&method==="GET")return json(bookmarks);
    if(marksPath&&method==="POST"){const mark={id:nextId++,...body};bookmarks.push(mark);return created(mark);}
    const notesPath=path.match(/^\/explore\/documents\/(\d+)\/annotations$/);
    if(notesPath&&method==="GET")return json(annotations);
    if(notesPath&&method==="POST"){const note={id:nextId++,...body,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};annotations.unshift(note);return created(note);}
    const removeBookmark=path.match(/\/bookmarks\/(\d+)$/);
    if(removeBookmark&&method==="DELETE"){const index=bookmarks.findIndex(x=>x.id===Number(removeBookmark[1]));if(index>=0)bookmarks.splice(index,1);return empty();}
    const removeNote=path.match(/\/annotations\/(\d+)$/);
    if(removeNote&&method==="DELETE"){const index=annotations.findIndex(x=>x.id===Number(removeNote[1]));if(index>=0)annotations.splice(index,1);return empty();}
    return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({detail:"Unmocked Explore request: "+method+" "+path})});
  });
  page.on("console", message => { if(message.type()==="error") console.log("BROWSER CONSOLE:",message.text()); });
  page.on("pageerror", error => console.log("BROWSER PAGE ERROR:",error.message));
  await signIn(page);
  await page.getByRole("button",{name:"Explore"}).click();
  await expect(page.getByRole("heading",{name:/Make room for/})).toBeVisible();
  await page.locator(".atlas-upload-button input").setInputFiles({name:"paper.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.4")});
  await expect(page.getByText("Research paper",{exact:true})).toBeVisible();
  await expect(page.locator(".atlas-pdf-page").first()).toBeVisible({timeout:15000}).catch(async error => { const alerts=await page.locator(".atlas-explore-alert").allTextContents(); const states=await page.locator(".atlas-explore-state").allTextContents(); throw new Error(`PDF reader did not load. Alerts: ${alerts.join(" | ")}. States: ${states.join(" | ")}. ${error.message}`); });
  await expect.poll(async()=>page.locator(".atlas-pdf-canvas").first().evaluate((canvas)=>canvas.width)).toBeGreaterThan(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.locator('[data-page="3"]').scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Current page")).toHaveValue("3");
  await page.getByRole("button",{name:/Notes/}).click();
  await page.getByLabel("Your note").fill("Compare this result with the lecture discussion.");
  await page.getByRole("button",{name:"Save page note"}).click();
  await expect(page.getByText("Compare this result with the lecture discussion.")).toBeVisible();
  await page.locator('[data-page="3"] .atlas-pdf-text-layer span').first().evaluate((span)=>{const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);document.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));});
  await page.getByLabel("Your note").fill("This passage is worth highlighting.");
  await page.getByRole("button",{name:"Save highlight & note"}).click();
  await expect(page.locator(".atlas-pdf-highlight")).toHaveCount(1);
  await page.getByRole("button",{name:/Bookmark/}).click();
  await page.getByRole("button",{name:/Saved/}).click();
  await expect(page.locator(".atlas-reader-bookmark").filter({hasText:"Page 3"})).toBeVisible();
  await page.getByRole("button",{name:/Pages/}).click();
  await page.getByRole("button",{name:"Search"}).click();
  await page.getByPlaceholder("Search words or phrases in this PDF…").fill("searchable text");
  await page.getByRole("button",{name:"Find"}).click();
  await expect(page.locator(".atlas-pdf-search-results")).toContainText("Page 1");
  await page.getByRole("button",{name:"Library"}).click();
  await expect(page.getByText("Page 3 of 8")).toBeVisible();
});


test("Explore supports independent sessions with saved discoveries and questions", async ({ page }) => {
  installApiMock(page);
  const sessions = [];
  const items = [];
  let nextId = 501;
  await page.route("**/api/v1/explore/sessions**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const method = request.method();
    let body = {};
    if (method !== "GET" && method !== "DELETE") {
      try { body = request.postDataJSON?.() ?? {}; } catch { body = {}; }
    }
    const json = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    const created = data => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(data) });
    const empty = () => route.fulfill({ status: 204, body: "" });
    if (path === "/explore/sessions" && method === "GET") return json(sessions);
    if (path === "/explore/sessions" && method === "POST") {
      const session = { id: nextId++, title: body.title, central_question: body.central_question, notes: "", status: "active", item_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      sessions.unshift(session); return created(session);
    }
    const itemMatch = path.match(new RegExp("^/explore/sessions/(\\\\d+)/items(?:/(\\\\d+))?$"));
    const sessionMatch = path.match(new RegExp("^/explore/sessions/(\\\\d+)$"));
    if (itemMatch) {
      if (method === "POST") {
        const item = { id: nextId++, session_id: Number(itemMatch[1]), kind: body.kind, title: body.title, body: body.body || "", url: body.url || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        items.unshift(item); return created(item);
      }
      if (method === "DELETE") { const index = items.findIndex(item => item.id === Number(itemMatch[2])); if (index >= 0) items.splice(index, 1); return empty(); }
    }
    if (sessionMatch) {
      const session = sessions.find(item => item.id === Number(sessionMatch[1]));
      if (method === "GET") return json({ ...session, item_count: items.filter(item => item.session_id === session.id).length, items: items.filter(item => item.session_id === session.id) });
      if (method === "PATCH") { Object.assign(session, body); return json(session); }
      if (method === "DELETE") { sessions.splice(sessions.indexOf(session), 1); return empty(); }
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Unmocked exploration request: " + method + " " + path }) });
  });

  await signIn(page);
  await page.getByRole("button", { name: "Explore" }).click();
  await page.getByRole("button", { name: "Start an exploration" }).click();
  await page.getByLabel("Exploration title").fill("The science of memory");
  await page.getByLabel("What are you curious about?").fill("How does the brain turn experiences into memories?");
  await page.getByRole("button", { name: "Create exploration" }).click();
  await expect(page.getByRole("heading", { name: "The science of memory" })).toBeVisible();

  await page.getByLabel("Saved item type").selectOption("discovery");
  await page.getByLabel("Title").fill("Synaptic plasticity");
  await page.getByLabel("Notes").fill("Connections between neurons can strengthen or weaken.");
  await page.getByRole("button", { name: "Save to journal" }).click();
  await expect(page.getByText("Synaptic plasticity")).toBeVisible();

  await page.getByLabel("Saved item type").selectOption("question");
  await page.getByLabel("Title").fill("What causes forgetting?");
  await page.getByRole("button", { name: "Save to journal" }).click();
  await expect(page.getByText("What causes forgetting?")).toBeVisible();

  await page.getByLabel("Session notes").fill("Follow the link between consolidation and sleep.");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByLabel("Save notes")).toBeDisabled();
  await page.getByLabel("Status").selectOption("completed");
  await expect(page.locator(".atlas-discovery-status")).toContainText("Completed");
});
