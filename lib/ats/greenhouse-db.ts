import "server-only";
import path from "path";
import Database from "better-sqlite3";
import {
  SEED_DEPARTMENTS,
  SEED_JOBS,
  SEED_JOB_STAGES,
  SEED_CANDIDATES,
  SEED_APPLICATIONS,
  SEED_SCORECARDS,
  SEED_OFFERS,
} from "./dev/seed-data";

let _db: Database.Database | null = null;

export function getDevDb(): Database.Database {
  if (_db) return _db;

  const dbPath = path.resolve(process.cwd(), ".greenhouse-dev.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");

  initSchema(_db);
  seedIfEmpty(_db);

  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gh_departments (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      parent_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS gh_jobs (
      id            INTEGER PRIMARY KEY,
      name          TEXT NOT NULL,
      status        TEXT NOT NULL CHECK (status IN ('open','closed','draft')),
      department_id INTEGER REFERENCES gh_departments(id)
    );

    CREATE TABLE IF NOT EXISTS gh_job_stages (
      id     INTEGER PRIMARY KEY,
      job_id INTEGER NOT NULL REFERENCES gh_jobs(id),
      name   TEXT NOT NULL,
      "order" INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gh_candidates (
      id         INTEGER PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT,
      tags       TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS gh_applications (
      id           INTEGER PRIMARY KEY,
      candidate_id INTEGER NOT NULL REFERENCES gh_candidates(id),
      job_id       INTEGER NOT NULL REFERENCES gh_jobs(id),
      stage_id     INTEGER REFERENCES gh_job_stages(id),
      status       TEXT NOT NULL DEFAULT 'active',
      applied_at   TEXT
    );

    CREATE TABLE IF NOT EXISTS gh_scorecards (
      id               INTEGER PRIMARY KEY,
      application_id   INTEGER NOT NULL REFERENCES gh_applications(id),
      interviewer_name TEXT NOT NULL,
      submitted_at     TEXT,
      recommendation   TEXT,
      attributes       TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS gh_offers (
      id                INTEGER PRIMARY KEY,
      application_id    INTEGER NOT NULL REFERENCES gh_applications(id),
      status            TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      offer_letter_name TEXT
    );
  `);
}

function seedIfEmpty(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as c FROM gh_jobs").get() as { c: number }).c;
  if (count > 0) return;

  const insertDept = db.prepare("INSERT INTO gh_departments (id, name, parent_id) VALUES (?, ?, ?)");
  const insertJob = db.prepare("INSERT INTO gh_jobs (id, name, status, department_id) VALUES (?, ?, ?, ?)");
  const insertStage = db.prepare('INSERT INTO gh_job_stages (id, job_id, name, "order") VALUES (?, ?, ?, ?)');
  const insertCandidate = db.prepare("INSERT INTO gh_candidates (id, first_name, last_name, email, tags) VALUES (?, ?, ?, ?, ?)");
  const insertApp = db.prepare("INSERT INTO gh_applications (id, candidate_id, job_id, stage_id, status, applied_at) VALUES (?, ?, ?, ?, ?, ?)");
  const insertScorecard = db.prepare("INSERT INTO gh_scorecards (id, application_id, interviewer_name, submitted_at, recommendation, attributes) VALUES (?, ?, ?, ?, ?, ?)");
  const insertOffer = db.prepare("INSERT INTO gh_offers (id, application_id, status, created_at, offer_letter_name) VALUES (?, ?, ?, ?, ?)");

  const seedAll = db.transaction(() => {
    for (const d of SEED_DEPARTMENTS) insertDept.run(d.id, d.name, d.parent_id ?? null);
    for (const j of SEED_JOBS) insertJob.run(j.id, j.name, j.status, j.department_id);
    for (const s of SEED_JOB_STAGES) insertStage.run(s.id, s.job_id, s.name, s.order);
    for (const c of SEED_CANDIDATES) insertCandidate.run(c.id, c.first_name, c.last_name, c.email, c.tags);
    for (const a of SEED_APPLICATIONS) insertApp.run(a.id, a.candidate_id, a.job_id, a.stage_id, a.status, a.applied_at);
    for (const sc of SEED_SCORECARDS) insertScorecard.run(sc.id, sc.application_id, sc.interviewer_name, sc.submitted_at ?? null, sc.recommendation ?? null, sc.attributes);
    for (const o of SEED_OFFERS) insertOffer.run(o.id, o.application_id, o.status, o.created_at, o.offer_letter_name ?? null);
  });

  seedAll();
}
