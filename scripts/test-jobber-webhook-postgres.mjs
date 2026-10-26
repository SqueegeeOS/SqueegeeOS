#!/usr/bin/env node
// Destructive only inside a fresh local /tmp PostgreSQL cluster. Never accepts a DB URL.
// Usage: node scripts/test-jobber-webhook-postgres.mjs /path/to/postgres/bin
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
const bin = process.argv[2];
if (!bin) throw new Error('Pass a local PostgreSQL bin directory; this test never connects to a remote database.');
const root = mkdtempSync(join(tmpdir(), 'homeatlas-webhook-test-'));
const port = await new Promise((done) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => done(p)); }); });
execFileSync(join(bin, 'initdb'), ['-D', join(root, 'data'), '-U', 'postgres', '-A', 'trust', '--no-locale'], { stdio: 'ignore' });
const server = spawn(join(bin, 'postgres'), ['-D', join(root, 'data'), '-h', '127.0.0.1', '-p', String(port), '-k', '', '-c', 'fsync=off'], { stdio: 'ignore' });
const clients = [];
const connect = async () => { const c = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' }); await c.connect(); clients.push(c); return c; };
let db;
try {
  for (let n = 0; n < 100; n++) { try { db = await connect(); break; } catch { await delay(30); } }
  assert.ok(db, 'local Postgres started');
  await db.query(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table public.jobber_connections(id text primary key, account_id text, status text);
    insert into public.jobber_connections values('squeegeeking','account-1','connected');
    create table public.jobber_webhook_events (
      event_key text primary key, account_id text, sync_scope text, status text,
      received_at timestamptz default now(), updated_at timestamptz default now(),
      processed_at timestamptz, error_code text, sync_summary jsonb
    );
    create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end;$$;
    create trigger updated_at before update on public.jobber_webhook_events for each row execute function public.set_updated_at();
    grant select on public.jobber_connections to service_role;
    grant select,insert,update on public.jobber_webhook_events to service_role;
  `);
  await db.query(readFileSync(resolve('lib/persistence/supabase/migrations/20261026063712_jobber_webhook_batch_recovery.sql'), 'utf8'));
  const owner1 = crypto.randomUUID(), owner2 = crypto.randomUUID();
  const add = (key, scope = 'visits', account = 'account-1') => db.query("insert into jobber_webhook_events(event_key,account_id,sync_scope,status) values($1,$2,$3,'received')", [key,account,scope]);
  const claim = async (client, owner, account = 'account-1') => (await client.query('select claim_jobber_webhook_batch($1,$2) result',[owner,account])).rows[0].result;
  const finish = async (owner, keys, error = null) => (await db.query('select finish_jobber_webhook_batch($1,$2,$3,$4) count',[owner,keys,error ? null : { observed: 4 },error])).rows[0].count;
  await add('one'); await add('two'); await add('client','clients'); await add('wrong-account','visits','other-account');
  const a = await connect(), b = await connect();
  await a.query('set role service_role'); await b.query('set role service_role');
  await a.query('begin');
  const first = await claim(a,owner1);
  assert.equal(first.acquired,true); assert.deepEqual(first.events.map(e=>e.event_key).sort(),['client','one','two']);
  let secondSettled = false;
  const pending = claim(b,owner2).finally(() => { secondSettled = true; });
  for (let n = 0; n < 100; n++) {
    const waits = await db.query("select count(*)::int count from pg_stat_activity where wait_event_type='Lock'");
    if (waits.rows[0].count) break;
    await delay(10);
  }
  assert.equal(secondSettled,false,'second worker waits for lease transaction');
  await a.query('commit');
  assert.equal((await pending).acquired,false,'one account-wide worker wins');
  assert.equal((await db.query("select status from jobber_webhook_events where event_key='wrong-account'")).rows[0].status,'ignored');
  await add('during-snapshot');
  await assert.rejects(finish(owner2,['one']),/lease lost/);
  assert.equal(await finish(owner1,['one','two','client']),3);
  assert.equal((await db.query("select status from jobber_webhook_events where event_key='during-snapshot'")).rows[0].status,'received','new arrivals not acknowledged by old snapshot');
  const next = await claim(db,owner1);
  assert.deepEqual(next.events.map(e=>e.event_key),['during-snapshot']);
  await finish(owner1,['during-snapshot'],'jobber_rate_limited');
  assert.equal((await claim(db,owner1)).events[0].event_key,'during-snapshot','failed event retryable');
  await finish(owner1,['during-snapshot']);
  assert.deepEqual((await claim(db,owner1)).events,[],'empty drain releases atomically');
  assert.equal((await db.query('select lease_id from jobber_webhook_sync_leases')).rows[0].lease_id,null);
  // Old deployment processing rows and a killed worker recover only after expiry.
  await add('stale'); await claim(db,owner1);
  await db.query("update jobber_webhook_sync_leases set expires_at=now()-interval '1 second'");
  await db.query('alter table jobber_webhook_events disable trigger updated_at');
  await db.query("update jobber_webhook_events set updated_at=now()-interval '331 seconds' where event_key='stale'");
  await db.query('alter table jobber_webhook_events enable trigger updated_at');
  assert.equal((await claim(db,owner2)).events[0].event_key,'stale');
  await assert.rejects(finish(owner1,['stale']),/lease lost/);
  // A finally block from the previous owner may not clear the replacement lease.
  await db.query("update jobber_webhook_sync_leases set lease_id=null,expires_at=null where connection_id='squeegeeking' and lease_id=$1",[owner1]);
  assert.equal((await db.query('select lease_id from jobber_webhook_sync_leases')).rows[0].lease_id,owner2);
  await finish(owner2,['stale']); await claim(db,owner2);
  await assert.rejects(claim(db,owner1,'other-account'),/Connected Jobber account required/);
  for (const role of ['anon','authenticated']) {
    const rights = (await db.query(`select has_function_privilege($1,'claim_jobber_webhook_batch(uuid,text)','EXECUTE') claim,
      has_function_privilege($1,'finish_jobber_webhook_batch(uuid,text[],jsonb,text)','EXECUTE') finish,
      has_table_privilege($1,'jobber_webhook_sync_leases','SELECT,INSERT,UPDATE') table_access`,[role])).rows[0];
    assert.deepEqual(rights,{claim:false,finish:false,table_access:false});
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.jobber_webhook_sync_leases'::regclass")).rows[0].relrowsecurity,true);
  console.log('PASS: real PostgreSQL two-session lease contention, service-role execution, exact batch acknowledgement, follow-on arrival drain, failed/stale recovery, account isolation, stale-owner fencing/release, RLS and private privileges.');
} finally {
  await Promise.all(clients.map(c => c.end().catch(() => {})));
  server.kill('SIGTERM'); await new Promise(done => server.once('exit',done));
  rmSync(root,{recursive:true,force:true});
}
