const { test, expect } = require("@playwright/test");

function installApiMock(page) {
  const state = { subjects: [], topics: [], concepts: [], notes: {}, exams: [], progress: {}, reviews: [], versions: [] };
  let nextId = 1;

  page.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const body = method === "GET" || method === "DELETE" ? {} : request.postDataJSON?.() ?? {};
    const json = data => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    const created = data => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(data) });
    const empty = () => route.fulfill({ status: 204, body: "" });

    if (path === "/auth/login" || path === "/auth/register") return json({ access_token: "e2e-token" });
    if (path === "/subjects" && method === "GET") {
      const term = url.searchParams.get("term");
      return json(term ? state.subjects.filter(s => s.term === term) : state.subjects);
    }
    if (path === "/subjects" && method === "POST") {
      const subject = { id: nextId++, created_at: new Date().toISOString(), ...body };
      state.subjects.push(subject);
      return created(subject);
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
  page.on("response", response => {
    if (response.url().includes("exams")) console.log("E2E_EXAMS", response.request().method(), response.status(), response.url());
  });
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
  await expect(page.getByText("Overview exam",{exact:true})).toBeVisible();
  const examDayLabel = new Date(examDate).toLocaleDateString();
  await page.locator(".atlas-calendar-day[aria-label^='" + examDayLabel + "']").click();
  await page.getByLabel("Edit Overview exam").click();
  await page.getByLabel("Exam title").fill("Overview exam revised");
  await page.locator(".atlas-calendar-exam-edit").getByRole("button",{name:"Save"}).click();
  await expect(page.getByLabel("Delete Overview exam revised")).toBeVisible();
  await page.getByLabel("Delete Overview exam revised").click();
  await expect(page.getByLabel("Delete Overview exam revised")).toHaveCount(0);
});
