import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// One runner, real binaries, fresh directories, no simulated proof results.
const runtime = typeof Bun === 'undefined' ? 'node' : 'bun';
const root = resolve(process.env.TLAPS_ROOT ?? '.tools/tlapm');
const cli = resolve('node_modules/tla-ts/dist/cli.js');
mkdirSync('evidence', { recursive: true });
const out = mkdtempSync(resolve('evidence', `${runtime}-`));
const results = [];
writeFileSync(join(out, 'results.jsonl'), '');
const env = { ...process.env, PATH: `${root}/bin:/usr/bin:/bin`, TLAPM_SMT_SOLVER: undefined };
const sha = text => createHash('sha256').update(text).digest('hex');
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(e => {
    const p = join(path, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk(root);
const binaries = Object.fromEntries(['tlapm', 'z3', 'zenon', 'ls4', 'ptl_to_trp', 'poly'].map(name => [name, files.filter(p => basename(p) === name)]));
const heap = files.filter(p => p.endsWith('/Isabelle-install/heaps/TLA+'));
const noExternal = [...Object.values(binaries).flat(), ...heap];
writeFileSync(join(out, 'environment.json'), JSON.stringify({ runtime, version: process.version, bun: globalThis.Bun?.version, platform: process.platform, arch: process.arch, commit: process.env.GITHUB_SHA, root, binaries, heap }, null, 2));
const moduleText = (name, body) => `---- MODULE ${name} ----\n${body}\n====\n`;
const proofs = [
  { id: 'z3', method: 'Z3T(3)', imports: 'Integers, TLAPS', theorem: '\\A n \\in Int : n < n + 1', falseTheorem: 'FALSE', exec: 'z3' },
  { id: 'zenon', method: 'ZenonT(3)', imports: 'TLAPS', declarations: 'CONSTANT S, P(_), x', theorem: 'ASSUME x \\in S, \\A y \\in S : P(y) PROVE P(x)', falseTheorem: 'ASSUME x \\in S, \\A y \\in S : P(y) PROVE ~P(x)', exec: 'zenon' },
  { id: 'isabelle', method: 'IsaT(3)', imports: 'TLAPS', theorem: '\\A A, B : (A \\cap B) \\subseteq A', falseTheorem: '\\A A, B : A \\subseteq (A \\cap B)', exec: 'poly' },
  { id: 'ls4', method: 'PTL', imports: 'TLAPS', declarations: 'VARIABLES p, q, r', theorem: '((p ~> q) /\\ (q ~> r)) => (p ~> r)', falseTheorem: '(p ~> q) => (q ~> p)', exec: 'ls4' },
];
function source(p, broken = false) {
  return moduleText('Proof', `EXTENDS ${p.imports}\n${p.declarations ?? ''}\nTHEOREM ${broken ? p.falseTheorem : p.theorem}\n  BY ${p.method}`);
}
function record(id, data, ok) {
  const row = { runtime, id, ...data, ok };
  results.push(row);
  appendFileSync(join(out, 'results.jsonl'), JSON.stringify(row) + '\n');
  console.log(JSON.stringify(row));
}
function execute(id, text, args, config, missing = []) {
  const dir = join(out, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'Proof.tla'), text);
  if (config) writeFileSync(join(dir, 'Proof.cfg'), config);
  const paths = [...new Set(missing)];
  if (paths.length === 0 && id.includes('absent')) throw new Error(`No dependency located for ${id}`);
  const moved = [];
  let run;
  try {
    for (const path of paths) { renameSync(path, `${path}.absent`); moved.push(path); }
    run = spawnSync('/usr/bin/timeout', ['-k', '2s', '45s', '/usr/bin/strace', '-f', '-e', 'trace=execve', '-s', '4096', '-o', join(dir, 'exec.log'), process.execPath, cli, ...args, 'Proof.tla'], { cwd: dir, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 50000 });
  } finally {
    for (const path of moved.reverse()) renameSync(`${path}.absent`, path);
  }
  const log = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  writeFileSync(join(dir, 'stdout.log'), run.stdout ?? '');
  writeFileSync(join(dir, 'stderr.log'), run.stderr ?? '');
  const trace = readFileSync(join(dir, 'exec.log'), 'utf8');
  const execs = [...new Set([...trace.matchAll(/execve\("([^"]+)".*= 0/g)].map(m => basename(m[1])))];
  const proved = Number(log.match(/All (\d+) obligations proved/)?.[1] ?? 0);
  const failed = /@!!status:failed|\b\d+ obligations failed\b/.test(log);
  const timedOut = run.error !== undefined || run.signal !== null || [124, 137].includes(run.status) || /@!!(?:reason|status):[^\r\n]*(?:timeout|timed out)|exceeded.*time/i.test(log);
  return { log, trace, execs, proved, failed, timedOut, exit: run.status, removed: paths.map(p => p.slice(root.length + 1)), sourceSha256: sha(text), configSha256: config ? sha(config) : null, args, logSha256: sha(log), error: run.error?.message ?? null };
}
function check(id, text, args, predicate, config, missing) {
  const r = execute(id, text, args, config, missing);
  const { log, trace, ...data } = r;
  const ok = !r.timedOut && predicate(r);
  record(id, data, ok);
  if (!ok || id.endsWith('-false') || id.endsWith('-zenon-absent') || id === 'isabelle-heap-absent') console.log(`::group::${id} raw output\n${r.log}\n::endgroup::`);
}
const model = moduleText('Proof', 'EXTENDS Naturals\nVARIABLE x\nInit == x = 0\nNext == x < 3 /\\ x\' = x + 1\nSafe == x <= 3\nBad == x < 3');
const config = invariant => `INIT Init\nNEXT Next\nINVARIANT ${invariant}\nCHECK_DEADLOCK FALSE\n`;
const noProver = r => !r.execs.some(x => ['tlapm', 'z3', 'zenon', 'poly', 'java', 'ls4', 'ptl_to_trp'].includes(x));
check('model-good', model, [], r => r.exit === 0 && /4 distinct states/.test(r.log) && noProver(r), config('Safe'), noExternal);
check('model-bad', model, [], r => r.exit === 12 && /Invariant Bad is violated/.test(r.log) && /x = 3/.test(r.log) && noProver(r), config('Bad'), noExternal);
const obligation = moduleText('Proof', 'THEOREM \\A p, q : (p /\\ q) => p\nOBVIOUS');
check('obligations-only', obligation, ['prove', '-N', '--toolbox', '0', '0', '--printallobs'], r => r.exit === 0 && /@!!status:to be proved/.test(r.log) && /@!!count:[1-9]/.test(r.log) && noProver(r), undefined, noExternal);
check('tlapm-absent', source(proofs[0]), ['prove'], r => r.exit === 1 && /tlapm isn't on your PATH/.test(r.log), undefined, binaries.tlapm);
const proofArgs = ['prove', '--strict', '--cleanfp', '--toolbox', '0', '0', '--threads', '1'];
for (const p of proofs) {
  check(`${p.id}-present`, source(p), proofArgs, r => r.exit === 0 && r.proved > 0 && r.execs.includes(p.exec) && r.execs.includes('tlapm'));
  check(`${p.id}-absent`, source(p), proofArgs, r => r.exit !== 0 && r.proved === 0 && /not found|No such file|cannot find|cannot execute/i.test(r.log), undefined, binaries[p.exec]);
  check(`${p.id}-false`, source(p, true), proofArgs, r => r.exit !== 0 && r.proved === 0 && r.failed && r.execs.includes(p.exec));
  const unneeded = ['z3', 'poly', 'ls4', 'ptl_to_trp'].filter(n => n !== p.exec && !(p.id === 'ls4' && n === 'ptl_to_trp')).flatMap(n => binaries[n]);
  check(`${p.id}-minimal`, source(p), proofArgs, r => r.exit === 0 && r.proved > 0 && r.execs.includes(p.exec), undefined, unneeded);
  if (p.id !== 'zenon') check(`${p.id}-zenon-absent`, source(p), proofArgs, r => r.exit !== 0 && r.proved === 0 && /zenon.*not found/i.test(r.log), undefined, binaries.zenon);
}
check('translator-absent', source(proofs[3]), proofArgs, r => r.exit !== 0 && r.proved === 0 && /not found|No such file/i.test(r.log), undefined, binaries.ptl_to_trp);
check('isabelle-heap-absent', source(proofs[2]), proofArgs, r => r.exit !== 0 && r.proved === 0 && r.failed && r.execs.includes('poly'), undefined, heap);
const failed = results.filter(r => !r.ok);
console.log(`SUMMARY ${runtime}: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.error('Failed checks:', failed.map(r => r.id).join(', '));
process.exitCode = failed.length ? 1 : 0;
