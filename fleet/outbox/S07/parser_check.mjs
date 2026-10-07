// Dry run only. No secret scanning, uploads, or transcript output.
// Fetch only the two reviewed public parser modules before reading local files.
// Pin the implementation so results are reproducible.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const revision = 'd98655f8f894df738594789519c2bc3a1b9ea733';
const publicRoot = `https://raw.githubusercontent.com/forem/forem/${revision}/app/javascript/agentSessionParsers/`;
const transcriptRoot = '/home/abied/.claude/projects/-home-abied-Desktop-Truffle';
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

async function publicSource(name) {
  const response = await fetch(publicRoot + name);
  if (!response.ok) throw new Error('Public parser source unavailable');
  return response.text();
}

async function filesUnder(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const location = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(location));
    else if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(location);
  }
  return files.sort();
}

try {
  const [baseSource, claudeSource] = await Promise.all([
    publicSource('base.js'), publicSource('claudeCode.js'),
  ]);
  // The reviewed modules only parse data. Do not load the scrubber.
  const patchedSource = claudeSource.replace("'./base.js'", JSON.stringify(moduleUrl(baseSource)));
  if (patchedSource === claudeSource) throw new Error('Unexpected parser import');
  const { parse } = await import(moduleUrl(patchedSource));
  // No network calls occur below this line.
  for (const filename of await filesUnder(transcriptRoot)) {
    const raw = await readFile(filename, 'utf8');
    const normalized = parse(raw);
    const messages = normalized.messages;
    const blocks = messages.flatMap((message) => message.content);
    console.log(JSON.stringify({
      file: path.relative(transcriptRoot, filename),
      bytes: Buffer.byteLength(raw),
      lines: raw === '' ? 0 : raw.split('\n').length - Number(raw.endsWith('\n')),
      records: raw.split('\n').filter((line) => line.trim()).length,
      normalized_messages: messages.length,
      user_messages: messages.filter((message) => message.role === 'user').length,
      assistant_messages: messages.filter((message) => message.role === 'assistant').length,
      text_blocks: blocks.filter((block) => block.type === 'text').length,
      tool_calls: blocks.filter((block) => block.type === 'tool_call').length,
      tool_calls_with_output: blocks.filter((block) => block.type === 'tool_call' && block.output !== undefined).length,
    }));
  }
} catch {
  // Do not print errors that might include input or dynamically imported code.
  console.error('Structural parser check failed. No transcript content was printed.');
  process.exitCode = 1;
}
