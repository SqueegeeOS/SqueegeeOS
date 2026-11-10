// Local-only integration test. Use an existing PGlite installation, e.g.:
// PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/test-native-enrollment-revision.mjs
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.presentations(id uuid primary key,status text,agreement_id uuid);
create table public.signed_agreements(id uuid,presentation_id uuid,external_signature_provider text,external_envelope_id text,document_snapshot jsonb);
create table public.memberships(id uuid,presentation_id uuid);
create table public.enrollment_packets(id uuid primary key,presentation_id uuid,signature_provider text,status text,docusign_envelope_id text,signed_at timestamptz,signed_agreement_id uuid,membership_id uuid,public_token_sha256 text,public_token_expires_at timestamptz,payment_rail text,customer_name text,customer_email text,agreement_tier text,first_visit_price_cents integer,recurring_visit_price_cents integer,annualized_value_cents integer,sales_context text,home_solicitation_notice_days smallint,msa_version_id uuid,service_agreement_version_id uuid,document_snapshot jsonb,signature_sent_at timestamptz,last_error_code text,last_error_message text);
create table public.enrollment_packet_access_tokens(enrollment_packet_id uuid,token_sha256 text,revoked_at timestamptz,expires_at timestamptz);
create table public.enrollment_packet_events(enrollment_packet_id uuid,event_type text,actor text,provider text,provider_event_key text,event_data jsonb, unique(provider,provider_event_key));`);
await db.exec(fs.readFileSync('lib/persistence/supabase/migrations/20261110200806_safe_native_enrollment_revision.sql','utf8'));
const id='00000000-0000-4000-8000-000000000001', rid='00000000-0000-4000-8000-000000000002', old='a'.repeat(64), fresh='b'.repeat(64), historical='c'.repeat(64);
const values={signature_provider:'homeatlas_native',payment_rail:'stripe_card',public_token_sha256:fresh,public_token_expires_at:'2030-01-01',document_snapshot:{corrected:true},customer_name:'Test',customer_email:'test@example.com',agreement_tier:'biannual',first_visit_price_cents:71400,recurring_visit_price_cents:71400,annualized_value_cents:142800};
async function reset(){await db.exec('truncate enrollment_packets,enrollment_packet_access_tokens,enrollment_packet_events,signed_agreements,presentations,memberships');await db.query(`insert into enrollment_packets(id,presentation_id,signature_provider,status,public_token_sha256,public_token_expires_at,payment_rail,document_snapshot) values($1,$1,'homeatlas_native','signature_sent',$2,'2030-01-01','stripe_card','{"original":true}')`,[id,old]);await db.query("insert into enrollment_packet_access_tokens values($1,$2,null,'2030-01-01')",[id,historical]);}
const revise=()=>db.query('select public.revise_unsigned_native_enrollment($1,$2,$3,$4,$5,$6)',[id,old,rid,'Correct gutter scope','homeatlas_hq',values]);
const claim=(expected,token)=>db.query('select public.claim_native_enrollment_signature($1,$2,$3) as packet',[id,expected,token]);
await reset();await revise();assert.equal((await db.query('select status,document_snapshot,revision_id from enrollment_packets')).rows[0].status,'draft');assert.ok((await db.query('select revoked_at from enrollment_packet_access_tokens')).rows[0].revoked_at);assert.deepEqual((await db.query("select event_data->'priorPacket'->'document_snapshot' as snapshot from enrollment_packet_events")).rows[0].snapshot,{original:true});await assert.rejects(revise());
await db.exec("update enrollment_packets set status='signature_sent'");assert.equal((await claim(old,old)).rows[0].packet,null);assert.equal((await claim(fresh,historical)).rows[0].packet,null);assert.ok((await claim(fresh,fresh)).rows[0].packet);assert.equal((await claim(fresh,fresh)).rows[0].packet,null);
await reset();assert.ok((await claim(old,historical)).rows[0].packet);await assert.rejects(revise());
for(const patch of ["signed_at=now()","signed_agreement_id='00000000-0000-4000-8000-000000000003'","signature_provider='docusign'","status='needs_attention'"]){await reset();await db.exec('update enrollment_packets set '+patch);await assert.rejects(revise());}
await reset();await assert.rejects(()=>db.query('insert into signed_agreements(id,presentation_id) values($1,$1)',[id]));
for (const state of ['draft','voided']) { await reset(); await db.query('update enrollment_packets set status=$1',[state]); await db.query('insert into signed_agreements(id,presentation_id) values($1,$1)',[id]); }
await reset();await db.query('insert into memberships values($1,$1)',[id]);await assert.rejects(revise());
const insertNative=(snapshot)=>db.query("insert into signed_agreements values($1,$1,'homeatlas_native',$2,$3)",[id,id,snapshot]);
await reset();await insertNative({original:true});assert.ok((await db.query('select native_signature_started_at from enrollment_packets')).rows[0].native_signature_started_at);await assert.rejects(revise());
await reset();await revise();await db.exec("update enrollment_packets set status='signature_sent'");await assert.rejects(()=>insertNative({original:true}));await assert.rejects(()=>insertNative({corrected:true}));await claim(fresh,fresh);await assert.rejects(()=>insertNative({original:true}));await insertNative({corrected:true});
await reset();await db.exec('set role anon');await assert.rejects(revise());await assert.rejects(()=>claim(old,old));await db.exec('reset role');
console.log('PASS: atomic revision, snapshot audit, token revocation, stale/old-token claims, duplicate claim/revision, signing-first exclusion, signed/provider/status guards, anon privileges');await db.close();
