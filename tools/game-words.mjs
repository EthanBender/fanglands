#!/usr/bin/env node
// The game's own words, for the word filter: node tools/game-words.mjs   (build.sh runs it)
// Every string in src/*.js outside the self-tests, cut into lower-case words, written to online/src/gamewords.js.
// The filter (online/src/filter.js) uses them for one thing: a knight on line whose name is also a word the game says (Goblin,
// Dragon, Gnasher, Boss, Wolf, King, Fang...) is never "the person" an insult was aimed at for a strike, because a kid
// shouting "you stupid goblin" is shouting at a monster. Self-tests are left out: their made-up knights (Sam, Ada, Cohen) are
// not words of the game, and a name like those should still count.
// online/test/filter.test.mjs checks the written file matches what this makes from src/ today.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'src');
export const OUT = path.join(ROOT, 'online', 'src', 'gamewords.js');

// The strings of one file, as the filter test reads them: '...', "..." and `...` with no ${} in it.
export function stringsOf(src) {
  const out = [];
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).replace(/\\n/g, ' ').replace(/\\(.)/g, '$1');
    if (/[a-z]{2}/i.test(s)) out.push(s);
  }
  return out;
}

// Every string of every src/*.js file (self-tests too): what a kid could ever read in the game, and more.
export function gameStrings(dir = SRC) {
  const strs = new Set();
  for (const f of fs.readdirSync(dir).filter(f => /^\d.*\.js$/.test(f)).sort()) for (const s of stringsOf(fs.readFileSync(path.join(dir, f), 'utf8'))) strs.add(s);
  return strs;
}

// The JavaScript of one file read as code: comments skipped, regex literals skipped, and every string literal and every piece
// of template text (the words around its ${}) handed to onText. From src[at], which is an opening bracket ('(', '[' or '{')
// when stopAtClose is set: then it stops at the bracket that closes it and answers its index. Throws when the code does not
// read (a bracket that never closes): the words would be wrong, so the build stops.
export function lex(src, at = 0, stopAtClose = false, onText = () => { }) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let i = at, prev = '';   // prev: the last significant character, to tell a regex from a division
  if (stopAtClose) { stack.push(pairs[src[i]]); i++; prev = '('; }
  const regexCan = () => prev === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(prev);
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw new Error('a comment never closes at ' + i); i = e + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, text = '';
      while (j < src.length && src[j] !== c) { if (src[j] === '\n') throw new Error('a string runs off the line at ' + i); if (src[j] === '\\') { text += src[j + 1] === 'n' ? ' ' : src[j + 1]; j += 2; } else text += src[j++]; }
      onText(text); i = j + 1; prev = 'a'; continue;
    }
    if (c === '`') {
      let j = i + 1, text = '';
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') { text += src[j + 1] === 'n' ? ' ' : src[j + 1]; j += 2; continue; }
        if (src[j] === '$' && src[j + 1] === '{') { text += ' '; j = lex(src, j + 1, true, onText) + 1; continue; }
        text += src[j++];
      }
      onText(text); i = j + 1; prev = 'a'; continue;
    }
    if (c === '/' && regexCan()) {
      let j = i + 1, cls = false;
      while (j < src.length && (cls || src[j] !== '/')) { if (src[j] === '\n') throw new Error('a regex runs off the line at ' + i); if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; j++; }
      j++; while (/[a-z]/i.test(src[j] || '')) j++;
      i = j; prev = 'a'; continue;
    }
    if (pairs[c]) stack.push(pairs[c]);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.length && stack.pop() !== c) throw new Error('brackets do not match at ' + i);
      if (stopAtClose && !stack.length) return i;
    }
    if (/[A-Za-z0-9_$]/.test(c)) {
      // a whole word: "return /x/" starts a regex, "a / b" is a division
      let j = i; while (/[A-Za-z0-9_$.]/.test(src[j] || '')) j++;
      const w = src.slice(i, j); prev = /^(return|typeof|case|in|of|new|delete|void|throw|else|do|yield|await)$/.test(w) ? '(' : 'a'; i = j; continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  if (stopAtClose) throw new Error('the bracket at ' + at + ' never closes');
  return i;
}

// One file with its self-tests cut out (every HOOKS.selfTest.push(...)).
export function withoutSelfTests(src, file = '?') {
  let out = '', from = 0;
  const re = /HOOKS\.selfTest\.push\(/g; let m;
  while ((m = re.exec(src))) {
    if (m.index < from) continue;
    let end;
    try { end = lex(src, m.index + m[0].length - 1, true); } catch (e) { throw new Error(`${file}: a self-test that does not read (${e.message})`); }
    out += src.slice(from, m.index) + 'null';
    from = end + 1; re.lastIndex = from;
  }
  return out + src.slice(from);
}

// The words: every run of letters in a string or template the game has outside a self-test, lower case, 2 letters or more.
export function gameWords(dir = SRC) {
  const words = new Set();
  for (const f of fs.readdirSync(dir).filter(f => /^\d.*\.js$/.test(f)).sort()) {
    const src = withoutSelfTests(fs.readFileSync(path.join(dir, f), 'utf8'), f);
    try { lex(src, 0, false, s => { for (const w of s.toLowerCase().match(/[a-z]+/g) || []) if (w.length >= 2) words.add(w); }); }
    catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  return Array.from(words).sort();
}

export function fileText(words) {
  const lines = [];
  let line = '';
  for (const w of words) { if (line.length + w.length + 1 > 110) { lines.push(line); line = ''; } line += (line ? ' ' : '') + w; }
  if (line) lines.push(line);
  return '// MADE BY tools/game-words.mjs FROM src/ (build.sh runs it). Do not edit: edit the game and build.\n' +
    '// Every word the game says outside its self-tests. The word filter never counts a knight\'s name as "the person" an\n' +
    '// insult was aimed at when the name is one of these (a knight named Goblin, and "you stupid goblin").\n' +
    'export const GAME_WORDS = [\n' + lines.map(l => "  '" + l + "',").join('\n') + '\n].join(\' \');\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const words = gameWords();
  const text = fileText(words);
  const was = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (was !== text) fs.writeFileSync(OUT, text);
  console.log(`game words: ${words.length} (online/src/gamewords.js${was === text ? ', unchanged' : ', written'})`);
}
