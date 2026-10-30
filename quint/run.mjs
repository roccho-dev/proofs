import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, join, resolve } from 'node:path';

const runtime = typeof Bun === 'undefined' ? 'node' : 'bun';
const cwd = resolve('quint');
const cli = join(cwd, 'node_modules/@informalsystems/quint/dist/src/cli.js');
const output = mkdtempSync(join(cwd, 'evidence', runtime + '-'));
const toolDir = join(cwd, '.tools');
mkdirSync(toolDir, { recursive: true });
const home = mkdtempSync(join(toolDir, 'quint-' + runtime + '-'));
const env = { ...process.env, QUINT_HOME: home, CI: 'true' };
const results = [];
const hash = s => createHash('sha256').update(s).digest('hex');
const sourceHash = hash(readFileSync(join(cwd, 'Counter.qnt')));
writeFileSync(join(output, 'versions.json'), JSON.stringify({ runtime, node: process.version, bun: globalThis.Bun?.version, quint: '0.33.1', apalache: '0.62.4', evaluator: 'v0.7.1', sourceHash }, null, 2));

function run(id, args, overrides = {}) {
  const dir = join(output, id);
  mkdirSync(dir);
  const tracePath = join(dir, 'exec.log');
  const child = spawnSync('/usr/bin/timeout', ['-k', '3s', '150s', '/usr/bin/strace', '-f', '-e', 'trace=execve', '-s', '1024', '-o', tracePath, process.execPath, cli, ...args, 'Counter.qnt'], {
    cwd, env: { ...env, ...overrides }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 155000,
  });
  const stdout = child.stdout ?? '', stderr = child.stderr ?? '', log = stdout + '\n' + stderr;
  writeFileSync(join(dir, 'stdout.log'), stdout);
  writeFileSync(join(dir, 'stderr.log'), stderr);
  const trace = existsSync(tracePath) ? readFileSync(tracePath, 'utf8') : '';
  const execs = [...new Set([...trace.matchAll(/execve\("([^"]+)".*\) = 0/g)].map(m => basename(m[1])))];
  const timedOut = !!child.error || !!child.signal || [124, 137].includes(child.status) || /timed out|timeout exceeded/i.test(log);
  return { exit: child.status, execs, timedOut, log, trace, args, sourceHash, logSha256: hash(log), traceSha256: hash(trace), error: child.error?.message };
}
function check(id, args, accept, options = {}) {
  try {
    const r = run(id, args, options.env);
    const ok = !r.timedOut && accept(r);
    const { log, trace, ...proof } = r;
    const row = { id, runtime, ...proof, ok };
    appendFileSync(join(output, 'results.jsonl'), JSON.stringify(row) + '\n');
    console.log(JSON.stringify(row));
    if (!ok) console.log('::group::' + id + ' diagnostic\n' + log.slice(-8000) + '\n::endgroup::');
    results.push(row);
    return r;
  } catch (error) {
    const row = { id, runtime, ok: false, error: String(error) };
    appendFileSync(join(output, 'results.jsonl'), JSON.stringify(row) + '\n');
    console.log(JSON.stringify(row));
    results.push(row);
    return { exit: null, execs: [], timedOut: true, log: String(error) };
  }
}
function withoutExecutable(id, path, args, accept) {
  if (!existsSync(path)) return check(id, args, () => false);
  const original = statSync(path).mode & 0o777;
  chmodSync(path, 0o644);
  try { return check(id, args, accept); }
  finally { chmodSync(path, original); }
}
const noExternal = r => !r.execs.some(x => ['java', 'quint_evaluator', 'apalache-mc', 'z3'].includes(x));
const test = ['test', '--backend=typescript', '--max-samples=1', '--seed=1'];
const rust = ['test', '--backend=rust', '--max-samples=1', '--seed=1'];
const verify = (backend, inv, port) => ['verify', '--backend=' + backend, '--apalache-version=0.62.4', '--server-endpoint=127.0.0.1:' + port, '--max-steps=4', '--invariant=' + inv, '--verbosity=3'];

check('typecheck', ['typecheck'], r => r.exit === 0 && noExternal(r));
check('ts-test-pass', [...test, '--match=passingTest'], r => r.exit === 0 && /1 passing/.test(r.log) && noExternal(r));
check('ts-test-fail', [...test, '--match=failingTest'], r => r.exit !== 0 && /1 failed/.test(r.log) && noExternal(r));
check('ts-run-pass', ['run', '--backend=typescript', '--seed=1', '--max-samples=1', '--max-steps=4', '--invariant=safe'], r => r.exit === 0 && /\[ok\]/.test(r.log) && noExternal(r));
check('ts-run-violation', ['run', '--backend=typescript', '--seed=1', '--max-samples=1', '--max-steps=4', '--invariant=bad'], r => r.exit !== 0 && /violation|Invariant violated/i.test(r.log) && noExternal(r));

check('rust-test-pass', [...rust, '--match=passingTest'], r => r.exit === 0 && /1 passing/.test(r.log) && r.execs.includes('quint_evaluator') && !r.execs.includes('java'));
const rustBinary = join(home, 'rust-evaluator-v0.7.1/quint_evaluator');
withoutExecutable('rust-evaluator-disabled', rustBinary, [...rust, '--match=passingTest'], r => r.exit !== 0 && /Failed to launch Rust evaluator|EACCES|permission denied/i.test(r.log) && !r.execs.includes('quint_evaluator'));

const goodA = check('apalache-pass', verify('apalache', 'safe', 8840), r => r.exit === 0 && /\[ok\]/.test(r.log) && r.execs.includes('java') && r.execs.includes('apalache-mc'));
const launcher = join(home, 'apalache-dist-0.62.4/apalache/bin/apalache-mc');
if (goodA.exit === 0) {
  withoutExecutable('apalache-launcher-disabled', launcher, verify('apalache', 'safe', 8841), r => r.exit !== 0 && /error|EACCES|Permission denied|Failed to launch/i.test(r.log) && !/\[ok\]/.test(r.log));
} else {
  check('apalache-launcher-disabled', verify('apalache', 'safe', 8841), () => false);
}
check('apalache-violation', verify('apalache', 'bad', 8842), r => r.exit !== 0 && /\[violation\]|counterexample/i.test(r.log) && r.execs.includes('java'));

check('tlc-pass', verify('tlc', 'safe', 8843), r => r.exit === 0 && /\[ok\]/.test(r.log) && r.execs.includes('java') && /tlc2\.TLC/.test(r.trace));
check('tlc-violation', verify('tlc', 'bad', 8844), r => r.exit !== 0 && /\[violation\]|counterexample/i.test(r.log) && /tlc2\.TLC/.test(r.trace));

// Java is hidden by PATH on an isolated child. No global Java files are changed.
const bin = join(output, 'no-java-bin');
mkdirSync(bin);
for (const n of ['bash', 'sh', 'env', 'dirname', 'readlink', 'uname', 'grep', 'sed', 'awk', 'tr', 'cat', 'find', 'head', 'tail', 'cut', 'realpath', 'ls', 'basename', 'mktemp', 'rm', 'sort', 'xargs', 'date', 'which']) {
  for (const p of ['/usr/bin/' + n, '/bin/' + n]) {
    if (existsSync(p)) { symlinkSync(p, join(bin, n)); break; }
  }
}
check('jvm-hidden', verify('apalache', 'safe', 8845), r => r.exit !== 0 && /java|JVM|JDK|not found/i.test(r.log) && !/\[ok\]/.test(r.log), { env: { PATH: bin, JAVA_HOME: '' } });

const failures = results.filter(x => !x.ok);
console.log('SUMMARY ' + runtime + ' ' + (results.length - failures.length) + '/' + results.length);
if (failures.length) process.exitCode = 1;
