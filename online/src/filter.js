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
  'kill your self',
  'heil hitler',
  'suicide',
  'nazi', 'nazis', 'hitler', 'heil', 'kkk',
  'cocaine', 'heroin', 'meth',
];

// Masking and striking are two different things. Starring a word out is harmless, so the masking above is generous: a
// word hidden inside another (swanky, pussycat, Scunthorpe), a look-alike spelling (sh1t, a55) and a mild word all get
// stars. A STRIKE is 24 hours out after three, so it needs a sure match (checkChat's `strike`):
//   - a plain number is never a strike, and never even masked (455, 8008, 7175, 455k, x8008): digits are read as letters
//     only inside a word that has letters too, and never for a strike;
//   - a word hidden inside an ordinary word is never a strike (booboo, swanky, pussycat, retardant, Montenegro);
//   - the words below are starred out but are never a strike on their own: they are mild, or a kid has an everyday
//     reason to type them in a knight game ("damn", "wtf", "that sword is badass", "a bastard sword", "a chink in his
//     armour", "the cock crowed", "a blue tit", "suicide mission", "sexy armour", "i thot so").
// Some of them are still a strike when said about someone ("you jackass", "you pussy": see SAID_ABOUT_YOU).
export const MASK_ONLY = [
  'damn', 'dammit', 'goddamn', 'goddammit', 'crap', 'crappy', 'wtf', 'lmfao', 'effing', 'badass', 'bugger', 'bollocks',
  'piss', 'pissed', 'pissing', 'bastard', 'bastards', 'jackass', 'douche', 'cock', 'cocks', 'prick', 'pricks',
  'tit', 'tits', 'boob', 'boner', 'boners', 'thot', 'thots', 'xxx', 'kkk', 'horny',
  'sex', 'sexy', 'sexual', 'sexting', 'nude', 'nudes', 'naked', 'penis', 'penises', 'vagina', 'vaginas', 'pussy', 'pussies',
  'nsfw', 'erotic', 'fetish', 'condom', 'condoms', 'scrotum', 'testicle', 'testicles', 'nipple', 'nipples', 'butthole', 'anus',
  'negro', 'negros', 'homo', 'homos', 'midget', 'injun', 'coon', 'coons', 'spick', 'chink', 'chinks', 'dyke', 'dykes',
  'fag', 'fags', 'tranny', 'trannies',
  'suicide', 'nazi', 'nazis', 'hitler', 'heil', 'cocaine', 'heroin', 'meth',
];

// Insults (owner, 2026-10-03: "insults count as well as swear words, including 'gay' used as an insult"). A knight is kept
// out for 24 hours after three, so only what is said AT someone counts: kids in a fighting game say "this boss is stupid
// hard", "stupid lag", "lets go die to the dragon again" and "I'm such a loser lol" all evening, and none of that is a strike.
// Words that are an insult wherever they are (nobody calls a goblin a nitwit by accident):
export const INSULTS = [
  'stupidhead', 'dumbhead', 'dimwit', 'nitwit', 'halfwit', 'numbskull', 'bonehead', 'fatso',
  'gaylord', 'gayboy', 'gaywad', 'gayass', 'ghey',
  // these are starred out anywhere, but a strike only when said to someone (SAID_TO_SOMEONE)
  'go die in a hole', 'just go die', 'pls go die', 'plz go die', 'please go die', 'go die already', 'go and die',
];
// Words that are only an insult when they are said about someone: right after "you" ("you idiot", "you are so dumb",
// "you're a loser", "u r stupid"). On their own they are left alone: "the dumb goblin", "this boss is stupid hard", "my stupid
// brother", "an idiot proof plan", "Dumbo the elephant", "I'm such a loser lol", "a gay old time".
// "Sam is gay" and "my uncle is gay" read the same to a word list, so "is gay" is left off on purpose; a parent who wants it
// caught adds 'is gay' to INSULTS. The last line is MASK_ONLY words that are an insult when said about someone.
export const SAID_ABOUT_YOU = [
  'gay', 'dumb', 'ugly', 'fat', 'fatty', 'stupid', 'idiot', 'idiots', 'idiotic', 'moron', 'morons', 'moronic',
  'loser', 'losers', 'imbecile', 'dumbo',
  'jackass', 'bastard', 'douche', 'prick', 'pussy', 'fag', 'homo', 'dyke', 'tranny', 'midget', 'chink', 'coon', 'negro',
];
// "you" for sure: the word after it (or after one of BETWEEN) is said about someone.
export const YOU_ARE = ['you', 'u', 'youre', 'ure', 'you are', 'u are', 'u r', 'you r'];
// "you're" or "your", which a word list cannot tell apart: "ur dumb" is an insult, "ur dumb sword is cool" is not. These
// count only when the word ends the line or the sentence ("ur dumb", "your gay!", "see ya loser"), or one of AFTER
// comes next ("ur dumb lol"); never when another word follows it ("your fat dragon", "your ugly ogre").
export const YOU_OR_YOUR = ['ur', 'your', 'yur', 'ya'];
// Little words that may sit in between: "you are SO dumb", "ur A loser", "you're SUCH AN idiot", "you BIG idiot".
export const BETWEEN = ['so', 'a', 'an', 'such', 'such a', 'such an', 'big', 'a big', 'total', 'a total', 'really', 'very'];
// 'gay' in the ways it is used as an insult: "that's gay", "so gay", "gay boy", or a line that is only "gay". All starred out.
export const GAY_INSULTS = [
  'thats gay', 'that is gay', 'its gay', 'it is gay', 'this is gay', 'how gay', 'so gay', 'too gay', 'very gay', 'super gay',
  'such a gay', 'gay boy', 'gay kid', 'gay guy', 'gay noob', 'gay knight', 'gay baby', 'gay person',
];
// Of those, a strike only when it ends the line or the sentence ("this game is so gay", "thats gay lol"); never before
// another word ("it's gay pride week"). "gay boy", "gay guy" and the rest are starred out but are no strike on their own:
// "my uncle is a gay guy" reads the same to a word list ("you gay noob" is, by SAID_ABOUT_YOU).
export const GAY_SAID = ['thats gay', 'that is gay', 'its gay', 'it is gay', 'this is gay', 'how gay', 'so gay', 'too gay', 'very gay', 'super gay'];
// Starred out when they end the line or the sentence, before a person, or as the whole line ("shut up", "ok shut up!", "i
// hate you"). A strike only when a knight on line or one of AIMED_AT comes next and ends the sentence ("shut up sam", "shut
// up noob", "i hate you sam"): "shut up!" is also a surprised "no way!", "i hate you" is said to bosses, and "my mom said
// shut up" is somebody else talking.
export const AT_SOMEONE = ['shut up', 'shutup', 'hate you', 'hate u', 'hate ya'];
// Starred out as the whole line ("go die", "kill yourself", "go die in a hole") or before a person ("go die noob"); "kill
// yourself" is starred out anywhere. A strike only as the whole sentence (one of AIM_BEFORE may come first, one of
// AIM_AFTER after: "just go die", "go die already", "pls kill yourself") or before a person who ends the sentence ("go die
// noob", "kill yourself sam"); never "dont go die", "lets go die to the dragon again", "can you kill yourself with a bomb".
export const SAID_TO_SOMEONE = ['go die', 'go and die', 'go die in a hole', 'kill yourself', 'kill urself', 'kill ur self', 'kill your self'];
export const AIM_BEFORE = ['just', 'pls', 'plz', 'please', 'ok', 'okay', 'now', 'so', 'then', 'and', 'yeah', 'well'];
export const AIM_AFTER = ['already', 'now', 'pls', 'plz', 'please', 'then'];
// A line that is only one of these (laughs aside: "loser lol") is said at someone, and is a strike.
export const LINE_ALONE = ['gay', 'idiot', 'idiots', 'moron', 'morons', 'loser', 'losers', 'imbecile'];
// People: after AT_SOMEONE, SAID_TO_SOMEONE or YOU_OR_YOUR, these mean the words were aimed at someone (so does the name of
// any knight on line, which the world passes in). For starring out.
export const PEOPLE = ['you', 'u', 'ur', 'ya', 'noob', 'noobs', 'kid', 'dude', 'bro', 'nerd', 'loser', 'idiot', 'moron'];
// The people that make it a strike: "dude" and "bro" are left off ("shut up dude, no way!" is a surprised shout).
export const AIMED_AT = ['you', 'u', 'noob', 'noobs', 'nerd', 'nerds', 'loser', 'losers', 'idiot', 'idiots', 'moron', 'morons', 'baby', 'cheater'];
// After "you idiot" these still leave it said at someone ("you idiot i had that", "you are so dumb at this"); any other word
// might be what the insult is about ("you stupid goblin" is a kid shouting at a monster), so it is no strike.
export const AFTER_YOU = ['and', 'at', 'to', 'too', 'now', 'or', 'but', 'because', 'cuz', 'bc', 'i', 'im', 'ever', 'again', 'for', 'who', 'like', 'lol'];
// A question is no strike: "are you stupid?", "do you think im dumb".
export const ASKING = ['are', 'r', 'were', 'was', 'is', 'do', 'did', 'does', 'can', 'could', 'would', 'will', 'should'];
// Somebody else's words: anything after these in the same sentence is no strike ("my mom said shut up", "he told me to go die").
export const REPORTED = ['said', 'says', 'say', 'saying', 'told', 'tell', 'tells', 'telling', 'called', 'call', 'calls', 'calling', 'typed', 'type', 'wrote', 'asked', 'ask', 'asks', 'like'];
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
// 'word filter' and 'parent page' are who the What admins did list says made a strike or a change (mod_log `by`): a knight with
// that name would be renamed along with every row of it, and could chat as if it were the filter. Spaces do not count here
// ("Word Filter", "WordFilter" and "Wor dfilter" are all refused).
export const RESERVED_NAMES = ['admin', 'server', 'system', 'world', 'fanglands', 'moderator', 'mod', 'keeper', 'ethan', 'word filter', 'parent page', 'parent', 'filter'];

// ---------- putting swapped letters back ----------
// 1 can be an i or an l, | likewise; both readings are tried.
const SWAP_I = { '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't', '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g' };
const SWAP_L = Object.assign({}, SWAP_I, { '1': 'l', '|': 'i' });
// For a strike only symbols are read as letters ($hit, sh!t, @$$), never digits.
const SYM_I = { '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };
const SYM_L = Object.assign({}, SYM_I, { '|': 'i' });
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
// A number, with or without a unit or a sign: 455, 8008, 7175, 4:55, 1,000, 455k, 8008g, 50xp, x2, #3, $455, 3rd, 45%.
// Its digits are never read as letters.
const NUMBER = /^[#$x×+\-~]?\d[\d.,:/%+\-]*(k|m|b|g|gp|gold|coins?|xp|hp|mp|dmg|x|s|st|nd|rd|th|lvl|lv|am|pm|min|mins|sec|secs|s|h|hr|hrs|d|kg|lb|lbs|ft|km)?$/i;
const isNumber = tok => NUMBER.test(tok.replace(/^[^a-z0-9#$+\-~×]+|[^a-z0-9%]+$/gi, ''));

// The list, prepared once. Whole words go in WORDS; stretched words match a word only when they hold its letters longer
// (plain "as" never matches "ass", but "asss" does). Phrases keep their words.
const prep = raw => unleet(String(raw), SWAP_I).replace(/\s+/g, ' ').trim();
const split = list => list.map(prep).filter(Boolean).map(w => w.split(' '));
const MILD = new Set(MASK_ONLY.map(prep));
const WORDS = new Set(), PHRASES = [], STRIKE_WORDS = new Set(), STRIKE_PHRASES = [];
const TO_W = split(SAID_TO_SOMEONE);
const holds = (words, part) => { for (let i = 0; i + part.length <= words.length; i++) if (part.every((w, j) => words[i + j] === w)) return true; return false; };
for (const raw of BLOCKED.concat(INSULTS, GAY_INSULTS)) {
  const w = prep(raw);
  if (!w) continue;
  const strikes = !MILD.has(w) && !GAY_INSULTS.includes(raw);
  if (w.includes(' ')) {
    const ws = w.split(' ');
    PHRASES.push(ws);
    // a phrase with "go die" or "kill yourself" in it is a strike only when said to someone (SAID_TO_SOMEONE)
    if (strikes && !TO_W.some(p => holds(ws, p))) STRIKE_PHRASES.push(ws);
  } else { WORDS.add(w); if (strikes) STRIKE_WORDS.add(w); }
}
const SQUEEZED = new Map();   // squeezed form -> the words it could be, for stretched spellings
for (const w of WORDS) { const q = squeeze(w); if (!SQUEEZED.has(q)) SQUEEZED.set(q, []); SQUEEZED.get(q).push(w); }
const INSIDE = BLOCKED_INSIDE.map(w => unleet(String(w), SWAP_I).trim()).filter(Boolean);
const ABOUT_SURE = split(YOU_ARE), ABOUT_MAYBE = split(YOU_OR_YOUR), BETWEEN_W = [[]].concat(split(BETWEEN));
const ABOUT_W = SAID_ABOUT_YOU.map(prep), AT_W = split(AT_SOMEONE), GAY_W = split(GAY_SAID);
const ALONE_W = LINE_ALONE.map(prep), PEOPLE_W = PEOPLE.map(prep), LAUGH_W = LAUGHS.map(prep), NAME_W = new Set(NAME_INSULTS.map(prep));
const AIMED_W = AIMED_AT.map(prep), AFTER_YOU_W = AFTER_YOU.map(prep), ASKING_W = ASKING.map(prep), REPORTED_W = REPORTED.map(prep);
const BEFORE_W = AIM_BEFORE.map(prep), TRAIL_W = AIM_AFTER.map(prep);

// Every reading of one token for starring out: as typed, with edge punctuation dropped (fuck! -> fuck), both digit
// readings, and without a trailing s. All lower case. A number is read only as itself.
function forms(tok) {
  const out = new Set();
  const bare = tok.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
  if (isNumber(tok)) { out.add(bare.toLowerCase()); return out; }
  // you're, that's, it's (straight or curly apostrophe) read as youre, thats, its
  const joined = bare.replace(/['’]/g, '');
  for (const t of [tok, bare, joined]) for (const sw of [SWAP_I, SWAP_L]) {
    const n = unleet(t, sw);
    if (!n) continue;
    out.add(n);
    if (n.length > 3 && n.endsWith('s')) out.add(n.slice(0, -1));
  }
  return out;
}
// The readings that may count as a strike: letters only, symbols read as letters but never digits, the sentence's
// punctuation dropped ("shit!" -> shit, "$hit" -> shit), apostrophes dropped (you're -> youre), and without a trailing s.
function sureForms(tok) {
  const out = new Set();
  const t = tok.replace(/^["'(\[]+|[.!?,;:"')\]]+$/g, '');
  for (const x of [t, t.replace(/['’]/g, '')]) for (const sw of [SYM_I, SYM_L]) {
    const n = x.toLowerCase().replace(/[@$!|+]/g, c => sw[c]);
    if (!/^[a-z]+$/.test(n)) continue;
    out.add(n);
    if (n.length > 3 && n.endsWith('s')) out.add(n.slice(0, -1));
  }
  return out;
}
const stretchedIn = (f, set) => { if (!stretched(f)) return false; for (const w of SQUEEZED.get(squeeze(f)) || []) if ((!set || set.has(w)) && stretchOf(f, w)) return true; return false; };
function formBad(f) {
  if (WORDS.has(f) || stretchedIn(f)) return true;
  for (const w of INSIDE) if (f.includes(w)) return true;
  return false;
}
// a whole word on the strike list, as typed or held longer: never one hidden inside another word
const formSure = f => STRIKE_WORDS.has(f) || stretchedIn(f, STRIKE_WORDS);
export function isBadWord(tok) {
  for (const f of forms(tok)) if (formBad(f)) return true;
  return false;
}
const isSureWord = tok => { for (const f of sureForms(tok)) if (formSure(f)) return true; return false; };

// One token says this word of a phrase: as typed, or stretched (so gaaay, ur -> urrr). key: 'forms' to star out, 'sforms' to strike.
const saysWord = (t, w, key) => { const fs = t[key || 'forms']; if (fs.has(w)) return true; for (const f of fs) if (stretched(f) && stretchOf(f, w)) return true; return false; };
// toks[i...] says these words, one token each: the index just after them, or -1
const saysAt = (toks, i, words, key) => {
  if (i < 0 || i + words.length > toks.length) return -1;
  for (let j = 0; j < words.length; j++) if (!saysWord(toks[i + j], words[j], key)) return -1;
  return i + words.length;
};
const saysOne = (t, list, key) => !!t && list.some(w => saysWord(t, w, key));
// a knight's name (or its first words) starts at toks[i]: the index just after it, or -1
const nameEnd = (toks, i, names, key) => { for (const n of names) { const k = saysAt(toks, i, n, key); if (k > i) return k; } return -1; };
const nameAt = (toks, i, names) => nameEnd(toks, i, names) > i;
// the token ends a sentence: "dumb!", "up,", "you."
const endsSentence = t => /[.!?,;:]["')\]]*$/.test(t.text);
// none of toks[i..k-1] ends a sentence before the last of them: "thank you. stupid lag" is two sentences
const oneSentence = (toks, i, k) => { for (let j = i; j < k - 1; j++) if (endsSentence(toks[j])) return false; return true; };
const laughOnly = (toks, from, to) => { for (let j = from; j < to; j++) if (!saysOne(toks[j], LAUGH_W)) return false; return true; };
// the words toks[i..k-1] are the whole line, laughs aside
const wholeLine = (toks, i, k) => laughOnly(toks, 0, i) && laughOnly(toks, k, toks.length);
// AT_SOMEONE and YOU_OR_YOUR: the line or the sentence ends after them, or a laugh, a person or a knight's name comes next
const endsHere = (toks, k, names) => k >= toks.length || endsSentence(toks[k - 1]) || saysOne(toks[k], LAUGH_W) || saysOne(toks[k], PEOPLE_W) || nameAt(toks, k, names);
// SAID_TO_SOMEONE: the whole line, or a person or a knight's name comes next
const aimed = (toks, i, k, names) => wholeLine(toks, i, k) || saysOne(toks[k], PEOPLE_W) || nameAt(toks, k, names);

// ---------- what is sure enough to be a strike ----------
const S = 'sforms';   // the token's sure readings (sureForms)
// the first token of the sentence toks[i] is in
const sentenceStart = (toks, i) => { let j = i - 1; while (j >= 0 && !endsSentence(toks[j])) j--; return j + 1; };
// somebody else's words: "said", "told" and the like earlier in the same sentence
const reported = (toks, i) => { for (let j = sentenceStart(toks, i); j < i; j++) if (saysOne(toks[j], REPORTED_W, S)) return true; return false; };
// the sentence ends after toks[k-1], laughs allowed in between ("ur dumb lol", "shut up sam haha.")
const endsAfter = (toks, k) => {
  if (k >= toks.length || endsSentence(toks[k - 1])) return true;
  for (let j = k; j < toks.length && saysOne(toks[j], LAUGH_W, S); j++) if (j === toks.length - 1 || endsSentence(toks[j])) return true;
  return false;
};
// a knight on line or one of AIMED_AT at toks[k], and the sentence ends with it: the index after it, or -1
const personEnd = (toks, k, names) => {
  if (k >= toks.length || endsSentence(toks[k - 1])) return -1;
  let e = saysOne(toks[k], AIMED_W, S) ? k + 1 : nameEnd(toks, k, names, S);
  return e > k && endsAfter(toks, e) ? e : -1;
};

// Marks which whitespace-separated tokens of s are bad (to be starred out) and which are sure (a strike): on their own,
// as a phrase, or as letters spaced out. opts.names: the knights on line (a name after "shut up" or "go die" means it was
// said to someone); opts.name: s is a knight's name, where NAME_INSULTS count anywhere. Every sure token is also bad.
function markBad(s, opts) {
  const names = ((opts && opts.names) || []).map(n => prep(n)).filter(Boolean).map(n => n.split(' '));
  const inName = !!(opts && opts.name);
  const toks = [];
  const re = /\S+/g; let m;
  while ((m = re.exec(s))) toks.push({ text: m[0], start: m.index, end: m.index + m[0].length, bad: false, sure: false, forms: null, sforms: null });
  for (const t of toks) {
    t.forms = forms(t.text);
    t.sforms = sureForms(t.text);
    for (const f of t.forms) if (formBad(f) || (inName && NAME_W.has(f))) { t.bad = true; break; }
    for (const f of t.sforms) if (formSure(f)) { t.sure = true; break; }
  }
  const mark = (i, k) => { for (let j = i; j < k; j++) toks[j].bad = true; };
  const strike = (i, k) => { for (let j = i; j < k; j++) toks[j].bad = toks[j].sure = true; };
  for (const words of PHRASES) for (let i = 0; i < toks.length; i++) { const k = saysAt(toks, i, words); if (k > 0) mark(i, k); }
  for (const words of STRIKE_PHRASES) for (let i = 0; i < toks.length; i++) { const k = saysAt(toks, i, words, S); if (k > 0) strike(i, k); }
  for (let i = 0; i < toks.length; i++) {
    // said about someone: you (are) (so / a / such an) <word>
    for (const [list, sure] of [[ABOUT_SURE, true], [ABOUT_MAYBE, false]]) for (const you of list) {
      const j = saysAt(toks, i, you); if (j < 0) continue;
      for (const mid of BETWEEN_W) {
        const w = saysAt(toks, j, mid); if (w < 0 || w >= toks.length || !saysOne(toks[w], ABOUT_W)) continue;
        if (!oneSentence(toks, i, w + 1)) continue;   // "thank you. stupid lag": the "you" belongs to another sentence
        if (sure || endsHere(toks, w + 1, names)) mark(i, w + 1);
      }
      // the strike: the same words read surely (no digits), in one sentence, not a question, not somebody else's words,
      // and nothing after the word that it could be about ("you stupid goblin" is said to a monster)
      const js = saysAt(toks, i, you, S); if (js < 0) continue;
      if (reported(toks, i) || (i > sentenceStart(toks, i) && saysOne(toks[i - 1], ASKING_W, S))) continue;
      for (const mid of BETWEEN_W) {
        const w = saysAt(toks, js, mid, S); if (w < 0 || w >= toks.length || !saysOne(toks[w], ABOUT_W, S)) continue;
        if (!oneSentence(toks, i, w + 1)) continue;
        const k = w + 1;
        const after = endsAfter(toks, k) || personEnd(toks, k, names) > 0 || (sure && (saysOne(toks[k], AIMED_W, S) || nameEnd(toks, k, names, S) > k || saysOne(toks[k], AFTER_YOU_W, S)));
        if (after) strike(i, k);
      }
    }
    for (const words of AT_W) {
      const k = saysAt(toks, i, words); if (k > 0 && (endsHere(toks, k, names) || wholeLine(toks, i, k))) mark(i, k);
      const ks = saysAt(toks, i, words, S); if (ks > 0 && !reported(toks, i) && personEnd(toks, ks, names) > 0) strike(i, ks);
    }
    for (const words of TO_W) {
      const k = saysAt(toks, i, words); if (k > 0 && aimed(toks, i, k, names)) mark(i, k);
      const ks = saysAt(toks, i, words, S); if (ks < 0 || reported(toks, i)) continue;
      // the whole sentence ("just go die", "go die already."), or said to a person who ends it ("go die noob")
      let st = sentenceStart(toks, i), from = i; while (from > st && saysOne(toks[from - 1], BEFORE_W.concat(LAUGH_W), S)) from--;
      let e = ks; while (e < toks.length && !endsSentence(toks[e - 1]) && saysOne(toks[e], TRAIL_W.concat(LAUGH_W), S)) e++;
      if ((from === st && endsAfter(toks, e)) || personEnd(toks, ks, names) > 0) strike(i, ks);
    }
    for (const words of GAY_W) { const ks = saysAt(toks, i, words, S); if (ks > 0 && !reported(toks, i) && endsAfter(toks, ks)) strike(i, ks); }
    // a line that is only "gay" (gay! gaaay g4y) or only "loser" (laughs aside) is said at someone
    if (wholeLine(toks, i, i + 1) && saysOne(toks[i], ALONE_W)) { mark(i, i + 1); if (saysOne(toks[i], ALONE_W, S)) strike(i, i + 1); }
  }
  // f u c k: three or more single letters in a row read as one word (a strike only when they are all letters)
  for (let i = 0; i < toks.length; i++) {
    let j = i; while (j < toks.length && /^[a-z0-9@$!|+]$/i.test(toks[j].text)) j++;
    if (j - i >= 3) {
      const word = toks.slice(i, j).map(t => t.text).join('');
      if (isBadWord(word)) mark(i, j);
      if (/^[a-z@$!|+]+$/i.test(word) && isSureWord(word)) strike(i, j);
    }
    if (j > i) i = j - 1;
  }
  return toks;
}

// Chat: trimmed, whitespace collapsed, at most 120 characters, bad words replaced by asterisks of the same length.
// Answers {text, masked, strike}: text is '' when nothing is left to say; masked says whether any word had to be starred
// out; strike says whether one of them was surely a bad word said as a bad word, which the world counts as a word strike
// (docs/ONLINE.md, "Word strikes"). A strike is always masked too; a masked line is often no strike (a number, a word hidden
// in another, a mild word, an insult that might be about a monster). opts.names: the knights on line, so "shut up sam" is
// known to be said to Sam.
export function checkChat(s, opts) {
  if (typeof s !== 'string') return { text: '', masked: false, strike: false };
  s = s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { text: '', masked: false, strike: false };
  if (s.length > 120) s = s.slice(0, 120).trim();
  const toks = markBad(s, { names: opts && Array.isArray(opts.names) ? opts.names.filter(n => typeof n === 'string') : [] });
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
// The masked line on its own (what the Room used to call; kept for anything that only wants the words).
export function cleanChat(s, opts) { return checkChat(s, opts).text; }

const RESERVED = new Set(RESERVED_NAMES.map(n => n.replace(/ /g, '')));

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
  if (RESERVED.has(s.toLowerCase().replace(/ /g, ''))) return null;
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
