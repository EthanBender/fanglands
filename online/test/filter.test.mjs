// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_TALK, GAME_NAMES } from './game-talk.mjs';
import { cleanName, cleanChat, checkChat, nameRude, isStrikeWord, BLOCKED, BLOCKED_INSIDE, STRIKE_WORDS, STRIKE_INSIDE, INSULTS, GAY_INSULTS, LAUGHS, RESERVED_NAMES } from '../src/filter.js';

test('names: plain names pass, tidied', () => {
  assert.equal(cleanName('Cohen'), 'Cohen');
  assert.equal(cleanName('Sir Cohen'), 'Sir Cohen');
  assert.equal(cleanName('  Cohen  '), 'Cohen');
  assert.equal(cleanName('Co   hen'), 'Co hen');
  assert.equal(cleanName('Knight2'), 'Knight2');
  assert.equal(cleanName('Co'), 'Co');
  assert.equal(cleanName('Sixteen chars ok'), 'Sixteen chars ok');
});

test('names: too short, too long, wrong characters, not a string', () => {
  assert.equal(cleanName('C'), null);
  assert.equal(cleanName('Seventeen charact'), null);
  assert.equal(cleanName('Co-hen'), null);
  assert.equal(cleanName('Cohen!'), null);
  assert.equal(cleanName('Cohen_the_great'), null);
  assert.equal(cleanName(''), null);
  assert.equal(cleanName(42), null);
  assert.equal(cleanName(null), null);
});

test('names: rude words are refused, whole, spaced, leet and hidden inside', () => {
  assert.equal(cleanName('Shithead'), null);
  assert.equal(cleanName('Sh1thead'), null);
  assert.equal(cleanName('xXfuckerXx'), null);
  assert.equal(cleanName('fu ck'), null);
  assert.equal(cleanName('Big Tits'), null);
  assert.equal(cleanName('B00bs'), null);
  assert.equal(cleanName('Fvck'), null);
});

test('names: innocent names that contain short rude words still pass', () => {
  assert.equal(cleanName('Cassandra'), 'Cassandra');
  assert.equal(cleanName('Grape'), 'Grape');
  assert.equal(cleanName('Spicy'), 'Spicy');
  assert.equal(cleanName('Hancock'), 'Hancock');
  assert.equal(cleanName('Assassin'), 'Assassin');
});

test('names: reserved names are refused', () => {
  assert.equal(cleanName('admin'), null);
  assert.equal(cleanName('Server'), null);
  assert.equal(cleanName('SYSTEM'), null);
});

test('chat: trimmed, whitespace collapsed, 120 chars, empty stays empty', () => {
  assert.equal(cleanChat('hello there'), 'hello there');
  assert.equal(cleanChat('  you  are   cool '), 'you are cool');
  assert.equal(cleanChat('a\tb\nc'), 'a b c');
  assert.equal(cleanChat(''), '');
  assert.equal(cleanChat('    '), '');
  assert.equal(cleanChat(null), '');
  assert.equal(cleanChat(7), '');
  const long = 'x'.repeat(200);
  assert.equal(cleanChat(long).length, 120);
});

test('chat: bad words become asterisks of the same length, the rest is kept', () => {
  assert.equal(cleanChat('what the fuck'), 'what the ****');
  assert.equal(cleanChat('Fuck!'), '*****');
  assert.equal(cleanChat('he is a badass'), 'he is a ******');
  assert.equal(cleanChat('you dicks'), 'you *****');
  assert.equal(cleanChat('fuckfuckfuck'), '************');
});

test('chat: leetspeak, stretched and spaced-out spellings are caught', () => {
  assert.equal(cleanChat('sh1t'), '****');
  assert.equal(cleanChat('$hit happens'), '**** happens');
  assert.equal(cleanChat('B00bs'), '*****');
  assert.equal(cleanChat('fuuuuck'), '*******');
  assert.equal(cleanChat('asss'), '****');
  assert.equal(cleanChat('f u c k you'), '* * * * you');
  assert.equal(cleanChat('k y s'), '* * *');
});

test('chat: phrases are caught as a whole', () => {
  assert.equal(cleanChat('kill yourself'), '**** ********');
  assert.equal(cleanChat('kill ur self now'), '**** ** **** now');
});

test('chat: game words that only look rude are left alone', () => {
  assert.equal(cleanChat('kill the goblin'), 'kill the goblin');
  assert.equal(cleanChat('I made a hoe'), 'I made a hoe');
  assert.equal(cleanChat('class is in session'), 'class is in session');
  assert.equal(cleanChat('u r a bum'), 'u r a bum');
  assert.equal(cleanChat('cassandra grape spicy hancock'), 'cassandra grape spicy hancock');
  assert.equal(cleanChat('niger is a country'), 'niger is a country');
});

test('the lists are plain lower-case words a parent can edit', () => {
  assert.ok(BLOCKED.length > 100);
  for (const w of BLOCKED) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  for (const w of BLOCKED_INSIDE) assert.match(w, /^[a-z]+$/, w);
});

// ---------------------------------------------------------------------------
// Word strikes (docs/ONLINE.md, "Word strikes"). Round 5 redesign: a strike is ONLY a word on STRIKE_WORDS (swear words and
// slurs), whole or in a common disguise. Insults are starred out and never a strike, and who said it, who it was about and
// who is on line never matter. A kid is never punished on a guess.
// ---------------------------------------------------------------------------

test('checkChat: the masked line, whether anything was masked, and whether it is a strike; cleanChat is its text', () => {
  assert.deepEqual(checkChat('hello there'), { text: 'hello there', masked: false, strike: false });
  assert.deepEqual(checkChat('what the fuck'), { text: 'what the ****', masked: true, strike: true });
  assert.deepEqual(checkChat('f u c k you'), { text: '* * * * you', masked: true, strike: true });
  assert.deepEqual(checkChat('kill yourself'), { text: '**** ********', masked: true, strike: false });
  assert.deepEqual(checkChat('swanky'), { text: '******', masked: true, strike: false });
  assert.deepEqual(checkChat(''), { text: '', masked: false, strike: false });
  assert.deepEqual(checkChat(null), { text: '', masked: false, strike: false });
  assert.deepEqual(checkChat('   '), { text: '', masked: false, strike: false });
  for (const s of ['what the fuck', 'hello', 'you are gay', 'kill the goblin', 'x'.repeat(200)]) assert.equal(cleanChat(s), checkChat(s).text, s);
});

test('insults are starred out wherever they are, and are never a strike', () => {
  const want = {
    'you idiot': 'you *****', 'you are stupid': 'you are ******', 'ur a loser': 'ur a *****', 'ya so dumb': 'ya so ****', 'ya stupid': 'ya ******',
    'this boss is stupid hard': 'this boss is ****** hard', 'stupid lag': '****** lag', 'L0SER': '*****', 'st00pid': '*******', 'stuuupid': '********',
    'shut up': '**** **', 'shut up lol': '**** ** lol', 'SHUT UP LEO!! no way': '**** ** LEO!! no way', 'shut up sam': '**** ** sam', 'shutup': '******',
    'go die': '** ***', 'go die lol': '** *** lol', 'go die, it puts you back at town': '** **** it puts you back at town', 'just go die lol': 'just ** *** lol',
    'go die in a hole': '** *** ** * ****', 'go and die': '** *** ***', 'kill yourself': '**** ********', 'kys': '***', 'i hate you sam': 'i **** *** sam',
    'you are gay': '*** *** ***', 'ur gay': '** ***', "that's gay": '****** ***', 'this game is so gay': 'this game is ** ***', 'gay': '***', 'GAY!': '****',
    'gaaay': '*****', 'gay lol': '*** lol', 'gay?': '****', 'gaylord': '*******', 'stupidhead': '**********', 'nitwit': '******', 'idiot': '*****', 'MORON!': '******',
    'you jackass': 'you *******', 'you bastard': 'you *******', 'stfu': '****', 'gtfo': '****', 'wtf': '***', 'damn': '****', 'cum on': '*** on',
  };
  for (const [s, text] of Object.entries(want)) assert.deepEqual(checkChat(s), { text, masked: true, strike: false }, s);
  // "gay" anywhere else, and an insult word that is only spelled like one, are left alone
  for (const s of ['my uncle is gay', 'Sam is gay', "it's a gay old time", 'gay rights', 'hit the dummy', 'you win', 'you are cool', 'is that your sword', 'my armour is looser', 'Dumbledore', 'dumbbell'])
    assert.deepEqual(checkChat(s), { text: s, masked: false, strike: false }, s);
});

test('the lists are plain lower-case words a parent can edit; every strike word is starred out too; insults and mild words never strike', () => {
  for (const w of STRIKE_WORDS.concat(STRIKE_INSIDE, INSULTS, GAY_INSULTS, LAUGHS)) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  assert.ok(STRIKE_WORDS.length > 60);
  for (const w of STRIKE_WORDS) { assert.ok(!w.includes(' '), 'one word: ' + w); assert.ok(BLOCKED.includes(w) || INSULTS.includes(w) || checkChat(w).masked, w); }
  // what the owner said never counts: insults, phrases, mild words, and words that mean something else
  for (const w of INSULTS.concat(GAY_INSULTS, ['gay', 'stupid', 'dumb', 'idiot', 'loser', 'moron', 'shut up', 'go die', 'kill yourself', 'kys', 'hate you',
    'damn', 'crap', 'hell', 'piss', 'pissed', 'bastard', 'cock', 'prick', 'tit', 'tits', 'boob', 'pussy', 'fag', 'dyke', 'spic', 'coon', 'chink', 'tranny', 'homo',
    'negro', 'gook', 'wtf', 'stfu', 'gtfo', 'lmfao', 'cum', 'sex', 'porn', 'nazi', 'hitler', 'jackass', 'badass', 'douche', 'bugger', 'bollocks', 'suicide'])) {
    assert.ok(!STRIKE_WORDS.includes(w), w + ' is on STRIKE_WORDS');
    assert.equal(checkChat(w).strike, false, w);
  }
});

test('names: insults are refused at sign-up; nameRude flags an old name for what it says, not its shape', () => {
  for (const n of ['Stupid Sam', 'Gaylord', 'Gay Knight', 'Idiot', 'Big Loser', 'Dumb Dog', 'Stu Pid', 'Loser Leo', 'Moron', 'Sir Idiot']) { assert.equal(cleanName(n), null, n); assert.equal(nameRude(n), true, n); }
  for (const n of ['Cohen', 'MudGoll', 'Dumbledore', 'Big Dummy', 'Cassandra', 'Hancock', 'Fat Cat', 'Dumbo', 'Ugly Duckling', 'Sam Gay', 'Lol', 'Omg', 'Xd', 'Rn', 'Jk']) {
    assert.equal(cleanName(n), n, n); assert.equal(nameRude(n), false, n);
  }
  // shapes cleanName refuses that are not rude: an old name is never flagged for them
  for (const n of ['admin', 'A', 'Name with seventeen', 'Co-hen']) assert.equal(nameRude(n), false, n);
  for (const n of ['xXfuckerXx', 'fu ck', 'Sh1thead']) assert.equal(nameRude(n), true, n);
  assert.equal(nameRude(null), false); assert.equal(nameRude(''), false);
});

// Review round 2: mod_log writes `by: 'word filter'` for every strike and `by: 'parent page'` for the parent's changes. A
// knight with either name could pass for the filter in chat, and renaming it would rewrite every one of those rows.
test('names: "Word Filter" and "Parent Page" are reserved, with or without the space, in any capitals', () => {
  for (const n of ['Word Filter', 'word filter', 'WordFilter', 'WORDFILTER', 'Wor dFilter', 'Parent Page', 'ParentPage', 'parent page', 'Parent', 'Filter', 'Ad Min']) assert.equal(cleanName(n), null, n);
  assert.ok(RESERVED_NAMES.includes('word filter') && RESERVED_NAMES.includes('parent page'));
  for (const n of ['Words', 'Parents Pet', 'Page Boy', 'Wordsmith']) assert.equal(cleanName(n), n, n);
});

// Review round 3 finding 1: digits were read as letters, so a coin count was a strike (455 = ass, 8008 = boob, 7175 = tits).
test('a number is never masked and never a strike: every count from 0 to 99,999, with units, and in a sentence', () => {
  const units = ['', 'k', 'g', 'gp', 'xp', 'hp', 'm', 's', 'x'];
  let n = 0;
  for (let i = 0; i < 100000; i++) {
    for (const u of i % 97 === 0 || i < 10000 ? units : ['']) {
      const s = String(i) + u;
      const r = checkChat(s);
      if (r.masked || r.strike || r.text !== s) assert.fail(s + ' -> ' + JSON.stringify(r));
      n++;
    }
  }
  assert.ok(n > 100000);
  for (const s of ['455', '422', '8008', '7175', '5318008', '80085', '58008', '455k', '8008g', 'x8008', '#455', '$455', '4:55', '1,455,000', '45%', '3rd', '@555', '$5:55',
    'i have 455 coins', 'got 422 gold', '8008 xp to go', 'i need 7175 more', 'its 4:55 already', 'lvl 55', 'sell it for 455?', '455!', '(8008)', 'x2 455k', '4 5 5'])
    assert.deepEqual(checkChat(s), { text: s, masked: false, strike: false }, s);
});

// The disguises a strike word is caught in: every word of the list, every way.
const LEET = { a: ['4', '@'], s: ['5', '$'], i: ['1', '!'], o: ['0'], e: ['3'], t: ['7', '+'], l: ['1', '|'], g: ['9'], b: ['8'] };
function disguises(w) {
  const out = [w, w.toUpperCase(), w[0].toUpperCase() + w.slice(1), w + '!', w + '!!!', w + '?', w + '.', '"' + w + '"', '(' + w + ')', '#' + w, w + "'s", 'ok,' + w, w + '-you',
    'what the ' + w + ' lol', w + ' lol', 'lol ' + w, 'ya ' + w, 'u ' + w];
  // a letter held longer: any one letter three times, or the last letter twice when the word has no double letter
  for (let i = 0; i < w.length; i++) out.push(w.slice(0, i) + w[i].repeat(3) + w.slice(i + 1));
  if (!/(.)\1/.test(w)) out.push(w + w[w.length - 1]);
  // letters split up
  for (const sep of [' ', '.', '-', '_', '*', ' . ']) out.push(w.split('').join(sep));
  out.push(w.split('').join(' ') + '!');
  // a look-alike digit or symbol for one letter, inside the word (a "!" or "|" at either end is punctuation)
  for (let i = 0; i < w.length; i++) for (const c of LEET[w[i]] || []) {
    if ((i === 0 || i === w.length - 1) && /[!|+]/.test(c)) continue;
    out.push(w.slice(0, i) + c + w.slice(i + 1));
  }
  return out;
}
test('every word on the strike list is a strike, and so is each of its common disguises', () => {
  let n = 0;
  for (const w of STRIKE_WORDS) for (const s of disguises(w)) {
    const r = checkChat(s);
    if (!r.strike || !r.masked) assert.fail(JSON.stringify(s) + ' (' + w + ') -> ' + JSON.stringify(r));
    n++;
  }
  assert.ok(n > 3000, String(n));
  // by hand: the ones a kid really types
  for (const s of ['fuck', 'FUCK!', 'fuuuuck', 'fuckkk', 'fuckk', 'f u c k', 'f.u.c.k', 'f-u-c-k', 'fvck', 'phuck', 'fuk', 'xXfuckXx', 'fuckfuckfuck', 'motherfucker',
    'shit', 'sh1t', '$hit', 'sh!t', 'shiiit', 'shitt', 's h i t', 'bullshit', 'ass', 'a55', '@$$', '4ss', 'asss', 'a s s', 'asshole', 'a$$hole', 'b!tch', 'b1tch', 'biiitch',
    'bitchh', 'dick', 'd1ck', 'dickk', 'cunt', 'c u n t', 'whore', 'wh0re', 'slut', 'twat', 'wanker', 'nigger', 'n1gger', 'nigga', 'n i g g a', 'faggot', 'f@ggot',
    'retard', 'r3tard', 'retarded', 'kike', 'paki', 'p4ki', 'beaner', "shit's", 'ok,shit', 'fuck-you'])
    assert.equal(checkChat(s).strike, true, s);
  assert.ok(isStrikeWord('sh1t') && isStrikeWord('fuuuck') && !isStrikeWord('455') && !isStrikeWord('class') && !isStrikeWord('idiot'));
});

// never part of a longer ordinary word, never a contraction, never two words run together that only look like one
test('a word with a swear or a slur inside it is never a strike', () => {
  for (const s of ['class', 'grass', 'bass', 'assassin', 'assess', 'assesses', 'asses', 'annals', 'Shiite', 'Shiites', 'shiitake', 'shitake', 'Scunthorpe', 'Dickens',
    'cockpit', 'Hancock', 'niggle', 'niggling', 'snigger', 'Niger', 'Montenegro', 'retardant', 'fire retardant', 'therapist', 'grape', 'skyscraper', 'pakistan', 'whorl',
    'title', 'arsenal', 'parse', 'Sussex', 'analysis', 'cumulus', 'spicy', 'raccoon', 'booboo', 'swanky', 'pussycat', 'shirt', 'bitter', 'ditch', 'dicky', 'glitch',
    "who're you", "who're", 'go ok', 'go.ok', 'go,ok', 'go-ok', 'wan-king', 'who-res', 'pa-kis', 'as s', 'sh it', 'fu ck', 'di ck', 'pa ki', 'Bobb', 'kk', 'kkk', 'xxx', 'looser', 'gook', 'fukushima'])
    assert.equal(checkChat(s).strike, false, s + ' -> ' + JSON.stringify(checkChat(s)));
  // the whole dictionary, one word a line: a strike only when one whole word of the entry is itself on the list
  const dict = '/usr/share/dict/words';
  if (!fs.existsSync(dict)) return;
  const set = new Set(STRIKE_WORDS);
  let n = 0, struck = 0;
  for (const w of fs.readFileSync(dict, 'utf8').split('\n')) {
    if (!w) continue; n++;
    if (!checkChat(w).strike) continue;
    struck++;
    if (!w.toLowerCase().split(/[\s-]+/).some(p => set.has(p))) assert.fail(w + ' is a strike');
  }
  assert.ok(n > 200000 && struck < 30, n + ' words, ' + struck + ' strikes');
});

test('ordinary kid chat is never a strike: game talk, "ya", insults, slang, numbers, and words with a swear inside', () => {
  for (const s of GAME_TALK) { const r = checkChat(s); assert.equal(r.strike, false, s + ' -> ' + JSON.stringify(r)); }
  assert.ok(GAME_TALK.length > 550, String(GAME_TALK.length));
  for (const s of ['ya so dumb', 'shut up lol', 'go die lol', 'SHUT UP LEO!! no way', 'you idiot', 'gay', 'kys', '455', 'class', 'lol']) assert.ok(GAME_TALK.includes(s), s);
});

// Every NPC, place, item, quest, boss and line of talk in the game is a string in src/: a kid typing any of them is no
// strike, as the whole string or any word of it.
test('every name and line in the game is no strike, whole or word by word', () => {
  const dir = new URL('../../src/', import.meta.url);
  const strs = new Set();
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(new URL(f, dir), 'utf8');
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g)) {
      const s = (m[1] ?? m[2] ?? m[3]).replace(/\\n/g, ' ').replace(/\\(.)/g, '$1');
      if (/[a-z]{2}/i.test(s)) strs.add(s);
    }
  }
  assert.ok(strs.size > 3000, String(strs.size));
  const words = new Set();
  for (const s of strs) {
    for (const w of s.split(/\s+/)) if (w) words.add(w);
    if (checkChat(s).strike) assert.fail(JSON.stringify(s) + ' -> ' + checkChat(s).text);
  }
  for (const w of words) if (checkChat(w).strike) assert.fail(JSON.stringify(w) + ' is a strike');
  for (const s of ['Aldous the banker', 'Gnasher', 'Ironclad', 'the Fang', 'Cinderwight', 'Thistledown', 'Ashfields', 'Hollowford', 'MudGoll', 'Barrelbeast',
    'Ginormous Golem', 'Ash drake', 'Spider Den', 'Cloud Kingdom', 'goblin city', 'Royal Mine', 'Aerie', 'Ashedge', 'Bank of Thistledown', 'Tobin'])
    assert.equal(checkChat(s).strike, false, s);
});

// Round 5: the line alone decides. Names of knights on line (Goblin, Lol, Omg, Sam...) change nothing, and the old
// {names} option is ignored.
test('who is on line never changes what counts', () => {
  for (const s of GAME_TALK.concat(['shit', 'you idiot', 'shut up sam', 'go die goblin', 'fuck you leo'])) assert.deepEqual(checkChat(s, { names: GAME_NAMES }), checkChat(s), s);
});

test('a strike is always starred out: nothing that counts reaches another screen', () => {
  const words = [].concat(BLOCKED, STRIKE_WORDS, INSULTS, GAY_INSULTS, ['sam', 'goblin', 'lol', '.']);
  for (const a of words) for (const b of ['', 'sam', 'goblin', 'lol', 'idiot', 'you', 'gay', 'die', 'shit', 'a55']) {
    const s = (a + ' ' + b).trim(), r = checkChat(s);
    if (r.strike && !r.masked) assert.fail(s);
    if (r.strike && /\b(fuck|shit|cunt|bitch|nigg)/i.test(r.text)) assert.fail(s + ' -> ' + r.text);
  }
});
