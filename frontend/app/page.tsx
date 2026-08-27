"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Job = {
  id: number;
  title: string;
  company: string;
  city: string | null;
  work_model: string | null;
  source: string | null;
  source_url: string | null;
  description: string | null;
  posted_at: string | null;
  match_score: number | null;
  ai_recommendation: string | null;
  ai_summary: string | null;
  matched_skills: string[];
  missing_skills: string[];
  ai_analyzed_at: string | null;
};

type Stats = {
  total_jobs: number;
  strong_apply: number;
  apply: number;
  maybe: number;
  skip: number;
  average_score: number;
  unanalyzed: number;
};

type DigestJob = {
  id: number;
  title: string;
  company: string;
  city: string | null;
  match_score: number;
  recommendation: string;
  source_url: string | null;
};

type DailyDigest = {
  id: number;
  digest_date: string;
  total_new_jobs: number;
  strong_apply_count: number;
  apply_count: number;
  maybe_count: number;
  top_jobs: DigestJob[];
  created_at: string;
};

type ApplicationStatus = "saved" | "ready_to_apply" | "applied" | "interview" | "rejected" | "offer" | "withdrawn";
type Application = {
  id: number; job_id: number; status: ApplicationStatus; applied_at: string | null;
  follow_up_at: string | null; notes: string | null; updated_at: string;
  job: Pick<Job, "id" | "title" | "company" | "city" | "match_score" | "source_url">;
};

type Filters = { search: string; city: string; recommendation: string; min_score: string; source: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const initialFilters: Filters = { search: "", city: "", recommendation: "", min_score: "", source: "" };

function label(value: string | null) {
  return value ? value.replaceAll("_", " ") : "unanalyzed";
}

function validListingUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeView, setActiveView] = useState<"jobs" | "applications">("jobs");
  const [applicationFilter, setApplicationFilter] = useState<"all" | ApplicationStatus>("all");
  const [savingJobId, setSavingJobId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  const applicationByJob = useMemo(() => new Map(applications.map((item) => [item.job_id, item])), [applications]);
  const visibleApplications = useMemo(() => applicationFilter === "all" ? applications : applications.filter((item) => item.status === applicationFilter), [applications, applicationFilter]);
  const visibleJobs = useMemo(() => jobs.filter((job) => !dismissedIds.has(job.id)), [jobs, dismissedIds]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ limit: "50" });
    Object.entries(appliedFilters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [appliedFilters]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [jobsResponse, statsResponse, digestResponse, applicationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/jobs?${queryString}`, { cache: "no-store" }),
        fetch(`${API_URL}/api/stats`, { cache: "no-store" }),
        fetch(`${API_URL}/api/digests/latest`, { cache: "no-store" }),
        fetch(`${API_URL}/api/applications`, { cache: "no-store" }),
      ]);
      if (!jobsResponse.ok || !statsResponse.ok || !applicationsResponse.ok) throw new Error("Backend unavailable");
      setJobs(await jobsResponse.json());
      setStats(await statsResponse.json());
      setApplications(await applicationsResponse.json());
      if (digestResponse.ok) {
        setDigest(await digestResponse.json());
      } else if (digestResponse.status === 404) {
        setDigest(null);
      } else {
        throw new Error("Digest unavailable");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    const stored = window.localStorage.getItem("jobhunter-dismissed-jobs");
    if (stored) {
      try { setDismissedIds(new Set(JSON.parse(stored) as number[])); }
      catch { window.localStorage.removeItem("jobhunter-dismissed-jobs"); }
    }
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    fetch(`${API_URL}/api/jobs/${selectedId}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setSelectedJob)
      .catch(() => setSelectedJob(null));
  }, [selectedId]);

  function submitFilters(event: FormEvent) {
    event.preventDefault();
    setAppliedFilters(filters);
  }

  function resetFilters() {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }

  async function setApplicationStatus(jobId: number, status: ApplicationStatus) {
    setSavingJobId(jobId);
    setActionError(null);
    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/application`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({status})});
      if (!response.ok) throw new Error("Could not save application");
      const application: Application = await response.json();
      setApplications((current) => [application, ...current.filter((item) => item.job_id !== jobId)]);
    } catch {
      setActionError("Application status could not be saved. Please try again.");
    } finally { setSavingJobId(null); }
  }

  function storeApplication(application: Application) {
    setApplications((current) => [application, ...current.filter((item) => item.job_id !== application.job_id)]);
  }

  function dismissJob(jobId: number) {
    setDismissedIds((current) => {
      const next = new Set(current).add(jobId);
      window.localStorage.setItem("jobhunter-dismissed-jobs", JSON.stringify([...next]));
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-ink text-slate-100">
      <header className="border-b border-white/10 px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-[1500px] flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">JobHunter AI</h1>
          <nav className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-5" aria-label="Main navigation">
            <button className={`view-tab ${activeView === "jobs" ? "active" : ""}`} onClick={() => setActiveView("jobs")}>Jobs</button>
            <button className={`view-tab ${activeView === "applications" ? "active" : ""}`} onClick={() => setActiveView("applications")}>Applications <span className="hidden sm:inline">· {applications.length}</span></button>
            <button className="header-action" onClick={() => setImportOpen(true)}>Import LinkedIn Job</button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-6 md:px-10 md:py-8">
        {actionError && <p className="mb-5 border-l-2 border-red-400 pl-3 text-sm text-red-200" role="alert">{actionError}</p>}
        <div className={activeView === "jobs" ? "block" : "hidden"}>
        <section className="grid grid-cols-2 border-y border-white/10 md:grid-cols-4" aria-label="Job statistics">
          {[
            ["Total Jobs", stats?.total_jobs ?? "—"],
            ["Strong Matches", stats?.strong_apply ?? "—"],
            ["Applications", applications.length],
            ["Average Score", stats?.average_score ?? "—"],
          ].map(([name, value]) => (
            <div key={name} className="border-white/10 px-3 py-5 odd:border-r md:border-r md:px-6 md:last:border-r-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{name}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="digest-section mt-6 border-b border-white/10 pb-5" aria-labelledby="digest-title">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint">Daily automation</p>
              <h2 id="digest-title" className="mt-1 text-lg font-semibold tracking-tight">Today&apos;s Job Digest</h2>
            </div>
            {digest && <p className="font-mono text-xs text-slate-500">{digest.digest_date}</p>}
          </div>

          {!loading && !digest ? (
            <p className="mt-6 text-sm text-slate-400">No daily digest generated yet.</p>
          ) : digest ? (
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(320px,.7fr)_1.4fr]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-2">
                {[
                  ["New jobs", digest.total_new_jobs],
                  ["Strong apply", digest.strong_apply_count],
                  ["Apply", digest.apply_count],
                  ["Maybe", digest.maybe_count],
                ].map(([name, value]) => (
                  <div key={name} className="border-l border-white/10 pl-4">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{name}</dt>
                    <dd className="mt-1 text-xl font-semibold text-white">{value}</dd>
                  </div>
                ))}
              </dl>
              <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">Top matches</h3>
                {digest.top_jobs.length ? (
                  <ol className="mt-2 divide-y divide-white/10">
                    {digest.top_jobs.map((job) => (
                      <li key={job.id} className="digest-row grid grid-cols-[44px_1fr_auto] items-center gap-3 py-3">
                        <span className="font-mono text-lg text-mint">{job.match_score}</span>
                        <span className="min-w-0"><strong className="block truncate text-sm font-medium text-white">{job.title}</strong><span className="text-xs text-slate-500">{job.company}</span></span>
                        {validListingUrl(job.source_url) && <a className="text-xs text-slate-400 hover:text-mint" href={validListingUrl(job.source_url)!} target="_blank" rel="noopener noreferrer" aria-label={`Open ${job.title}`}>Open ↗</a>}
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm text-slate-400">No ranked matches in this digest.</p>}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 overflow-hidden rounded-[2px] bg-paper text-slate-900 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
          <div className="border-b border-slate-200 px-5 py-5 md:px-7">
            <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">Jobs</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Ranked opportunities</h2>
              </div>
              <p className="text-sm text-slate-500">Skip recommendations are hidden by default.</p>
            </div>

            <form onSubmit={submitFilters} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
              <input aria-label="Search" placeholder="Search title or company" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
              <input aria-label="City" placeholder="City" value={filters.city} onChange={(e) => setFilters({...filters, city: e.target.value})} />
              <select aria-label="Source" value={filters.source} onChange={(e) => setFilters({...filters, source: e.target.value})}>
                <option value="">Source</option><option value="LinkedIn">LinkedIn</option><option value="Jooble">Jooble</option><option value="Remotive">Remotive</option>
              </select>
              <select aria-label="Minimum score" value={filters.min_score} onChange={(e) => setFilters({...filters, min_score: e.target.value})}>
                <option value="">Minimum score</option><option value="55">55+</option><option value="70">70+</option><option value="85">85+</option>
              </select>
              <select aria-label="Recommendation" value={filters.recommendation} onChange={(e) => setFilters({...filters, recommendation: e.target.value})}>
                <option value="">Recommendation</option><option value="strong_apply">Strong apply</option><option value="apply">Apply</option><option value="maybe">Maybe</option><option value="skip">Skip</option>
              </select>
              <div className="flex gap-2">
                <button className="bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700" type="submit">Filter</button>
                <button className="px-3 py-3 text-sm text-slate-500 hover:text-slate-900" type="button" onClick={resetFilters}>Reset</button>
              </div>
            </form>
          </div>

          <div className="min-h-[380px]">
            {loading && <Status message="Loading jobs..." />}
            {error && <Status message="Backend unavailable." action="Retry" onAction={loadDashboard} />}
            {!loading && !error && visibleJobs.length === 0 && <Status message="No matching jobs found." />}
            {!loading && !error && visibleJobs.map((job, index) => (
              <article key={job.id} className="job-row grid gap-4 border-b border-slate-200 px-5 py-5 last:border-b-0 md:grid-cols-[64px_minmax(0,1fr)_minmax(260px,auto)] md:items-center md:px-7" style={{animationDelay: `${index * 35}ms`}}>
                <div><p className="metric-label">Score</p><span className="font-mono text-2xl font-semibold text-slate-950">{job.match_score ?? "—"}</span></div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-950">{job.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{job.company}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-slate-500">{job.city ?? "Location unknown"} · {job.work_model ?? "Unknown"} · {job.source ?? "Unknown source"}</p>
                  {job.matched_skills.length > 0 && <p className="mt-2 text-xs text-teal-700">{job.matched_skills.slice(0,4).join(" · ")}{job.matched_skills.length > 4 ? ` · +${job.matched_skills.length-4}` : ""}</p>}
                  {applicationByJob.get(job.id) && <p className="application-current mt-2 text-left">Application: {label(applicationByJob.get(job.id)!.status)}</p>}
                </div>
                <div className="grid grid-cols-3 gap-2 md:min-w-[260px]">
                  <button className="action-primary" onClick={() => { setSelectedId(job.id); setSelectedJob(job); }}>View</button>
                  <button disabled={savingJobId === job.id || applicationByJob.get(job.id)?.status === "ready_to_apply"} className="quick-action" onClick={() => void setApplicationStatus(job.id,"ready_to_apply")}>{job.source === "LinkedIn" ? "Approve" : "Ready"}</button>
                  {!job.source_url ? <button className="action-secondary" disabled>Open Listing</button> : validListingUrl(job.source_url) ? <a className="action-secondary" href={validListingUrl(job.source_url)!} target="_blank" rel="noopener noreferrer">Open Listing</a> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
        </div>
        {activeView === "applications" && <ApplicationsView applications={visibleApplications} filter={applicationFilter} onFilter={setApplicationFilter} onOpen={(application) => { setSelectedId(application.job_id); setSelectedJob(null); }} />}
      </div>

      {selectedId !== null && <JobDetail job={selectedJob} application={applicationByJob.get(selectedId) ?? null} onSaved={storeApplication} onDismiss={() => { dismissJob(selectedId); setSelectedId(null); setSelectedJob(null); }} onClose={() => { setSelectedId(null); setSelectedJob(null); }} />}
      {importOpen && <LinkedInImport onClose={() => setImportOpen(false)} onImported={() => void loadDashboard()} />}
    </main>
  );
}

function Status({message, action, onAction}: {message: string; action?: string; onAction?: () => void}) {
  return <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 text-sm text-slate-500"><span>{message}</span>{action && <button className="action-primary" onClick={onAction}>{action}</button>}</div>;
}

function JobDetail({job, application, onSaved, onDismiss, onClose}: {job: Job | null; application: Application | null; onSaved: (value: Application) => void; onDismiss: () => void; onClose: () => void}) {
  const [status, setStatus] = useState<ApplicationStatus>(application?.status ?? "saved");
  const [notes, setNotes] = useState(application?.notes ?? "");
  const [followUp, setFollowUp] = useState(application?.follow_up_at?.slice(0, 10) ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setStatus(application?.status ?? "saved"); setNotes(application?.notes ?? ""); setFollowUp(application?.follow_up_at?.slice(0, 10) ?? "");
  }, [application]);

  async function saveTracking() {
    if (!job) return;
    setSaveState("saving");
    const response = await fetch(`${API_URL}/api/jobs/${job.id}/application`, {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({status, notes, follow_up_at: followUp ? `${followUp}T09:00:00+03:00` : null})});
    if (!response.ok) { setSaveState("error"); return; }
    onSaved(await response.json()); setSaveState("saved");
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <aside className="detail-panel ml-auto h-full w-full max-w-2xl overflow-y-auto bg-paper p-6 text-slate-900 shadow-2xl md:p-10" onMouseDown={(event) => event.stopPropagation()}>
        <button className="mb-8 font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-slate-950" onClick={onClose}>← Close</button>
        {!job ? <Status message="Loading job details..." /> : <>
          <DetailSection title="Overview">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">{job.source ?? "Job listing"}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h2>
            <p className="mt-2 text-lg text-slate-500">{job.company}</p>
            <p className="mt-4 font-mono text-xs text-slate-500">{job.city ?? "Location unknown"} · {job.work_model ?? "Unknown"}</p>
          </DetailSection>
          <DetailSection title="AI Match">
            <div className="flex items-end justify-between border-y border-slate-200 py-4"><div><p className="metric-label">Match score</p><p className="mt-1 text-4xl font-semibold">{job.match_score ?? "—"}</p></div><span className={`recommendation recommendation-${job.ai_recommendation ?? "unknown"}`}>{label(job.ai_recommendation)}</span></div>
            <p className="mt-4 leading-6 text-slate-600">{job.ai_summary ?? "No AI summary available."}</p>
          </DetailSection>
          <DetailSection title="Skills"><div className="grid gap-5 sm:grid-cols-2"><div><p className="metric-label mb-2">Matched</p><SkillList skills={job.matched_skills} empty="None recorded." /></div><div><p className="metric-label mb-2">Missing</p><SkillList skills={job.missing_skills} empty="None recorded." missing /></div></div></DetailSection>
          <DetailSection title="Application">
            <div className="tracking-form">
              <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)}>{statusOptions.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
              <label>Follow-up date<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
              <label className="md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interview notes, contact details, next steps…" /></label>
              <div className="flex items-center gap-3 md:col-span-2"><button className="action-primary" onClick={() => void saveTracking()} disabled={saveState === "saving"}>{saveState === "saving" ? "Saving…" : "Save tracking"}</button><span className="text-xs text-slate-500">{saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : ""}</span></div>
            </div>
          </DetailSection>
          <DetailSection title="Job Description"><p className="whitespace-pre-wrap leading-7 text-slate-600">{job.description ?? "No description available."}</p></DetailSection>
          <div className="mt-8 flex flex-wrap items-center gap-3">{validListingUrl(job.source_url) && <a className="action-primary inline-flex" href={validListingUrl(job.source_url)!} target="_blank" rel="noopener noreferrer">Open Listing ↗</a>}<button className="action-secondary" onClick={onDismiss}>Hide from list</button></div>
        </>}
      </aside>
    </div>
  );
}

const statusOptions: ApplicationStatus[] = ["saved", "ready_to_apply", "applied", "interview", "rejected", "offer", "withdrawn"];

function ApplicationsView({applications, filter, onFilter, onOpen}: {applications: Application[]; filter: "all" | ApplicationStatus; onFilter: (value: "all" | ApplicationStatus) => void; onOpen: (application: Application) => void}) {
  const filters: ("all" | ApplicationStatus)[] = ["all", "saved", "ready_to_apply", "applied", "interview", "rejected", "offer"];
  const due = (value: string | null) => Boolean(value && new Date(value).getTime() <= Date.now());
  return <section className="overflow-hidden rounded-[2px] bg-paper text-slate-900 shadow-[0_25px_80px_rgba(0,0,0,.25)]">
    <div className="border-b border-slate-200 px-5 py-6 md:px-7"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-teal-700">Application tracking</p><h2 className="mt-1 text-2xl font-semibold">Your application pipeline</h2><div className="mt-5 flex flex-wrap gap-2">{filters.map((value) => <button className={`filter-chip ${filter === value ? "active" : ""}`} onClick={() => onFilter(value)} key={value}>{label(value)}</button>)}</div></div>
    {applications.length === 0 ? <Status message="No applications in this view." /> : <div className="divide-y divide-slate-200">{applications.map((application,index) => <article className="application-row grid gap-4 px-5 py-5 md:grid-cols-[1.4fr_.7fr_.7fr_auto] md:items-center md:px-7" style={{animationDelay:`${index*40}ms`}} key={application.id}>
      <div><h3 className="font-semibold text-slate-950">{application.job.title}</h3><p className="mt-1 text-sm text-slate-500">{application.job.company} · {application.job.city ?? "Location unknown"}</p></div>
      <div><p className="metric-label">Status</p><span className={`application-status status-${application.status}`}>{label(application.status)}</span></div>
      <div className="text-sm"><p><span className="text-slate-500">Score</span> {application.job.match_score ?? "—"}</p><p className={due(application.follow_up_at) ? "follow-up-due" : "text-slate-500"}>{due(application.follow_up_at) ? "Follow-up due" : application.follow_up_at ? new Date(application.follow_up_at).toLocaleDateString() : "No follow-up"}</p></div>
      <button className="action-primary" onClick={() => onOpen(application)}>Edit</button>
    </article>)}</div>}
  </section>;
}

function LinkedInImport({onClose, onImported}: {onClose: () => void; onImported: () => void}) {
  const [form, setForm] = useState({source_url:"", title:"", company:"", city:"", work_model:"", description:""});
  const [state, setState] = useState<"idle"|"saving"|"created"|"existing"|"error">("idle");
  const update = (field: keyof typeof form, value: string) => setForm((current) => ({...current,[field]:value}));
  async function submit(event: FormEvent) {
    event.preventDefault(); setState("saving");
    const response = await fetch(`${API_URL}/api/jobs/import/linkedin`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    if (!response.ok) { setState("error"); return; }
    const result: {status:"created"|"existing";job_id:number} = await response.json();
    setState(result.status); onImported();
  }
  return <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={onClose}>
    <aside className="detail-panel ml-auto h-full w-full max-w-xl overflow-y-auto bg-paper p-6 text-slate-900 shadow-2xl md:p-10" onMouseDown={(event) => event.stopPropagation()}>
      <button className="mb-8 font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-slate-950" onClick={onClose}>← Close</button>
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-teal-700">Manual import</p><h2 className="mt-2 text-3xl font-semibold">Import LinkedIn Job</h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">Add a public listing for review. JobHunter never logs in to LinkedIn or submits an application.</p>
      <form className="tracking-form mt-8" onSubmit={(event) => void submit(event)}>
        <label className="md:col-span-2">LinkedIn Job URL<input required type="url" placeholder="https://www.linkedin.com/jobs/view/1234567890/" value={form.source_url} onChange={(event) => update("source_url",event.target.value)} /></label>
        <label>Title<input required value={form.title} onChange={(event) => update("title",event.target.value)} /></label><label>Company<input required value={form.company} onChange={(event) => update("company",event.target.value)} /></label>
        <label>City<input value={form.city} onChange={(event) => update("city",event.target.value)} /></label><label>Work Model<select value={form.work_model} onChange={(event) => update("work_model",event.target.value)}><option value="">Unknown</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label>
        <label className="md:col-span-2">Description (optional)<textarea value={form.description} onChange={(event) => update("description",event.target.value)} /></label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2"><button className="action-primary" disabled={state==="saving"}>{state==="saving"?"Adding…":"Add to JobHunter"}</button>{state==="created"&&<span className="text-sm text-teal-700">LinkedIn job added.</span>}{state==="existing"&&<span className="text-sm text-amber-700">This LinkedIn job is already in JobHunter.</span>}{state==="error"&&<span className="text-sm text-red-700">Check the LinkedIn job URL and required fields.</span>}</div>
      </form>
    </aside>
  </div>;
}

function DetailSection({title, children}: {title: string; children: React.ReactNode}) {
  return <section className="mt-8"><h3 className="metric-label mb-3">{title}</h3>{children}</section>;
}

function SkillList({skills, empty, missing = false}: {skills: string[]; empty: string; missing?: boolean}) {
  return skills.length ? <div className="flex flex-wrap gap-2">{skills.map((skill) => <span className={`skill ${missing ? "missing" : ""}`} key={skill}>{skill}</span>)}</div> : <p className="text-sm text-slate-500">{empty}</p>;
}
