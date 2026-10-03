// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { GAME_TALK, GAME_NAMES } from './game-talk.mjs';
import { gameWords, fileText, OUT as GAME_WORDS_FILE } from '../../tools/game-words.mjs';
import { cleanName, cleanChat, checkChat, nameRude, BLOCKED, BLOCKED_INSIDE, INSULTS, SAID_ABOUT_YOU, YOU_ARE, YOU_OR_YOUR, BETWEEN, GAY_INSULTS, GAY_SAID, AT_SOMEONE, SAID_TO_SOMEONE, AIM_BEFORE, AIM_AFTER, LINE_ALONE, PEOPLE, AIMED_AT, AFTER_YOU, ASKING, REPORTED, LAUGHS, NAME_INSULTS, MASK_ONLY, RESERVED_NAMES } from '../src/filter.js';

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
// Word strikes (docs/ONLINE.md, "Word strikes"): the filter says whether it had to star anything out, and whether that was
// surely a bad word said as a bad word (a strike). Three strikes is 24 hours out for a ten-year-old, so the strike side is
// held to "never for game talk": masking may be generous, a strike may not.
// ---------------------------------------------------------------------------
const N = { names: ['Sam', 'Leo', 'Sir Zorbo', 'Big Dummy'] };
const res = (s, opts) => checkChat(s, opts || N);

test('checkChat: the masked line, whether anything was masked, and whether it is a strike; cleanChat is its text', () => {
  assert.deepEqual(checkChat('hello there'), { text: 'hello there', masked: false, strike: false });
  assert.deepEqual(checkChat('what the fuck'), { text: 'what the ****', masked: true, strike: true });
  assert.deepEqual(checkChat('f u c k you'), { text: '* * * * you', masked: true, strike: true });
  assert.deepEqual(checkChat('kill yourself'), { text: '**** ********', masked: true, strike: true });
  assert.deepEqual(checkChat('swanky'), { text: '******', masked: true, strike: false });
  assert.deepEqual(checkChat(''), { text: '', masked: false, strike: false });
  assert.deepEqual(checkChat(null), { text: '', masked: false, strike: false });
  assert.deepEqual(checkChat('   '), { text: '', masked: false, strike: false });
  for (const s of ['what the fuck', 'hello', 'you are gay', 'kill the goblin', 'x'.repeat(200)]) assert.equal(cleanChat(s), checkChat(s).text, s);
});

test('insults are masked: plain insults, and words said about someone', () => {
  assert.deepEqual(checkChat('you idiot'), { text: '*** *****', masked: true, strike: true });
  // about a monster it is no insult: only what is said AT someone counts (3 strikes is 24 hours out)
  assert.deepEqual(checkChat('this stupid goblin'), { text: 'this stupid goblin', masked: false, strike: false });
  // "you stupid goblin" is a kid shouting at a monster: starred out, never a strike
  assert.deepEqual(checkChat('you stupid goblin'), { text: '*** ****** goblin', masked: true, strike: false });
  assert.deepEqual(checkChat('L0SER'), { text: '*****', masked: true, strike: false });
  assert.deepEqual(checkChat('shut up'), { text: '**** **', masked: true, strike: false });
  assert.deepEqual(checkChat('you dumb'), { text: '*** ****', masked: true, strike: true });
  assert.deepEqual(checkChat('ur so ugly'), { text: '** ** ****', masked: true, strike: true });
  assert.deepEqual(checkChat('u r dumb'), { text: '* * ****', masked: true, strike: true });
  assert.deepEqual(checkChat("you're fat"), { text: '****** ***', masked: true, strike: true });
});

test('"gay" used as an insult is masked; other uses are not', () => {
  for (const s of ['you are gay', 'ur gay', 'Ur Gay', 'u r gay', "you're gay", 'you’re gay', 'youre so gay', 'your gay', "that's gay", 'thats so gay', 'its gay', 'this is gay', 'so gay', 'gay boy', 'gay noob', 'gay', 'GAY!', 'gaaay', 'g4y', 'gaylord', 'Gayboy', 'u gaaay']) {
    assert.equal(checkChat(s).masked, true, s);
    assert.ok(!/gay/i.test(checkChat(s).text), s + ' -> ' + checkChat(s).text);
  }
  // said about nobody: left alone (and "is gay" on purpose, see filter.js)
  for (const s of ['my uncle is gay', 'Sam is gay', "it's a gay old time", 'gay rights', 'the dumb goblin', 'fat dragon', 'hit the dummy', 'you win', 'you are cool', 'is that your sword']) assert.deepEqual(checkChat(s), { text: s, masked: false, strike: false }, s);
});

test('the insult lists are plain lower-case words a parent can edit', () => {
  for (const w of INSULTS.concat(SAID_ABOUT_YOU, YOU_ARE, GAY_INSULTS, GAY_SAID, MASK_ONLY)) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  for (const w of YOU_OR_YOUR.concat(BETWEEN, AT_SOMEONE, SAID_TO_SOMEONE, AIM_BEFORE, AIM_AFTER, LINE_ALONE, PEOPLE, AIMED_AT, AFTER_YOU, ASKING, REPORTED, LAUGHS, NAME_INSULTS)) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  assert.ok(SAID_ABOUT_YOU.includes('idiot') && SAID_ABOUT_YOU.includes('stupid') && SAID_ABOUT_YOU.includes('gay'));
  // the words a kid says about the game all evening are never on a list that counts anywhere in a line
  for (const w of ['stupid', 'loser', 'idiot', 'moron', 'dumbo', 'go die', 'shut up', 'hate you']) assert.ok(!INSULTS.includes(w) && !BLOCKED.includes(w), w);
  assert.ok(!YOU_ARE.includes('your') && !YOU_ARE.includes('ur') && !YOU_ARE.includes('yur'));
  // every mild word is on the list it is starred out by, so it is still starred out
  for (const w of MASK_ONLY) assert.ok(BLOCKED.includes(w), w);
  for (const w of GAY_SAID) assert.ok(GAY_INSULTS.includes(w), w);
});

test('names: insults are refused at sign-up; nameRude flags an old name for what it says, not its shape', () => {
  for (const n of ['Stupid Sam', 'Gaylord', 'Gay Knight', 'Idiot', 'Big Loser']) { assert.equal(cleanName(n), null, n); assert.equal(nameRude(n), true, n); }
  for (const n of ['Cohen', 'MudGoll', 'Dumbledore', 'Big Dummy', 'Cassandra', 'Hancock']) { assert.equal(cleanName(n), n, n); assert.equal(nameRude(n), false, n); }
  // shapes cleanName refuses that are not rude: an old name is never flagged for them
  for (const n of ['admin', 'A', 'Name with seventeen', 'Co-hen']) assert.equal(nameRude(n), false, n);
  for (const n of ['xXfuckerXx', 'fu ck', 'Sh1thead']) assert.equal(nameRude(n), true, n);
  assert.equal(nameRude(null), false); assert.equal(nameRude(''), false);
});

test('names: NAME_INSULTS count anywhere in a name, spaced out too; harmless names still pass', () => {
  for (const n of ['Stu Pid', 'Loser Leo', 'Moron', 'Sir Idiot']) assert.equal(cleanName(n), null, n);
  for (const n of ['Fat Cat', 'Dumbo', 'Big Dummy', 'Ugly Duckling', 'Sam Gay']) assert.equal(cleanName(n), n, n);
});

// Review round 2: mod_log writes `by: 'word filter'` for every strike and `by: 'parent page'` for the parent's changes. A
// knight with either name could pass for the filter in chat, and renaming it would rewrite every one of those rows.
test('names: "Word Filter" and "Parent Page" are reserved, with or without the space, in any capitals', () => {
  for (const n of ['Word Filter', 'word filter', 'WordFilter', 'WORDFILTER', 'Wor dFilter', 'Parent Page', 'ParentPage', 'parent page', 'Parent', 'Filter', 'Ad Min']) assert.equal(cleanName(n), null, n);
  assert.ok(RESERVED_NAMES.includes('word filter') && RESERVED_NAMES.includes('parent page'));
  // a name that only starts like one is fine
  for (const n of ['Words', 'Parents Pet', 'Page Boy', 'Wordsmith']) assert.equal(cleanName(n), n, n);
});

// ---------------------------------------------------------------------------
// The most important rule: a kid is never warned, struck or kept out for something that is not clearly a bad word aimed
// as a bad word. Each list below is said with two knights on line (Sam and Leo, and "Big Dummy"), as the Room says it.
// ---------------------------------------------------------------------------

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
  for (const s of ['455', '422', '8008', '7175', '5318008', '80085', '58008', '455k', '8008g', 'x8008', '#455', '$455', '4:55', '1,455,000', '45%', '3rd',
    'i have 455 coins', 'got 422 gold', '8008 xp to go', 'i need 7175 more', 'its 4:55 already', 'lvl 55', 'sell it for 455?', '455!', '(8008)', 'x2 455k'])
    assert.deepEqual(res(s), { text: s, masked: false, strike: false }, s);
  // spaced out digits are a number too
  assert.deepEqual(res('4 5 5'), { text: '4 5 5', masked: false, strike: false });
  // a word with digits AND letters may still be starred out (sh1t, a55), but digits are never read for a strike
  for (const s of ['sh1t', 'a55', 'B00bs', 'fvck1ng', '5hit']) { assert.equal(res(s).masked, true, s); assert.equal(res(s).strike, false, s); }
});

// Review round 3 finding 1: a bad word hidden inside an ordinary word was a strike.
test('a bad word hidden inside an ordinary word is never a strike (it may be starred out)', () => {
  for (const s of ['booboo', 'swanky', 'pussycat', 'fire retardant', 'Montenegro', 'Scunthorpe', 'shitake mushrooms', 'cockpit', 'peacock', 'Hancock',
    'assassin', 'class', 'grass', 'bass', 'cocktail', 'Dickens', 'Sussex', 'analysis', 'therapist', 'grape', 'drape', 'skyscraper', 'button', 'titan', 'title',
    'raccoon', 'tycoon', 'cocoon', 'spicy', 'niggle', 'snigger', 'arsenal', 'assume', 'bassoon', 'cumulus', 'document', 'scrapbook', 'butter', 'shell', 'hello',
    'Matsushita', 'penistone', 'sexton', 'Essex', 'twatch', 'shitzu', 'cockatrice', 'hoe', 'dumbbell', 'Bobb', 'Bobbies', 'kk', 'xx', 'kkk', 'xxx', 'xxxx',
    // review round 4, finding 6: two of a letter, or a word ending in "ss", is how ordinary words are spelled
    'assess', 'assesses', 'annals', 'annal', 'Shiite', 'Shiites', 'rappe', 'looser', 'lets assess the damage', 'read the annals', 'you looser', 'ur a looser'])
    assert.equal(res(s).strike, false, s + ' -> ' + JSON.stringify(res(s)));
  // and the ones a kid really types are not starred out either
  for (const s of ['class', 'grass', 'bass', 'cockpit', 'assassin', 'title', 'raccoon', 'cocoon', 'kk', 'xx', 'Bobb', 'hello']) assert.equal(res(s).masked, false, s);
});

// Review round 3 finding 2 and the "mild words" minor: game talk that was a strike, with the reason each one is not.
test('game talk is never a strike: about a boss, the lag, lava, a pet, yourself, a question, somebody else, or a surprised shout', () => {
  const lines = GAME_TALK;
  for (const s of lines) {
    const r = res(s);
    assert.equal(r.strike, false, s + ' -> ' + JSON.stringify(r));
  }
  assert.ok(lines.length > 200, String(lines.length));
});

// Every NPC, place, item, quest, boss and line of talk in the game is a string in src/: a kid typing any of them is no
// strike, as the whole string or any word of it.
function gameStringsSaid(opts) {
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
    const r = checkChat(s, opts);
    if (r.strike) assert.fail(JSON.stringify(s) + ' -> ' + r.text);
  }
  for (const w of words) if (checkChat(w, opts).strike) assert.fail(JSON.stringify(w) + ' is a strike');
  // the names a kid says most, by hand as well
  for (const s of ['Aldous the banker', 'Gnasher', 'Ironclad', 'the Fang', 'Cinderwight', 'Thistledown', 'Ashfields', 'Hollowford', 'MudGoll', 'Barrelbeast',
    'Ginormous Golem', 'Ash drake', 'Spider Den', 'Cloud Kingdom', 'goblin city', 'Royal Mine', 'Aerie', 'Ashedge', 'Bank of Thistledown', 'Tobin'])
    assert.equal(checkChat(s, opts).strike, false, s);
  return strs.size;
}
test('every name and line in the game is no strike, whole or word by word', () => { gameStringsSaid(N); });

// Review round 4, finding 1: a knight on line named Goblin (or Dragon, Boss, King, Wolf, Bro, Now...) turned "you stupid
// goblin" into a strike, and three of those were 24 hours out. A name counts for a strike only when it can be nobody but
// that knight: not when every word of it is a word of the game or of every day.
test('knights on line named Goblin, Dragon, Boss, King, Wolf, Bro, Dude or Now: game talk and every game string are still no strike', () => {
  const opts = { names: GAME_NAMES.concat(['Sam', 'Leo']) };
  for (const s of GAME_TALK) { const r = checkChat(s, opts); assert.equal(r.strike, false, s + ' -> ' + JSON.stringify(r)); }
  // each name alone on line too (one name can never stand for another)
  for (const n of GAME_NAMES) for (const s of GAME_TALK) if (checkChat(s, { names: [n] }).strike) assert.fail(n + ' on line: ' + s);
  assert.ok(gameStringsSaid(opts) > 3000);
  // the name is still starred out after an insult (masking stays generous), and a name that is nobody else still counts
  assert.deepEqual(checkChat('shut up goblin', { names: ['Goblin'] }), { text: '**** ** goblin', masked: true, strike: false });
  assert.deepEqual(checkChat('you stupid goblin', { names: ['Goblin'] }), { text: '*** ****** goblin', masked: true, strike: false });
  assert.equal(checkChat('shut up sam', opts).strike, true);
  assert.equal(checkChat('you idiot leo', opts).strike, true);
  // real people the game's own text names ("A game by Cohen", "Ask Ethan") still count as a person
  assert.equal(checkChat('shut up cohen', { names: ['Cohen'] }).strike, true);
  assert.equal(checkChat('go die ethan', { names: ['Ethan'] }).strike, true);
});

// The game words are made from src/ by tools/game-words.mjs (build.sh runs it): the file the filter imports must be today's.
test('online/src/gamewords.js is made from src/ as it is today (run ./build.sh after changing the game)', () => {
  const words = gameWords();
  assert.equal(fs.readFileSync(GAME_WORDS_FILE, 'utf8'), fileText(words), 'online/src/gamewords.js is out of date: run ./build.sh');
  assert.ok(words.length > 2000, String(words.length));
  for (const w of ['goblin', 'dragon', 'gnasher', 'boss', 'king', 'wolf', 'fang', 'golem', 'spider', 'dummy', 'thistledown', 'tobin']) assert.ok(words.includes(w), w);
  // the self-tests' made-up knights are not words of the game
  for (const w of ['sam', 'leo', 'zed', 'mudgoll']) assert.ok(!words.includes(w), w);
});

test('insults said at someone are a strike: after "you", to a knight or a person who ends the sentence, or as the whole line', () => {
  const want = {
    'you idiot': '*** *****', 'you are stupid': '*** *** ******', 'ur a loser': '** * *****', 'ur stupid': '** ******',
    'u r stupid': '* * ******', 'your so stupid': '**** ** ******', "you're such an idiot": '****** **** ** *****', 'you big idiot': '*** *** *****',
    'ur dumb': '** ****', 'ur dumb lol': '** **** lol', 'your dumb': '**** ****', 'see ya loser': 'see ** *****', 'you dumb!': '*** *****',
    'you idiot i had that': '*** ***** i had that', 'you are so dumb at this': '*** *** ** **** at this', 'you stupid noob': '*** ****** noob',
    'you dumb nerd': '*** **** nerd', 'you moron lol': '*** ***** lol', 'thank you idiot': 'thank *** *****', 'you idiot sam': '*** ***** sam',
    'you are a moron.': '*** *** * ******', 'you idiots': '*** ******', 'you gay noob': '*** *** ****',
    'shut up sam': '**** ** sam', 'shut up sir zorbo': '**** ** sir zorbo', 'shut up noob': '**** ** noob', 'shut up you': '**** ** you', 'shut up sam!': '**** ** sam!',
    'ok shut up sam. nobody asked': 'ok **** ** sam. nobody asked', 'hate you Sam': '**** *** Sam', 'i hate you sam': 'i **** *** sam', 'i hate you noob lol': 'i **** *** noob lol',
    'go die': '** ***', 'go die noob': '** *** noob', 'go die sam': '** *** sam', 'just go die': '**** ** ***', 'go die in a hole': '** *** ** * ****',
    'pls go die': '*** ** ***', 'go die already': '** *** *******', 'go and die': '** *** ***', 'ok go die.': 'ok ** ****',
    'kill yourself': '**** ********', 'pls kill yourself': 'pls **** ********', 'kill yourself noob': '**** ******** noob', 'kys': '***',
    'you idiot, sam': '*** ****** sam', 'go die, sam': '** **** sam', 'shut up, sam': '**** *** sam', 'you idiot; sam': '*** ****** sam', 'kill yourself, noob': '**** ********* noob',
    'go die lol': '** *** lol', 'go die.': '** ****', 'lol go die': 'lol ** ***', 'you stupid, noob': '*** ******* noob',
    'you are gay': '*** *** ***', 'ur gay': '** ***', "that's gay": '****** ***', 'this game is so gay': 'this game is ** ***', 'thats gay lol': '***** *** lol',
    'gay': '***', 'GAY!': '****', 'gaaay': '*****', 'gaylord': '*******',
    'what the fuck': 'what the ****', 'fuck': '****', 'FUCK!': '*****', 'fuuuck': '******', 'shit': '****', '$hit happens': '**** happens', 'sh!t': '****',
    'f u c k': '* * * *', 'f u c k you': '* * * * you', 'bitch': '*****', 'you bitch': 'you *****', 'asshole': '*******', 'dumbass': '*******', 'asss': '****',
    'stfu': '****', 'gtfo': '****', 'dick': '****', 'dickhead': '********', 'whore': '*****', 'slut': '****', 'faggot': '******', 'retard': '******',
    'you retard': 'you ******', 'porn': '****', 'boobs': '*****', 'motherfucker': '************', 'heil hitler': '**** ******', 'stupidhead': '**********', 'nitwit': '******',
    'you jackass': '*** *******', 'you bastard': '*** *******', 'you pussy': '*** *****', 'u fag': '* ***',
  };
  for (const [s, text] of Object.entries(want)) assert.deepEqual(res(s), { text, masked: true, strike: true }, s);
  // but more words after a comma or a full stop: help, not an insult (review round 4, finding 2)
  for (const s of ['go die, it puts you back at town', 'go die. its faster than walking', 'go die, you respawn']) assert.equal(res(s).strike, false, s);
  assert.ok(Object.keys(want).length > 90);
  // a name only counts for a knight the world says is on line
  assert.equal(checkChat('shut up leo', { names: ['Sam'] }).strike, false);
  assert.equal(checkChat('shut up leo', { names: ['Leo'] }).strike, true);
});

// Review round 4, finding 8: a line that is only "idiot" or "loser" is often a kid talking about himself after a death. Starred
// out, no strike, until the owner says otherwise (LINE_ALONE_STRIKE). A line that is only "gay" still is, but not as a question.
test('a lone idiot, loser or moron is starred out and no strike; a lone "gay" is a strike, "gay?" is not', () => {
  const want = { 'idiot': '*****', 'idiot!': '******', 'lol idiot': 'lol *****', 'lol loser': 'lol *****', 'loser': '*****', 'loser lol': '***** lol', 'MORON!': '******',
    'loser!!!': '********', 'imbecile': '********', 'idiots': '******', 'gay?': '****', 'gay lol?': '*** lol?' };
  for (const [s, text] of Object.entries(want)) assert.deepEqual(res(s), { text, masked: true, strike: false }, s);
  for (const s of ['gay', 'GAY!', 'gay lol', 'gaaay']) assert.equal(res(s).strike, true, s);
});

test('a strike is always starred out: nothing that counts reaches another screen', () => {
  const all = ['you idiot', 'go die', 'shut up sam', 'kys', 'f u c k', 'fuuuck', 'heil hitler', 'thats gay', 'gay lol', 'ok go die.', 'you are so dumb at this'];
  for (const s of all) { const r = res(s); assert.ok(r.strike && r.masked, s); }
  // and over every two-word line the lists can make, a strike is never left unmasked
  const words = [].concat(BLOCKED, INSULTS, SAID_ABOUT_YOU, YOU_ARE, YOU_OR_YOUR, AT_SOMEONE, SAID_TO_SOMEONE, LINE_ALONE, AIMED_AT, ['sam', 'goblin', 'lol', '.']);
  for (const a of words) for (const b of ['', 'sam', 'goblin', 'lol', 'idiot', 'you', 'gay', 'die']) {
    const s = (a + ' ' + b).trim(), r = res(s);
    if (r.strike && !r.masked) assert.fail(s);
  }
});
