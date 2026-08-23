/**
 * Utilidades compartidas por los scripts de MapIt.
 * Todo aquí debe funcionar igual en Windows (PowerShell), macOS y Linux.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const IS_WINDOWS = process.platform === 'win32';

/* ── Salida por consola ─────────────────────────────────── */
const supportsColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code) => (s) => (supportsColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  blue: paint(34),
  magenta: paint(35),
  cyan: paint(36),
  gray: paint(90),
  bold: paint(1),
};

export const log = {
  step: (m) => console.log(`\n${c.bold(c.cyan('▸'))} ${c.bold(m)}`),
  ok: (m) => console.log(`  ${c.green('✔')} ${m}`),
  warn: (m) => console.log(`  ${c.yellow('!')} ${m}`),
  fail: (m) => console.log(`  ${c.red('✖')} ${m}`),
  info: (m) => console.log(`  ${c.gray(m)}`),
  plain: (m) => console.log(m),
};

/**
 * Termina el proceso con un mensaje accionable.
 * Regla del proyecto: todo fallo dice QUÉ pasó y CÓMO arreglarlo.
 */
export function die(what, how) {
  console.error(`\n${c.red(c.bold('✖ ' + what))}`);
  if (how) console.error(`\n${c.yellow('Cómo arreglarlo:')}\n${how}\n`);
  process.exit(1);
}

/* ── Ejecución de procesos ──────────────────────────────── */

const SHELL_LAUNCHERS = new Set(['pnpm', 'npm', 'npx', 'ng', 'yarn', 'corepack']);

/**
 * Windows tiene dos problemas cruzados al lanzar procesos:
 *
 *  1. `pnpm`, `npx`, `ng`… no son .exe sino lanzadores .cmd, y desde la mitigación
 *     de CVE-2024-27980 Node se NIEGA a ejecutar un .cmd con `shell: false`.
 *  2. Pero usar `shell: true` pasando los argumentos como array dispara el warning
 *     DEP0190, porque Node los concatena sin escapar (inyección de comandos).
 *
 * Solución: para esos lanzadores construimos la línea de comando nosotros mismos,
 * citando cada argumento, y la pasamos como string único con `args: []`.
 * Los .exe normales (docker, git, java, node) siguen con `shell: false` y array.
 */
function isLauncher(cmd) {
  if (!IS_WINDOWS) return false;
  const base = String(cmd)
    .replace(/\.(cmd|bat|ps1)$/i, '')
    .split(/[\\/]/)
    .pop();
  return SHELL_LAUNCHERS.has(base) || /\.(cmd|bat)$/i.test(cmd);
}

/** Cita un argumento para cmd.exe. */
function quoteArg(a) {
  const s = String(a);
  return /[\s"^&|<>()%!]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Devuelve [comando, args, opcionesExtra] listos para spawn, resolviendo lo anterior.
 */
export function buildInvocation(cmd, args = []) {
  if (isLauncher(cmd)) {
    const exe = /\.(cmd|bat)$/i.test(cmd) ? cmd : `${cmd}.cmd`;
    const line = [exe, ...args].map(quoteArg).join(' ');
    return [line, [], { shell: true, windowsVerbatimArguments: true }];
  }
  return [cmd, args, { shell: false }];
}

/** Ejecuta y hereda stdio. Lanza si el código de salida no es 0. */
export function run(cmd, args = [], opts = {}) {
  const [bin, argv, extra] = buildInvocation(cmd, args);
  const r = spawnSync(bin, argv, {
    stdio: 'inherit',
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    ...extra,
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !opts.allowFailure) process.exit(r.status ?? 1);
  return r.status ?? 0;
}

/** Ejecuta capturando la salida. Nunca lanza. */
export function capture(cmd, args = [], opts = {}) {
  const [bin, argv, extra] = buildInvocation(cmd, args);
  const r = spawnSync(bin, argv, {
    encoding: 'utf8',
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    ...extra,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
  };
}

/** Lanza un proceso en segundo plano con prefijo de color en cada línea. */
export function spawnPrefixed(label, color, cmd, args, opts = {}) {
  const [bin, argv, extra] = buildInvocation(cmd, args);
  const child = spawn(bin, argv, {
    cwd: opts.cwd ?? ROOT,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    ...extra,
  });
  const tag = color(`[${label}]`.padEnd(11));
  const pipe = (stream, isErr) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) (isErr ? process.stderr : process.stdout).write(`${tag} ${line}\n`);
      }
    });
  };
  pipe(child.stdout, false);
  pipe(child.stderr, true);
  return child;
}

/* ── Entorno ────────────────────────────────────────────── */

/** Lee el .env sin dependencias externas. */
export function readEnv(file = join(ROOT, '.env')) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key.startsWith('//')) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/** Carga el .env en process.env sin pisar variables ya definidas. */
export function loadEnv() {
  const vars = readEnv();
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  return vars;
}

/* ── Red ────────────────────────────────────────────────── */

export function isPortFree(port, host = '127.0.0.1') {
  return new Promise((res) => {
    const socket = new net.Socket();
    socket.setTimeout(700);
    socket.once('connect', () => {
      socket.destroy();
      res(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      res(true);
    });
    socket.once('error', () => res(true));
    socket.connect(port, host);
  });
}

/** Espera a que un puerto acepte conexiones (servicio arriba). */
export async function waitForPort(port, { timeoutMs = 120000, label = `puerto ${port}` } = {}) {
  const started = Date.now();
  process.stdout.write(`  ${c.gray('…')} esperando ${label}`);
  while (Date.now() - started < timeoutMs) {
    if (!(await isPortFree(port))) {
      process.stdout.write(` ${c.green('✔')}\n`);
      return true;
    }
    process.stdout.write('.');
    await sleep(1500);
  }
  process.stdout.write(` ${c.red('✖')}\n`);
  return false;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Comparación de versiones ───────────────────────────── */

export function parseMajor(text) {
  const m = String(text).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
