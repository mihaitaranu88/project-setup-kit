import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));

export const KIT_CONFIG_PATH = join(HOOKS_DIR, '..', 'config.json');

export function loadKitConfig(path = KIT_CONFIG_PATH) {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  return JSON.parse(trimmed);
}

function detectHost(payload) {
  if (payload.tool_input !== undefined || payload.hook_event_name?.match(/^(Pre|Post)ToolUse$/)) return 'claude';
  if (payload.toolArgs !== undefined || payload.toolName !== undefined) return 'copilot';
  if (typeof payload.hook_event_name === 'string') return 'cursor';
  return 'unknown';
}

function collectStrings(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, found));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, found));
  return found;
}

const COMMAND_KEYS = ['command', 'bash', 'powershell', 'cmd'];
const PATH_KEYS = ['file_path', 'path', 'file', 'notebook_path', 'pattern', 'glob', 'filePath'];

export function normalizeToolCall(raw) {
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new SyntaxError('hook payload is not a JSON object');
  }
  const host = detectHost(payload);
  const args = parseMaybeJson(payload.tool_input ?? payload.toolArgs ?? payload) ?? {};
  if (typeof args !== 'object' || Array.isArray(args)) {
    throw new SyntaxError('tool arguments are not a JSON object');
  }
  const commands = COMMAND_KEYS.map(key => args[key]).filter(value => typeof value === 'string');
  const paths = PATH_KEYS.map(key => args[key]).filter(value => typeof value === 'string');
  return {
    host,
    toolName: payload.tool_name ?? payload.toolName ?? payload.hook_event_name ?? '',
    commands,
    paths,
    allText: collectStrings(args).join('\n'),
    payload,
  };
}

export function quoteForShell(value, platform = process.platform) {
  if (platform === 'win32') return `"${value.replace(/"/g, '""')}"`;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatDecision(host, reason, decision = 'deny') {
  if (host === 'claude') {
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    };
  }
  if (host === 'cursor') {
    return { permission: decision, userMessage: reason, agentMessage: reason };
  }
  return { permissionDecision: 'deny', permissionDecisionReason: reason };
}

export function formatDeny(host, reason) {
  return formatDecision(host, reason, 'deny');
}

export function resolveCwd(call) {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  return typeof call.payload?.cwd === 'string' ? call.payload.cwd : process.cwd();
}

export async function readStdin() {
  let raw = '';
  for await (const chunk of process.stdin.setEncoding('utf8')) raw += chunk;
  return raw;
}

export function guessHostFromRaw(raw) {
  if (raw.includes('"tool_input"')) return 'claude';
  if (raw.includes('"toolArgs"') || raw.includes('"toolName"')) return 'copilot';
  if (raw.includes('"hook_event_name"')) return 'cursor';
  return 'unknown';
}

export async function runGuard(check) {
  const raw = await readStdin();
  let decision;
  try {
    decision = await check(normalizeToolCall(raw));
  } catch {
    decision = { host: guessHostFromRaw(raw), reason: 'Guard could not parse this tool call, so it is blocked.' };
  }
  if (decision) {
    process.stdout.write(`${JSON.stringify(formatDecision(decision.host, decision.reason, decision.decision ?? 'deny'))}\n`);
  }
}
