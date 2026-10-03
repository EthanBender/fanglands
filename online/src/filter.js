// ============================================================================
// THE WORD FILTER — every name and every chat line passes through here first
// A ten-year-old and his friends play this. Names are checked once at signup (cleanName); chat is masked
// on the way through the world (cleanChat) so the bad word never reaches another screen, and the masked
// line is what gets logged for the parent to read at /admin.
// No Cloudflare APIs here: the tests and tools/mmo-sim.js load this file in plain Node.
// ============================================================================

// Words nobody should see or type. One per line so a parent can edit the list without knowing any code.
// Each is matched as a whole word, case does not matter, after look-alike digits and symbols are put back
// to letters (sh1t, $hit, fvck), and plurals (dicks), stretched spellings (fuuuck) and spaced-out letters
// (f u c k) are caught as well. Two-word entries are matched as a phrase.
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
  'suicide',
  'nazi', 'nazis', 'hitler', 'heil', 'kkk',
  'cocaine', 'heroin', 'meth',
];

// Insults (owner, 2026-10-03: "insults count as well as swear words, including 'gay' used as an insult"). A knight is kept
// out for 24 hours after three, so only what is said AT someone counts: kids in a fighting game say "this boss is stupid
// hard", "stupid lag", "lets go die to the dragon again" and "I'm such a loser lol" all evening, and none of that is a strike.
// Words that are an insult wherever they are (nobody calls a goblin a nitwit by accident):
export const INSULTS = [
  'stupidhead', 'dumbhead', 'dimwit', 'nitwit', 'halfwit', 'numbskull', 'bonehead', 'fatso',
  'gaylord', 'gayboy', 'gaywad', 'gayass', 'ghey',
  'go die in a hole', 'just go die', 'pls go die', 'plz go die', 'please go die', 'go die already', 'go and die',
];
// Words that are only an insult when they are said about someone: right after "you" ("you idiot", "you are so dumb",
// "you're a loser", "u r stupid"). On their own they are left alone: "the dumb goblin", "this boss is stupid hard", "my stupid
// brother", "an idiot proof plan", "Dumbo the elephant", "I'm such a loser lol", "a gay old time".
// "Sam is gay" and "my uncle is gay" read the same to a word list, so "is gay" is left off on purpose; a parent who wants it
// caught adds 'is gay' to INSULTS.
export const SAID_ABOUT_YOU = [
  'gay', 'dumb', 'ugly', 'fat', 'fatty', 'stupid', 'idiot', 'idiots', 'idiotic', 'moron', 'morons', 'moronic',
  'loser', 'losers', 'imbecile', 'dumbo',
];
// "you" for sure: the word after it (or after one of BETWEEN) is said about someone wherever it is in the line.
export const YOU_ARE = ['you', 'u', 'youre', 'ure', 'you are', 'u are', 'u r', 'you r'];
// "you're" or "your", which a word list cannot tell apart: "ur dumb" is an insult, "ur dumb sword is cool" is not. These
// count only when the word ends the line or the sentence ("ur dumb", "your gay!", "see ya loser"), or one of AFTER
// comes next ("ur dumb lol"); never when another word follows it ("your fat dragon", "your ugly ogre").
export const YOU_OR_YOUR = ['ur', 'your', 'yur', 'ya'];
// Little words that may sit in between: "you are SO dumb", "ur A loser", "you're SUCH AN idiot", "you BIG idiot".
export const BETWEEN = ['so', 'a', 'an', 'such', 'such a', 'such an', 'big', 'a big', 'total', 'a total', 'really', 'very'];
// 'gay' in the ways it is used as an insult: "that's gay", "so gay", "gay boy", or a line that is only "gay"
export const GAY_INSULTS = [
  'thats gay', 'that is gay', 'its gay', 'it is gay', 'this is gay', 'how gay', 'so gay', 'too gay', 'very gay', 'super gay',
  'such a gay', 'gay boy', 'gay kid', 'gay guy', 'gay noob', 'gay knight', 'gay baby', 'gay person',
];
// Said to someone, they count; said about a monster, the lag or yourself, they do not. Each counts when it ends the line or
// the sentence ("shut up", "ok shut up!", "i hate you"), when one of AFTER or a knight's name comes next ("shut up sam",
// "hate you noob"), or when it is the whole line: never before another word ("shut up no way", "shut up and take my
// coins", "i hate you goblin king").
export const AT_SOMEONE = ['shut up', 'shutup', 'hate you', 'hate u', 'hate ya'];
// Counts only when it is the whole line ("go die") or a person comes next ("go die noob", "go die sam"); never at the end of
// a sentence about yourself ("dont go die", "lets go die to the dragon again", "im gonna go die in the lava").
export const SAID_TO_SOMEONE = ['go die'];
// A line that is only one of these (laughs aside: "loser lol") is said at someone.
export const LINE_ALONE = ['gay', 'idiot', 'idiots', 'moron', 'morons', 'loser', 'losers', 'imbecile'];
// People: after AT_SOMEONE, SAID_TO_SOMEONE or YOU_OR_YOUR, these mean the words were aimed at someone (so does the name of
// any knight on line, which the world passes in).
export const PEOPLE = ['you', 'u', 'ur', 'ya', 'noob', 'noobs', 'kid', 'dude', 'bro', 'nerd', 'loser', 'idiot', 'moron'];
// Laughs: after AT_SOMEONE or YOU_OR_YOUR they read like the end of the line ("ur dumb lol"), and LINE_ALONE ignores them.
export const LAUGHS = ['lol', 'lmao', 'haha', 'hah', 'hehe', 'xd', 'bruh'];
// In a name there is nobody else to say it about, so these count anywhere in a name ("Stupid Sam", "Big Loser", "Idiot"):
export const NAME_INSULTS = ['stupid', 'idiot', 'idiots', 'idiotic', 'moron', 'morons', 'moronic', 'loser', 'losers', 'imbecile'];

// The worst of them are refused inside a name as well, even as part of a longer word (xXfuckerXx), and mask
// a chat word they hide in (fuckfuckfuck). Keep this list short: a word here also refuses innocent names
// that happen to contain it, which is why cock (Hancock), ass (Cassandra) and rape (Grape) are not here.
export const BLOCKED_INSIDE = [
  'fuck', 'fuk', 'fvck', 'fcuk', 'phuck', 'shit', 'shyt', 'cunt', 'kunt', 'cvnt', 'nigg', 'negro', 'faggot', 'fagot',
  'bitch', 'biatch', 'penis', 'vagina', 'pussy', 'porn', 'whore', 'slut', 'retard', 'dickhead', 'asshole', 'arsehole',
  'wank', 'jizz', 'boob', 'hitler', 'nazi',
];

// Names that would confuse the chat or pretend to be the server.
export const RESERVED_NAMES = ['admin', 'server', 'system', 'world', 'fanglands', 'moderator', 'mod', 'keeper', 'ethan'];

// ---------- putting swapped letters back ----------
// 1 can be an i or an l, | likewise; both readings are tried.
const SWAP_I = { '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't', '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g' };
const SWAP_L = Object.assign({}, SWAP_I, { '1': 'l', '|': 'i' });
const unleet = (s, swaps) => s.toLowerCase().replace(/[@$!|+0-9]/g, c => swaps[c] || c);
const squeeze = s => s.replace(/(.)\1+/g, '$1');            // fuuuck -> fuck, asss -> as
const stretched = s => /(.)\1/.test(s);                      // has a doubled letter at all

// The list, prepared once. Whole words go in WORDS; their squeezed forms in SQUEEZED so a stretched word
// matches only when it was stretched (plain "as" never matches "ass", but "asss" does). Phrases keep their words.
const prep = raw => unleet(String(raw), SWAP_I).replace(/\s+/g, ' ').trim();
const split = list => list.map(prep).filter(Boolean).map(w => w.split(' '));
const WORDS = new Set(), SQUEEZED = new Set(), PHRASES = [];
for (const raw of BLOCKED.concat(INSULTS, GAY_INSULTS)) {
  const w = prep(raw);
  if (!w) continue;
  if (w.includes(' ')) PHRASES.push(w.split(' '));
  else { WORDS.add(w); SQUEEZED.add(squeeze(w)); }
}
const INSIDE = BLOCKED_INSIDE.map(w => unleet(String(w), SWAP_I).trim()).filter(Boolean);
const ABOUT_SURE = split(YOU_ARE), ABOUT_MAYBE = split(YOU_OR_YOUR), BETWEEN_W = [[]].concat(split(BETWEEN));
const ABOUT_W = SAID_ABOUT_YOU.map(prep), AT_W = split(AT_SOMEONE), TO_W = split(SAID_TO_SOMEONE);
const ALONE_W = LINE_ALONE.map(prep), PEOPLE_W = PEOPLE.map(prep), LAUGH_W = LAUGHS.map(prep), NAME_W = new Set(NAME_INSULTS.map(prep));

// Every reading of one token: as typed, with edge punctuation dropped (fuck! -> fuck), both digit readings,
// and without a trailing s. All lower case.
function forms(tok) {
  const out = new Set();
  const bare = tok.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  // you're, that's, it's (straight or curly apostrophe) read as youre, thats, its
  const joined = bare.replace(/['\u2019]/g, '');
  for (const t of [tok, bare, joined]) for (const sw of [SWAP_I, SWAP_L]) {
    const n = unleet(t, sw);
    if (!n) continue;
    out.add(n);
    if (n.length > 3 && n.endsWith('s')) out.add(n.slice(0, -1));
  }
  return out;
}
function formBad(f) {
  if (WORDS.has(f)) return true;
  if (stretched(f) && SQUEEZED.has(squeeze(f))) return true;
  for (const w of INSIDE) if (f.includes(w)) return true;
  return false;
}
export function isBadWord(tok) {
  for (const f of forms(tok)) if (formBad(f)) return true;
  return false;
}

// One token says this word of a phrase: as typed, or stretched (so gaaay, ur -> urrr)
const saysWord = (t, w) => { if (t.forms.has(w)) return true; for (const f of t.forms) if (stretched(f) && squeeze(f) === squeeze(w)) return true; return false; };

// toks[i...] says these words, one token each: the index just after them, or -1
const saysAt = (toks, i, words) => {
  if (i + words.length > toks.length) return -1;
  for (let j = 0; j < words.length; j++) if (!saysWord(toks[i + j], words[j])) return -1;
  return i + words.length;
};
const saysOne = (t, list) => !!t && list.some(w => saysWord(t, w));
// a knight's name (or its first words) starts at toks[i]
const nameAt = (toks, i, names) => i < toks.length && names.some(n => saysAt(toks, i, n) > i);
// the token ends a sentence: "dumb!", "up,", "you."
const endsSentence = t => /[.!?,;:]$/.test(t.text);
const laughOnly = (toks, from, to) => { for (let j = from; j < to; j++) if (!saysOne(toks[j], LAUGH_W)) return false; return true; };
// the words toks[i..k-1] are the whole line, laughs aside
const wholeLine = (toks, i, k) => laughOnly(toks, 0, i) && laughOnly(toks, k, toks.length);
// AT_SOMEONE and YOU_OR_YOUR: the line or the sentence ends after them, or a laugh, a person or a knight's name comes next
const endsHere = (toks, k, names) => k >= toks.length || endsSentence(toks[k - 1]) || saysOne(toks[k], LAUGH_W) || saysOne(toks[k], PEOPLE_W) || nameAt(toks, k, names);
// SAID_TO_SOMEONE: the whole line, or a person or a knight's name comes next
const aimed = (toks, i, k, names) => wholeLine(toks, i, k) || saysOne(toks[k], PEOPLE_W) || nameAt(toks, k, names);

// Marks which whitespace-separated tokens of s are bad: on their own, as a phrase, or as letters spaced out.
// opts.names: the knights on line (a name after "shut up" or "go die" means it was said to someone); opts.name: s is a
// knight's name, where NAME_INSULTS count anywhere.
function markBad(s, opts) {
  const names = ((opts && opts.names) || []).map(n => prep(n)).filter(Boolean).map(n => n.split(' '));
  const inName = !!(opts && opts.name);
  const toks = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(s))) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length, bad: false, forms: null });
  for (const t of toks) {
    t.forms = forms(t.text);
    for (const f of t.forms) if (formBad(f) || (inName && NAME_W.has(f))) { t.bad = true; break; }
  }
  const mark = (i, k) => { for (let j = i; j < k; j++) toks[j].bad = true; };
  for (const words of PHRASES) for (let i = 0; i < toks.length; i++) { const k = saysAt(toks, i, words); if (k > 0) mark(i, k); }
  for (let i = 0; i < toks.length; i++) {
    // said about someone: you (are) (so / a / such an) <word>
    for (const [list, sure] of [[ABOUT_SURE, true], [ABOUT_MAYBE, false]]) for (const you of list) {
      const j = saysAt(toks, i, you); if (j < 0) continue;
      for (const mid of BETWEEN_W) {
        const w = saysAt(toks, j, mid); if (w < 0 || w >= toks.length || !saysOne(toks[w], ABOUT_W)) continue;
        if (sure || endsHere(toks, w + 1, names)) mark(i, w + 1);
      }
    }
    for (const words of AT_W) { const k = saysAt(toks, i, words); if (k > 0 && (endsHere(toks, k, names) || wholeLine(toks, i, k))) mark(i, k); }
    for (const words of TO_W) { const k = saysAt(toks, i, words); if (k > 0 && aimed(toks, i, k, names)) mark(i, k); }
    // a line that is only "gay" (gay! gaaay g4y) or only "loser" (laughs aside) is said at someone
    if (wholeLine(toks, i, i + 1) && saysOne(toks[i], ALONE_W)) mark(i, i + 1);
  }
  // f u c k: three or more single letters in a row read as one word
  for (let i = 0; i < toks.length; i++) {
    let j = i; while (j < toks.length && /^[a-z0-9@$!|+]$/i.test(toks[j].text)) j++;
    if (j - i >= 3 && isBadWord(toks.slice(i, j).map(t => t.text).join(''))) for (let k = i; k < j; k++) toks[k].bad = true;
    if (j > i) i = j - 1;
  }
  return toks;
}

// Chat: trimmed, whitespace collapsed, at most 120 characters, bad words replaced by asterisks of the same
// length. Answers {text, masked}: text is '' when nothing is left to say, and masked says whether any word had to be
// starred out (the world counts a word strike for that: docs/ONLINE.md, "Word strikes"). opts.names: the knights on line,
// so "shut up sam" is known to be said to Sam.
export function checkChat(s, opts) {
  if (typeof s !== 'string') return { text: '', masked: false };
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { text: '', masked: false };
  if (s.length > 120) s = s.slice(0, 120).trim();
  const toks = markBad(s, { names: opts && Array.isArray(opts.names) ? opts.names.filter(n => typeof n === 'string') : [] });
  let out = '', pos = 0, masked = false;
  for (const t of toks) {
    if (!t.bad) continue;
    masked = true;
    out += s.slice(pos, t.start) + '*'.repeat(t.end - t.start);
    pos = t.end;
  }
  out += s.slice(pos);
  return { text: out.trim(), masked };
}
// The masked line on its own (what the Room used to call; kept for anything that only wants the words).
export function cleanChat(s, opts) { return checkChat(s, opts).text; }

// Anything rude in a name: a bad word anywhere, an insult from NAME_INSULTS, or one hidden by spaces ("fu ck", "Stu Pid").
function nameBad(s) {
  if (markBad(s, { name: true }).some(t => t.bad)) return true;
  const joined = s.replace(/ /g, '');
  if (isBadWord(joined)) return true;
  for (const f of forms(joined)) if (NAME_W.has(f)) return true;
  return false;
}

// Names: 2 to 16 characters of letters, digits and single spaces, trimmed, nothing rude anywhere in them.
// Returns the tidied name, or null when it will not do.
export function cleanName(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 16) return null;
  if (!/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(s)) return null;
  if (RESERVED_NAMES.includes(s.toLowerCase())) return null;
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
