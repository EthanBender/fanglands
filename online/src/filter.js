// ============================================================================
// THE WORD FILTER — every name and every chat line passes through here first
// A ten-year-old and his friends play this. Names are checked once at signup (cleanName); chat is masked
// on the way through the world (checkChat) so the bad word never reaches another screen, and the masked
// line is what gets logged for the parent to read at /admin.
// Two jobs, kept apart (docs/ONLINE.md, "Word strikes"):
//   - STARRING OUT is harmless, so it is generous: every word of BLOCKED and INSULTS, a bad word hidden inside another
//     (BLOCKED_INSIDE), look-alike spellings, phrases ("shut up", "go die") and "gay" used as an insult.
//   - A STRIKE counts toward 24 hours out, and a kid is never punished on a guess, so it is one thing only: a word on
//     STRIKE_WORDS (swear words and slurs), as a whole word or one of its common disguises. Nothing else ever strikes:
//     no insult, no phrase, nothing about who it was said to.
// No Cloudflare APIs here: the tests and tools/mmo-sim.js load this file in plain Node.
// ============================================================================

// The words that are a strike: swear words and slurs a kid would not type for anything else. Each is matched as a whole
// word, case does not matter, and in its common disguises: a letter held longer (fuuuck, shiiit), letters spaced or split
// up (f u c k, f.u.c.k, s-h-i-t), look-alike symbols inside a word ($hit, b!tch, @$$), and look-alike DIGITS only in a long
// word: a digit is read as a letter for a strike only when the word comes out 5 letters or longer and has at least 3 real
// letters (b1tch, n1gger, wh0re, d1ckhead). Short codes are never read that way, because phone models and shorthand look
// just like them (a22, a55, a2z, s21): sh1t, a55 and 4ss are starred out but never a strike. Never a number, alone or
// joined to a word (455, 8008, gold:455, the 455's, a 5 5), and never as part of a longer word (class, Scunthorpe,
// Dickens, cockpit).
// Left off on purpose, because they mean something else or are mild: damn, crap, hell, piss, bastard (a bastard sword),
// cock (a rooster), gook (gunk), prick (a thorn), tit (a bird), pussy (a cat), fag (a cigarette), dyke (a wall), spic (spic and span),
// coon (a raccoon), chink (in armour), dick (Dick Grayson, Moby Dick), kike (Kike Hernandez, a nickname for Enrique), tranny,
// homo, wtf, stfu and the like. They are still starred out (BLOCKED).
// Every one of these must be on BLOCKED too, so it is always starred out (the tests hold this).
export const STRIKE_WORDS = [
  // swearing
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fuckin', 'fucked', 'fucka', 'fuckhead', 'fuckface', 'fuk', 'fuks', 'fukin', 'fuking', 'fvck', 'fcuk', 'phuck',
  'motherfucker', 'motherfuckers', 'motherfucking', 'mofo',
  'shit', 'shits', 'shitty', 'shitting', 'shithead', 'shitheads', 'shitface', 'bullshit', 'horseshit', 'dipshit', 'shyt', 'shite',
  'ass', 'asshole', 'assholes', 'arse', 'arsehole', 'arseholes', 'dumbass', 'fatass', 'smartass',
  'bitch', 'bitches', 'bitchy', 'bitching', 'biatch',
  'cunt', 'cunts', 'kunt', 'cvnt',
  'dickhead', 'dickheads',
  'twat', 'twats', 'wanker', 'wankers', 'wank', 'wanking',
  'slut', 'sluts', 'slutty', 'whore', 'whores', 'skank', 'skanks',
  // slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'nigg', 'faggot', 'faggots', 'fagot',
  'retard', 'retards', 'retarded', 'wetback', 'raghead', 'towelhead', 'paki', 'pakis', 'beaner', 'beaners',
];
// Inside any word, for a strike: only "fuck", which is part of no ordinary word (fuckfuckfuck, xXfuckXx). Nothing else: shit
// is in shitake, cunt in Scunthorpe, ass in class, nigg in niggle.
export const STRIKE_INSIDE = ['fuck'];

// Words nobody should see or type: STARRED OUT, never a strike unless they are on STRIKE_WORDS too. One per line so a
// parent can edit the list without knowing any code. Each is matched as a whole word, case does not matter, after
// look-alike digits and symbols are put back to letters (sh1t, $hit, fvck), and plurals (dicks), stretched spellings
// (fuuuck) and spaced-out letters (f u c k) are caught as well. Two-word entries are matched as a phrase.
// Game words that look rude but are not (hoe, kill, weed, die, damn near everything a knight says about a
// goblin) are left off on purpose: a farmer needs a hoe.
export const BLOCKED = [
  // swearing
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'fucka', 'fuk', 'fuks', 'fukin', 'fuking', 'fvck', 'fcuk', 'fuq', 'phuck', 'effing',
  'shit', 'shits', 'shitty', 'shite', 'shithead', 'bullshit', 'shyt',
  'ass', 'asses', 'asshole', 'assholes', 'arse', 'arsehole', 'arses', 'azz',
  'bitch', 'bitches', 'bitchy', 'biatch',
  'bastard', 'bastards',
  'damn', 'dammit', 'goddamn', 'goddammit',
  'crap', 'crappy',
  'piss', 'pissed', 'pissing',
  'dick', 'dicks', 'dickhead', 'dickheads',
  'cock', 'cocks', 'cocksucker',
  'prick', 'pricks',
  'twat', 'twats',
  'cunt', 'cunts', 'kunt', 'cvnt',
  'wanker', 'wankers', 'wank', 'wanking',
  'bollocks',
  'bugger',
  'slut', 'sluts', 'slutty',
  'whore', 'whores',
  'skank', 'skanks',
  'douche', 'douchebag',
  'jackass', 'dumbass', 'fatass', 'badass',
  'motherfucker', 'motherfucking', 'mofo',
  'wtf', 'stfu', 'lmfao', 'gtfo',
  // bodies and sex
  'sex', 'sexy', 'sexting', 'sexual',
  'porn', 'porno', 'pornhub',
  'nude', 'nudes', 'naked',
  'boob', 'boobs', 'boobies', 'tit', 'tits', 'titties', 'titty',
  'penis', 'penises', 'vagina', 'vaginas', 'pussy', 'pussies',
  'cum', 'cums', 'cumming', 'jizz',
  'orgasm', 'horny', 'dildo',
  'blowjob', 'handjob', 'anal',
  'rape', 'rapes', 'raped', 'rapist', 'molest', 'molester',
  'pedo', 'pedos', 'pedophile', 'paedophile', 'paedo',
  'hentai', 'xxx', 'milf', 'thot', 'thots', 'nsfw', 'erotic', 'fetish', 'condom', 'condoms',
  'masturbate', 'masturbating', 'boner', 'boners',
  'scrotum', 'testicle', 'testicles', 'nipple', 'nipples', 'butthole', 'anus',
  // slurs
  'nigger', 'niggers', 'nigga', 'niggas', 'nigg', 'negro', 'negros', 'chink', 'chinks', 'gook', 'gooks', 'spic', 'spick', 'wetback', 'kike', 'kikes', 'raghead', 'towelhead',
  'fag', 'fags', 'faggot', 'faggots', 'dyke', 'dykes', 'tranny', 'trannies',
  'retard', 'retards', 'retarded', 'tard',
  'coon', 'coons', 'paki', 'pakis', 'beaner', 'beaners', 'redskin', 'injun',
  'homo', 'homos', 'lesbo', 'shemale', 'midget',
  // hate, self-harm, drugs
  'kys',
  'kill yourself',
  'kill urself',
  'kill ur self',
  'kill your self',
  'heil hitler',
  'suicide',
  'nazi', 'nazis', 'hitler', 'heil', 'kkk',
  'cocaine', 'heroin', 'meth',
];

// Insults (owner, 2026-10-03): starred out wherever they are, and NEVER a strike. Kids in a fighting game say "this boss is
// stupid hard", "stupid lag", "ya so dumb" and "I'm such a loser lol" all evening; a word list cannot tell who a word is
// about, so it does not try. Whole words; a letter held longer counts only with three or more of it (stuuupid), so
// "looser" is not "loser".
export const INSULTS = [
  'stupid', 'stupidest', 'stoopid', 'stupidhead', 'dumb', 'dumber', 'dumbest', 'dumbhead', 'idiot', 'idiots', 'idiotic',
  'moron', 'morons', 'moronic', 'loser', 'losers', 'imbecile', 'dimwit', 'nitwit', 'halfwit', 'numbskull', 'bonehead', 'fatso',
  'gaylord', 'gayboy', 'gaywad', 'gayass', 'ghey',
  // phrases: starred out wherever they are ("go die, it puts you back at town" is help, and is starred out all the same)
  'shut up', 'shutup', 'go die', 'go and die', 'go die in a hole', 'hate you', 'hate u', 'hate ya',
];
// "gay" used as an insult, starred out: these phrases, and a line that is only "gay" (gay! gaaay g4y, laughs aside).
// "gay" anywhere else is left alone ("my uncle is gay", "gay rights").
export const GAY_INSULTS = [
  'thats gay', 'that is gay', 'its gay', 'it is gay', 'this is gay', 'how gay', 'so gay', 'too gay', 'very gay', 'super gay',
  'such a gay', 'gay boy', 'gay kid', 'gay guy', 'gay noob', 'gay knight', 'gay baby', 'gay person', 'you are gay', 'ur gay',
  'youre gay', 'your gay', 'u r gay', 'you gay', 'u gay',
];
// Laughs a line that is only "gay" may have around it ("gay lol").
export const LAUGHS = ['lol', 'lmao', 'haha', 'hah', 'hehe', 'xd'];

// The worst of them are refused inside a name as well, even as part of a longer word (xXfuckerXx), and mask
// a chat word they hide in (fuckfuckfuck). Keep this list short: a word here also refuses innocent names
// that happen to contain it, which is why cock (Hancock), ass (Cassandra) and rape (Grape) are not here.
// Starring out only: a word hidden inside another is never a strike (STRIKE_INSIDE aside).
export const BLOCKED_INSIDE = [
  'fuck', 'fuk', 'fvck', 'fcuk', 'phuck', 'shit', 'shyt', 'cunt', 'kunt', 'cvnt', 'nigg', 'negro', 'faggot', 'fagot',
  'bitch', 'biatch', 'penis', 'vagina', 'pussy', 'porn', 'whore', 'slut', 'retard', 'dickhead', 'asshole', 'arsehole',
  'wank', 'jizz', 'boob', 'hitler', 'nazi',
];

// Names that would confuse the chat or pretend to be the server.
// 'word filter' and 'parent page' are who the What admins did list says made a strike or a change (mod_log `by`): a knight with
// that name would be renamed along with every row of it, and could chat as if it were the filter. Spaces do not count here
// ("Word Filter", "WordFilter" and "Wor dfilter" are all refused).
export const RESERVED_NAMES = ['admin', 'server', 'system', 'world', 'fanglands', 'moderator', 'mod', 'keeper', 'ethan', 'word filter', 'parent page', 'parent', 'filter'];

// ---------- putting swapped letters back ----------
// 1 can be an i or an l, | likewise; both readings are tried.
const SWAP_I = { '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't', '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g' };
const SWAP_L = Object.assign({}, SWAP_I, { '1': 'l', '|': 'i' });
const unleet = (s, swaps) => s.toLowerCase().replace(/[@$!|+0-9]/g, c => swaps[c] || c);
const squeeze = s => s.replace(/(.)\1+/g, '$1');            // fuuuck -> fuck, asss -> as
const stretched = s => /(.)\1/.test(s);                      // has a doubled letter at all
const runs = s => (s.match(/(.)\1*/g) || []).map(r => r.length);
// f is w with letters held longer (fuuuck, asss, gaaay), never shorter: "bobb" is not "boob", "kk" (ok) is not "kkk".
const stretchOf = (f, w) => {
  if (f === w || squeeze(f) !== squeeze(w)) return f === w;
  const a = runs(f), b = runs(w);
  return a.length === b.length && a.every((n, i) => n >= b[i]);
};
// Held for sure: some letter three or more times, more than the word has it (fuuuck, asss, stuuupid). Two of a letter is
// how ordinary words are spelled: assess is not "asses", Shiite is not "shite", looser is not "loser".
const surelyStretched = (f, w) => {
  if (f === w || !stretchOf(f, w)) return false;
  const a = runs(f), b = runs(w);
  return a.some((n, i) => n >= 3 && n > b[i]);
};
// A number, with or without a unit or a sign: 455, 8008, 7175, 4:55, 1,000, 455k, 8008g, 50xp, x2, #3, $455, 3rd, 45%.
// Its digits are never read as letters, and it is never starred out.
const NUMBER = /^[#$x×+\-~]?\d[\d.,:/%+\-]*(k|m|b|g|gp|gold|coins?|xp|hp|mp|dmg|x|s|st|nd|rd|th|lvl|lv|am|pm|min|mins|sec|secs|s|h|hr|hrs|d|kg|lb|lbs|ft|km)?$/i;
const isNumber = tok => NUMBER.test(tok.replace(/^[^a-z0-9#$+\-~×]+|[^a-z0-9%]+$/gi, ''));

// ---------- starring out ----------
// The lists, prepared once. Whole words go in WORDS (BLOCKED: held longer at all) and INSULT_WORDS (held for sure).
const prep = raw => unleet(String(raw), SWAP_I).replace(/\s+/g, ' ').trim();
const WORDS = new Set(), INSULT_WORDS = new Set(), PHRASES = [];
for (const raw of BLOCKED.concat(STRIKE_WORDS)) { const w = prep(raw); if (!w) continue; if (w.includes(' ')) PHRASES.push(w.split(' ')); else WORDS.add(w); }
for (const raw of INSULTS.concat(GAY_INSULTS)) { const w = prep(raw); if (!w) continue; if (w.includes(' ')) PHRASES.push(w.split(' ')); else INSULT_WORDS.add(w); }
const SQUEEZED = new Map();   // squeezed form -> the words it could be, for stretched spellings
for (const w of [...WORDS, ...INSULT_WORDS]) { const q = squeeze(w); if (!SQUEEZED.has(q)) SQUEEZED.set(q, []); SQUEEZED.get(q).push(w); }
const INSIDE = BLOCKED_INSIDE.map(w => unleet(String(w), SWAP_I).trim()).filter(Boolean);
const LAUGH_W = new Set(LAUGHS.map(prep));

// A number joined to a word by a mark (gold:8008, room#455, 455-pts) is split off and never read as letters: it becomes a
// plain mark, so "gold:8008" is never "gold:boob".
const numbersOut = t => t.split(/([^a-z0-9@$!|+]+)/i).map(p => p && (/^[0-9]+$/.test(p) || isNumber(p)) ? '.' : p).join('');

// Every reading of one token for starring out: as typed, with edge punctuation dropped (fuck! -> fuck), both digit
// readings, apostrophes dropped (that's -> thats), and without a trailing s. All lower case. A number is read only as itself.
function forms(tok) {
  const out = new Set();
  const bare = tok.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  if (isNumber(tok)) { out.add(bare.toLowerCase()); return out; }
  const joined = bare.replace(/['’]/g, '');
  for (const t of [tok, bare, joined]) for (const sw of [SWAP_I, SWAP_L]) {
    const n = unleet(numbersOut(t), sw);
    if (!n) continue;
    out.add(n);
    if (n.length > 3 && n.endsWith('s')) out.add(n.slice(0, -1));
  }
  return out;
}
function formBad(f) {
  if (WORDS.has(f) || INSULT_WORDS.has(f)) return true;
  if (stretched(f)) for (const w of SQUEEZED.get(squeeze(f)) || []) if (WORDS.has(w) ? stretchOf(f, w) : surelyStretched(f, w)) return true;
  for (const w of INSIDE) if (f.includes(w)) return true;
  return false;
}
export function isBadWord(tok) {
  for (const f of forms(tok)) if (formBad(f)) return true;
  return false;
}
const saysWord = (t, w) => { if (t.forms.has(w)) return true; for (const f of t.forms) if (stretched(f) && stretchOf(f, w)) return true; return false; };

// ---------- the strike ----------
const STRIKE_SET = new Set(STRIKE_WORDS.map(w => w.toLowerCase()));
const STRIKE_SQUEEZED = new Map();
for (const w of STRIKE_SET) { const q = squeeze(w); if (!STRIKE_SQUEEZED.has(q)) STRIKE_SQUEEZED.set(q, []); STRIKE_SQUEEZED.get(q).push(w); }
// one run of letters is a word on the list: as it is, or with a letter held longer (fuuuck, fuckkk, a$$$)
const onList = w => {
  if (STRIKE_SET.has(w)) return true;
  for (const s of STRIKE_SQUEEZED.get(squeeze(w)) || []) if (surelyStretched(w, s) || heldOnce(w, s)) return true;
  return false;
};
// The last letter held twice where the word has no double letter of its own (fuckk, shitt, dickk): never a letter in the
// middle ("Shiite" is not "shite") and never a word with a double letter ("asses" is never "assess").
const heldOnce = (f, w) => {
  if (stretched(w) || f !== w + w[w.length - 1]) return false;
  return true;
};
const insideList = w => STRIKE_INSIDE.some(s => squeeze(w).includes(squeeze(s)));
// The letters of a token a strike may read. Lower case, edge punctuation dropped (fuck!, (shit), "ass"). Then the token is
// split at its marks (anything but letters, digits and the look-alike symbols @$!|+) BEFORE any digit is read as a letter,
// and a piece that is a number (455, 455s, $455) is left out: "gold:455", "the 455's", "lvl-455" and "room#455" are never
// "ass". Only a piece with a real letter in it, or one made only of look-alike symbols (@$$), is read, with its look-alike
// digits and symbols put back to letters (sh1t, a55, $hit). A contraction or a possessive is two words: "who're" is never
// "whore"; "shit's" is still "shit".
const LOOKS = /^[@$!|+]+$/;
const MARKS = /[^a-z0-9@$!|+]+/;
const readable = p => /[a-z]/.test(p) ? !isNumber(p) : LOOKS.test(p);
// a piece with a digit in it may only be read as a strike word when it is long and mostly letters (see STRIKE_WORDS)
const digitOk = (raw, read) => !/[0-9]/.test(raw) || (read.length >= 5 && (raw.match(/[a-z]/g) || []).length >= 3);
function strikeToken(tok) {
  const t = tok.toLowerCase().replace(/^[^a-z0-9@$]+|[^a-z0-9@$]+$/g, '');
  if (!t || isNumber(t)) return false;
  const pieces = t.split(MARKS).filter(Boolean);
  const read = pieces.filter(readable);
  if (!read.length) return false;
  // the letters split up by marks read as one (f.u.c.k, s-h-i-t, a_s_s, @.$.$): only when every piece is one letter or one
  // look-alike symbol, never a digit, so "go.ok" or "go-ok" is never "gook" and "a-5-5" is never "ass"
  const spelled = pieces.length >= 3 && pieces.every(p => /^[a-z@$!|+]$/.test(p));
  for (const sw of [SWAP_I, SWAP_L]) {
    const parts = read.map(p => unleet(p, sw));
    if (parts.some((p, k) => digitOk(read[k], p) && (onList(p) || insideList(p)))) return true;
    if (spelled && onList(parts.join(''))) return true;
  }
  return false;
}
export function isStrikeWord(tok) { return typeof tok === 'string' && strikeToken(tok); }

// Marks which whitespace-separated tokens of s are bad (to be starred out) and which are a strike. Every strike is also bad.
function markBad(s) {
  const toks = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(s))) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length, bad: false, sure: false, forms: null });
  for (const t of toks) {
    t.forms = forms(t.text);
    for (const f of t.forms) if (formBad(f)) { t.bad = true; break; }
    if (strikeToken(t.text)) t.bad = t.sure = true;
  }
  const mark = (i, k) => { for (let j = i; j < k; j++) toks[j].bad = true; };
  for (const words of PHRASES) for (let i = 0; i + words.length <= toks.length; i++) {
    if (words.every((w, j) => saysWord(toks[i + j], w))) mark(i, i + words.length);
  }
  // a line that is only "gay" (laughs aside): starred out, no strike
  const real = toks.filter(t => !Array.from(t.forms).some(f => LAUGH_W.has(f)));
  if (real.length === 1 && Array.from(real[0].forms).some(f => f === 'gay' || (stretched(f) && stretchOf(f, 'gay')))) real[0].bad = true;
  // f u c k: three or more one-letter tokens in a row read as one word (end punctuation aside: "f u c k!"; marks between them
  // too: "f . u . c . k")
  const core = t => t.text.length > 1 ? t.text.replace(/[.!?,;:"')\]]+$/, '') : t.text;
  const mark0 = t => /^[^a-z0-9@$!|+]+$/i.test(t.text);
  const spacedRuns = (one, found) => {
    for (let i = 0; i < toks.length; i++) {
      if (!one(toks[i])) continue;
      let j = i; const letters = [];
      while (j < toks.length && (one(toks[j]) || (mark0(toks[j]) && j + 1 < toks.length && one(toks[j + 1])))) { if (one(toks[j])) letters.push(core(toks[j])); j++; }
      if (letters.length >= 3) found(i, j, letters.join(''));
      i = j - 1;
    }
  };
  // Starring out is generous: a lone digit may stand for a letter (s h 1 t).
  spacedRuns(t => /^[a-z0-9@$!|+]$/i.test(core(t)), (i, j, word) => { if (isBadWord(word)) mark(i, j); });
  // A strike reads only letters and look-alike symbols: a lone digit is a number and ends the run, so "a 5 5" (dice, a
  // score) and "a 2 2 tie" are never "ass" or "azz", while "f u c k" and "n i g g a" still count.
  spacedRuns(t => /^[a-z@$!|+]$/i.test(core(t)), (i, j, word) => { if (strikeToken(word)) for (let k = i; k < j; k++) toks[k].bad = toks[k].sure = true; });
  return toks;
}

// Chat: trimmed, whitespace collapsed, at most 120 characters, bad words replaced by asterisks of the same length.
// Answers {text, masked, strike}: text is '' when nothing is left to say; masked says whether any word had to be starred
// out; strike says whether one of them is on STRIKE_WORDS (or a disguise of one), which the world counts as a word strike
// (docs/ONLINE.md, "Word strikes"). A strike is always masked too; a masked line is often no strike (an insult, a mild
// word, a word hidden in another).
export function checkChat(s) {
  if (typeof s !== 'string') return { text: '', masked: false, strike: false };
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { text: '', masked: false, strike: false };
  if (s.length > 120) s = s.slice(0, 120).trim();
  const toks = markBad(s);
  let out = '', pos = 0, masked = false, strike = false;
  for (const t of toks) {
    if (!t.bad) continue;
    masked = true;
    if (t.sure) strike = true;
    out += s.slice(pos, t.start) + '*'.repeat(t.end - t.start);
    pos = t.end;
  }
  out += s.slice(pos);
  return { text: out.trim(), masked, strike };
}
// The masked line on its own.
export function cleanChat(s) { return checkChat(s).text; }

const RESERVED = new Set(RESERVED_NAMES.map(n => n.replace(/ /g, '')));

// Anything rude in a name: a bad word or an insult anywhere, or one hidden by spaces ("fu ck", "Stu Pid").
function nameBad(s) {
  if (markBad(s).some(t => t.bad)) return true;
  return isBadWord(s.replace(/ /g, ''));
}

// Names: 2 to 16 characters of letters, digits and single spaces, trimmed, nothing rude anywhere in them.
// Returns the tidied name, or null when it will not do.
export function cleanName(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 16) return null;
  if (!/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(s)) return null;
  if (RESERVED.has(s.toLowerCase().replace(/ /g, ''))) return null;
  // no kid can pose as a teacher (docs/ONLINE.md, "The teacher view"): "teacher" anywhere, any case, spaces aside
  if (s.toLowerCase().replace(/ /g, '').includes('teacher')) return null;
  if (nameBad(s)) return null;
  return s;
}

// A name already in the world that the list refuses today (it was made before a word was added): true when anything rude
// is in it. Only the words count here, not the length or the characters, so an old name is judged on what it says.
export function nameRude(s) {
  if (typeof s !== 'string') return false;
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return false;
  return nameBad(s);
}
