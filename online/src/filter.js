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
  // unkind words are not blocked by default; a parent who wants them gone adds them here, for example:
  // 'idiot', 'stupid', 'loser', 'moron',
];

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
const WORDS = new Set(), SQUEEZED = new Set(), PHRASES = [];
for (const raw of BLOCKED) {
  const w = unleet(String(raw), SWAP_I).replace(/\s+/g, ' ').trim();
  if (!w) continue;
  if (w.includes(' ')) PHRASES.push(w.split(' '));
  else { WORDS.add(w); SQUEEZED.add(squeeze(w)); }
}
const INSIDE = BLOCKED_INSIDE.map(w => unleet(String(w), SWAP_I).trim()).filter(Boolean);

// Every reading of one token: as typed, with edge punctuation dropped (fuck! -> fuck), both digit readings,
// and without a trailing s. All lower case.
function forms(tok) {
  const out = new Set();
  const bare = tok.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  for (const t of [tok, bare]) for (const sw of [SWAP_I, SWAP_L]) {
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

// Marks which whitespace-separated tokens of s are bad: on their own, as a phrase, or as letters spaced out.
function markBad(s) {
  const toks = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(s))) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length, bad: false, forms: null });
  for (const t of toks) { t.forms = forms(t.text); for (const f of t.forms) if (formBad(f)) { t.bad = true; break; } }
  for (const words of PHRASES) {
    for (let i = 0; i + words.length <= toks.length; i++) {
      let ok = true;
      for (let j = 0; j < words.length && ok; j++) if (!toks[i + j].forms.has(words[j])) ok = false;
      if (ok) for (let j = 0; j < words.length; j++) toks[i + j].bad = true;
    }
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
// length. Returns '' when nothing is left to say.
export function cleanChat(s) {
  if (typeof s !== 'string') return '';
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  if (s.length > 120) s = s.slice(0, 120).trim();
  const toks = markBad(s);
  let out = '', pos = 0;
  for (const t of toks) {
    if (!t.bad) continue;
    out += s.slice(pos, t.start) + '*'.repeat(t.end - t.start);
    pos = t.end;
  }
  out += s.slice(pos);
  return out.trim();
}

// Names: 2 to 16 characters of letters, digits and single spaces, trimmed, nothing rude anywhere in them.
// Returns the tidied name, or null when it will not do.
export function cleanName(s) {
  if (typeof s !== 'string') return null;
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 16) return null;
  if (!/^[A-Za-z0-9]+( [A-Za-z0-9]+)*$/.test(s)) return null;
  if (RESERVED_NAMES.includes(s.toLowerCase())) return null;
  if (markBad(s).some(t => t.bad)) return null;
  if (isBadWord(s.replace(/ /g, ''))) return null;   // "fu ck"
  return s;
}
