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

  const applicationByJob = useMemo(() => new Map(applications.map((item) => [item.job_id, item])), [applications]);
  const visibleApplications = useMemo(() => applicationFilter === "all" ? applications : applications.filter((item) => item.status === applicationFilter), [applications, applicationFilter]);

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

  return (
    <main className="min-h-screen bg-ink text-slate-100">
      <header className="border-b border-white/10 px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-mint">Talent intelligence workspace</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">JobHunter AI</h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mint" /> System ready
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-5 py-7 md:px-10 md:py-10">
        <nav className="mb-7 flex gap-7 border-b border-white/10" aria-label="Dashboard views">
          <button className={`view-tab ${activeView === "jobs" ? "active" : ""}`} onClick={() => setActiveView("jobs")}>Jobs</button>
          <button className={`view-tab ${activeView === "applications" ? "active" : ""}`} onClick={() => setActiveView("applications")}>Applications · {applications.length}</button>
        </nav>
        {actionError && <p className="mb-5 border-l-2 border-red-400 pl-3 text-sm text-red-200" role="alert">{actionError}</p>}
        <div className={activeView === "jobs" ? "block" : "hidden"}>
        <section className="grid grid-cols-2 border-y border-white/10 md:grid-cols-4" aria-label="Job statistics">
          {[
            ["Total jobs", stats?.total_jobs ?? "—"],
            ["Strong apply", stats?.strong_apply ?? "—"],
            ["Apply", stats?.apply ?? "—"],
            ["Average score", stats?.average_score ?? "—"],
          ].map(([name, value]) => (
            <div key={name} className="border-white/10 px-3 py-5 odd:border-r md:border-r md:px-6 md:last:border-r-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{name}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
            </div>
          ))}
        </section>

        <section className="digest-section mt-8 border-y border-white/10 py-7" aria-labelledby="digest-title">
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint">Daily automation</p>
              <h2 id="digest-title" className="mt-1 text-2xl font-semibold tracking-tight">Today&apos;s Job Digest</h2>
            </div>
            {digest && <p className="font-mono text-xs text-slate-500">{digest.digest_date}</p>}
          </div>

          {!loading && !digest ? (
            <p className="mt-6 text-sm text-slate-400">No daily digest generated yet.</p>
          ) : digest ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(360px,.8fr)_1.4fr]">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-2">
                {[
                  ["New jobs", digest.total_new_jobs],
                  ["Strong apply", digest.strong_apply_count],
                  ["Apply", digest.apply_count],
                  ["Maybe", digest.maybe_count],
                ].map(([name, value]) => (
                  <div key={name} className="border-l border-white/10 pl-4">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{name}</dt>
                    <dd className="mt-1 text-2xl font-semibold text-white">{value}</dd>
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
                        {job.source_url && <a className="text-xs text-slate-400 hover:text-mint" href={job.source_url} target="_blank" rel="noreferrer" aria-label={`Open ${job.title}`}>Open ↗</a>}
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-3 text-sm text-slate-400">No ranked matches in this digest.</p>}
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 overflow-hidden rounded-[2px] bg-paper text-slate-900 shadow-[0_25px_80px_rgba(0,0,0,0.25)]">
          <div className="border-b border-slate-200 px-5 py-5 md:px-7">
            <div className="flex flex-col justify-between gap-2 md:flex-row md:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">Ranked opportunities</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Jobs worth your attention</h2>
              </div>
              <p className="text-sm text-slate-500">Skip recommendations are hidden by default.</p>
            </div>

            <form onSubmit={submitFilters} className="mt-6 grid gap-3 md:grid-cols-[1.5fr_repeat(4,1fr)_auto]">
              <input aria-label="Search" placeholder="Search title or company" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} />
              <input aria-label="City" placeholder="City" value={filters.city} onChange={(e) => setFilters({...filters, city: e.target.value})} />
              <select aria-label="Recommendation" value={filters.recommendation} onChange={(e) => setFilters({...filters, recommendation: e.target.value})}>
                <option value="">Recommendation</option><option value="strong_apply">Strong apply</option><option value="apply">Apply</option><option value="maybe">Maybe</option><option value="skip">Skip</option>
              </select>
              <select aria-label="Minimum score" value={filters.min_score} onChange={(e) => setFilters({...filters, min_score: e.target.value})}>
                <option value="">Minimum score</option><option value="55">55+</option><option value="70">70+</option><option value="85">85+</option>
              </select>
              <select aria-label="Source" value={filters.source} onChange={(e) => setFilters({...filters, source: e.target.value})}>
                <option value="">Source</option><option value="Jooble">Jooble</option><option value="Remotive">Remotive</option>
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
            {!loading && !error && jobs.length === 0 && <Status message="No matching jobs found." />}
            {!loading && !error && jobs.map((job, index) => (
              <article key={job.id} className="job-row grid gap-4 border-b border-slate-200 px-5 py-6 last:border-b-0 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,.8fr)_150px] md:px-7" style={{animationDelay: `${index * 45}ms`}}>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-slate-950">{job.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">{job.company}</p>
                    </div>
                    <span className="font-mono text-2xl font-medium text-slate-950">{job.match_score ?? "—"}</span>
                  </div>
                  <p className="mt-3 font-mono text-[11px] uppercase tracking-wide text-slate-500">{job.city ?? "Location unknown"} · {job.work_model ?? "Unknown"} · {job.source ?? "Unknown source"}</p>
                </div>
                <div>
                  <span className={`recommendation recommendation-${job.ai_recommendation ?? "unknown"}`}>{label(job.ai_recommendation)}</span>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {job.matched_skills.slice(0, 4).map((skill) => <span className="skill" key={skill}>{skill}</span>)}
                    {job.missing_skills.length > 0 && <span className="skill missing">{job.missing_skills.length} missing</span>}
                  </div>
                </div>
                <div className="flex items-end gap-3 md:flex-col md:items-stretch md:justify-center">
                  <button className="action-primary" onClick={() => { setSelectedId(job.id); setSelectedJob(job); }}>View job</button>
                  <div className="grid grid-cols-3 gap-1" aria-label={`Track ${job.title}`}>
                    {([['saved','Save'],['ready_to_apply','Ready'],['applied','Applied']] as [ApplicationStatus,string][]).map(([status,text]) => <button disabled={savingJobId === job.id} className={`quick-action ${applicationByJob.get(job.id)?.status === status ? "active" : ""}`} key={status} onClick={() => void setApplicationStatus(job.id,status)}>{text}</button>)}
                  </div>
                  {applicationByJob.get(job.id) && <p className="application-current">Application: {label(applicationByJob.get(job.id)!.status)}</p>}
                  {job.source_url && <a className="action-secondary" href={job.source_url} target="_blank" rel="noreferrer">Open listing ↗</a>}
                </div>
              </article>
            ))}
          </div>
        </section>
        </div>
        {activeView === "applications" && <ApplicationsView applications={visibleApplications} filter={applicationFilter} onFilter={setApplicationFilter} onOpen={(application) => { setSelectedId(application.job_id); setSelectedJob(null); }} />}
      </div>

      {selectedId !== null && <JobDetail job={selectedJob} application={applicationByJob.get(selectedId) ?? null} onSaved={storeApplication} onClose={() => { setSelectedId(null); setSelectedJob(null); }} />}
    </main>
  );
}

function Status({message, action, onAction}: {message: string; action?: string; onAction?: () => void}) {
  return <div className="flex min-h-[380px] flex-col items-center justify-center gap-4 text-sm text-slate-500"><span>{message}</span>{action && <button className="action-primary" onClick={onAction}>{action}</button>}</div>;
}

function JobDetail({job, application, onSaved, onClose}: {job: Job | null; application: Application | null; onSaved: (value: Application) => void; onClose: () => void}) {
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
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-teal-700">{job.source ?? "Job listing"}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{job.title}</h2>
          <p className="mt-2 text-lg text-slate-500">{job.company}</p>
          <p className="mt-5 font-mono text-xs text-slate-500">{job.city ?? "Location unknown"} · {job.work_model ?? "Unknown"}</p>

          <div className="my-8 flex items-end justify-between border-y border-slate-200 py-5">
            <div><p className="metric-label">Match score</p><p className="mt-1 text-4xl font-semibold">{job.match_score ?? "—"}</p></div>
            <span className={`recommendation recommendation-${job.ai_recommendation ?? "unknown"}`}>{label(job.ai_recommendation)}</span>
          </div>

          <DetailSection title="AI summary"><p>{job.ai_summary ?? "No AI summary available."}</p></DetailSection>
          <DetailSection title="Matched skills"><SkillList skills={job.matched_skills} empty="No matched skills recorded." /></DetailSection>
          <DetailSection title="Missing skills"><SkillList skills={job.missing_skills} empty="No missing skills recorded." missing /></DetailSection>
          <DetailSection title="Application tracking">
            <div className="tracking-form">
              <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as ApplicationStatus)}>{statusOptions.map((value) => <option value={value} key={value}>{label(value)}</option>)}</select></label>
              <label>Follow-up date<input type="date" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></label>
              <label className="md:col-span-2">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Interview notes, contact details, next steps…" /></label>
              <div className="flex items-center gap-3 md:col-span-2"><button className="action-primary" onClick={() => void saveTracking()} disabled={saveState === "saving"}>{saveState === "saving" ? "Saving…" : "Save tracking"}</button><span className="text-xs text-slate-500">{saveState === "saved" ? "Saved" : saveState === "error" ? "Could not save" : ""}</span></div>
            </div>
          </DetailSection>
          <DetailSection title="Job description"><p className="whitespace-pre-wrap leading-7 text-slate-600">{job.description ?? "No description available."}</p></DetailSection>
          {job.source_url && <a className="action-primary mt-8 inline-flex" href={job.source_url} target="_blank" rel="noreferrer">Open original listing ↗</a>}
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

function DetailSection({title, children}: {title: string; children: React.ReactNode}) {
  return <section className="mt-8"><h3 className="metric-label mb-3">{title}</h3>{children}</section>;
}

function SkillList({skills, empty, missing = false}: {skills: string[]; empty: string; missing?: boolean}) {
  return skills.length ? <div className="flex flex-wrap gap-2">{skills.map((skill) => <span className={`skill ${missing ? "missing" : ""}`} key={skill}>{skill}</span>)}</div> : <p className="text-sm text-slate-500">{empty}</p>;
}
