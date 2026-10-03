// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const N = { names: ['Sam', 'Leo', 'Big Dummy'] };
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
    'Matsushita', 'penistone', 'sexton', 'Essex', 'twatch', 'shitzu', 'cockatrice', 'hoe', 'dumbbell', 'Bobb', 'Bobbies', 'kk', 'xx', 'kkk', 'xxx', 'xxxx'])
    assert.equal(res(s).strike, false, s + ' -> ' + JSON.stringify(res(s)));
  // and the ones a kid really types are not starred out either
  for (const s of ['class', 'grass', 'bass', 'cockpit', 'assassin', 'title', 'raccoon', 'cocoon', 'kk', 'xx', 'Bobb', 'hello']) assert.equal(res(s).masked, false, s);
});

// Review round 3 finding 2 and the "mild words" minor: game talk that was a strike, with the reason each one is not.
test('game talk is never a strike: about a boss, the lag, lava, a pet, yourself, a question, somebody else, or a surprised shout', () => {
  const lines = [
    // about the game, a monster or yourself
    'this boss is stupid hard', 'lets go die to the dragon again', 'stupid lag', 'ur dumb sword is cool', 'your fat dragon pet',
    'your ugly ogre', 'im gonna go die in the lava', 'dont go die', 'my stupid brother', 'idiot proof plan', 'Dumbo the elephant',
    "I'm such a loser lol", 'I am stupid', 'the stupid goblin keeps hitting me', 'i am a loser at this', 'go die goblin', 'i hate you goblin king',
    'your fat dragon is cool', 'your dumb pet', 'your ugly sweater lol', 'your fat stack of coins', 'see ya later', 'is that your sword',
    'the dumb goblin', 'you win', 'you are cool', 'my uncle is gay', 'im an idiot', "i'm such an idiot", 'I am so dumb', 'what an idiot i am',
    'idiot me fell in the lava', 'i feel so dumb', 'pls go die dragon', 'go die already boss', 'just go die to the boss lol', 'i always go die in a hole',
    // finding 2 (1): a "you" that ends one sentence never joins the next
    'thank you. stupid lag', 'thank you! stupid goblin hit me', 'got you. dumb boss is down', 'love you. idiot me fell in lava', 'see you. loser gets the last loot',
    'i got you, stupid troll is dead', 'u there? dumb question but where is the bank', 'thank u. ugly hat though', 'are you on? fat dragon is up',
    'mine not you. stupid me', 'after you. dumb door is stuck',
    // finding 2 (2): taunting a monster after "you"
    'you stupid goblin', 'you dumb dragon get back here', 'you ugly troll', 'you fat slime', 'take that you stupid spider', 'u r a dumb boss',
    'you stupid rock golem', 'die you ugly bat', 'you idiot goblin you missed', 'you dumb chicken', 'you fat ogre', 'you big ugly brute',
    // finding 2 (3): a surprised "no way!", somebody else's words, or "i hate you" to a boss
    'shut up!', 'SHUT UP!!', 'shut up, you got the dragon?', 'shut up no way', 'shut up dude no way', 'shut up dude!', 'shut up shut up shut up', 'ok shut up!',
    'shut up no way!', 'shut up and take my coins', 'shut up you got the sword?', 'shut up you guys this is amazing',
    'my mom said shut up', 'my mom says go die is mean', 'he said you idiot to me', 'my sister called me a loser', 'dont say shut up', 'he told me to go die',
    'you can type shut up?', 'she typed you are dumb', 'i hate you', 'i hate you!', 'ugh i hate you boss', 'i hate you so much dragon', 'hate you lava',
    // questions
    'are you stupid?', 'are you dumb', 'do you think im stupid', 'r u dumb or what', 'did you fat finger it',
    // mild words: starred out, never a strike (filter.js, MASK_ONLY)
    'damn', 'dammit i died', 'wtf', 'wtf was that', 'lmfao', 'crap', 'oh crap the boss', 'that sword is badass', 'a bastard sword', 'a chink in his armour',
    'the cock crowed', 'a blue tit', 'blue tits in the tree', 'suicide mission', 'sexy armor', 'i thot so', 'naked knight lol', 'prick your finger on the thorn',
    'jackass', 'the nazis in ww2', 'hitler was bad', 'what sex is your knight', 'love you xxx', 'kkkk', 'bugger', 'piss off', 'pissed off at this boss',
    'can you kill yourself with a bomb', 'dont kill yourself in the lava', 'how do you kill yourself to respawn', 'it’s gay pride week', "it's a gay old time",
    'my uncle is a gay guy', 'there is a gay kid in my class', 'gay rights', 'L0SER', 'id10t', 'st00pid',
    // everyday kid talk
    'gg', 'gg wp', 'ez', 'brb', 'afk', 'omg', 'lol', 'lmao', 'xd', 'kk', 'ok', 'k', 'np', 'ty', 'thx', 'hi', 'hey sam', 'sup leo', 'wanna trade',
    'can u help me kill the dragon', 'you are so good at this', 'u r so fast', 'ur so lucky', 'your so lucky', 'you big hero', 'you are a legend',
    "you're a pro", 'ur the best', 'you got a big sword', 'is your knight a boy or a girl', 'follow me', 'where is the bank', 'i need wood',
    'kill the goblin', 'I made a hoe', 'class is in session', 'u r a bum', 'niger is a country', 'hit the dummy', 'die die die', 'kill it kill it',
    'i died again', 'the boss killed me', 'shoot the bat', 'smash the rock', 'nice hat', 'lets go', 'come on', 'wait for me', 'whats your level',
    'i got the fang', 'whos the keeper', 'go to the island', 'build a house', 'my house is cool', 'you can come to my house', 'i have a dragon',
    'you go first', 'you take the left side', 'you have more hp', 'you are on fire lol', 'you missed', 'you got this', 'u ok?', 'u there', 'ur turn',
    'your turn', 'your house is huge', 'your pet is so cute', 'you need a better sword', 'you need to eat food', 'are you coming', 'can you give me 455 coins',
    'i will give you 8008 gold', 'trade you 422 logs', 'you owe me 7175 coins', 'whats 455 plus 422', 'i hit 5318008 dmg lol', 'boss has 8008 hp',
    'the goblin king is dumb lol', 'that was so stupid lol', 'stupid me', 'dumb me', 'oops my bad', 'my bad sorry', 'no way', 'no way you got it',
    'that boss is ugly', 'the troll is fat', 'what a loser goblin', 'idiot goblin', 'moron troll walked into lava', 'ha loser goblin',
  ];
  for (const s of lines) {
    const r = res(s);
    assert.equal(r.strike, false, s + ' -> ' + JSON.stringify(r));
  }
  assert.ok(lines.length > 200, String(lines.length));
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
    const r = checkChat(s, N);
    if (r.strike) assert.fail(JSON.stringify(s) + ' -> ' + r.text);
  }
  for (const w of words) if (checkChat(w, N).strike) assert.fail(JSON.stringify(w) + ' is a strike');
  // the names a kid says most, by hand as well
  for (const s of ['Aldous the banker', 'Gnasher', 'Ironclad', 'the Fang', 'Cinderwight', 'Thistledown', 'Ashfields', 'Hollowford', 'MudGoll', 'Barrelbeast',
    'Ginormous Golem', 'Ash drake', 'Spider Den', 'Cloud Kingdom', 'goblin city', 'Royal Mine', 'Aerie', 'Ashedge', 'Bank of Thistledown', 'Tobin'])
    assert.equal(checkChat(s, N).strike, false, s);
});

test('insults said at someone are a strike: after "you", to a knight or a person who ends the sentence, or as the whole line', () => {
  const want = {
    'you idiot': '*** *****', 'you are stupid': '*** *** ******', 'ur a loser': '** * *****', 'ur stupid': '** ******',
    'u r stupid': '* * ******', 'your so stupid': '**** ** ******', "you're such an idiot": '****** **** ** *****', 'you big idiot': '*** *** *****',
    'ur dumb': '** ****', 'ur dumb lol': '** **** lol', 'your dumb': '**** ****', 'see ya loser': 'see ** *****', 'you dumb!': '*** *****',
    'you idiot i had that': '*** ***** i had that', 'you are so dumb at this': '*** *** ** **** at this', 'you stupid noob': '*** ****** noob',
    'you dumb nerd': '*** **** nerd', 'you moron lol': '*** ***** lol', 'thank you idiot': 'thank *** *****', 'you idiot sam': '*** ***** sam',
    'you are a moron.': '*** *** * ******', 'you idiots': '*** ******', 'you gay noob': '*** *** ****',
    'shut up sam': '**** ** sam', 'shut up big dummy': '**** ** big dummy', 'shut up noob': '**** ** noob', 'shut up you': '**** ** you', 'shut up sam!': '**** ** sam!',
    'ok shut up sam, nobody asked': 'ok **** ** sam, nobody asked', 'hate you Sam': '**** *** Sam', 'i hate you sam': 'i **** *** sam', 'i hate you noob lol': 'i **** *** noob lol',
    'go die': '** ***', 'go die noob': '** *** noob', 'go die sam': '** *** sam', 'just go die': '**** ** ***', 'go die in a hole': '** *** ** * ****',
    'pls go die': '*** ** ***', 'go die already': '** *** *******', 'go and die': '** *** ***', 'ok go die.': 'ok ** ****',
    'kill yourself': '**** ********', 'pls kill yourself': 'pls **** ********', 'kill yourself noob': '**** ******** noob', 'kys': '***',
    'loser lol': '***** lol', 'idiot': '*****', 'MORON!': '******', 'loser': '*****',
    'you are gay': '*** *** ***', 'ur gay': '** ***', "that's gay": '****** ***', 'this game is so gay': 'this game is ** ***', 'thats gay lol': '***** *** lol',
    'gay': '***', 'GAY!': '****', 'gaaay': '*****', 'gaylord': '*******',
    'what the fuck': 'what the ****', 'fuck': '****', 'FUCK!': '*****', 'fuuuck': '******', 'shit': '****', '$hit happens': '**** happens', 'sh!t': '****',
    'f u c k': '* * * *', 'f u c k you': '* * * * you', 'bitch': '*****', 'you bitch': 'you *****', 'asshole': '*******', 'dumbass': '*******', 'asss': '****',
    'stfu': '****', 'gtfo': '****', 'dick': '****', 'dickhead': '********', 'whore': '*****', 'slut': '****', 'faggot': '******', 'retard': '******',
    'you retard': 'you ******', 'porn': '****', 'boobs': '*****', 'motherfucker': '************', 'heil hitler': '**** ******', 'stupidhead': '**********', 'nitwit': '******',
    'you jackass': '*** *******', 'you bastard': '*** *******', 'you pussy': '*** *****', 'u fag': '* ***',
  };
  for (const [s, text] of Object.entries(want)) assert.deepEqual(res(s), { text, masked: true, strike: true }, s);
  assert.ok(Object.keys(want).length > 90);
  // a name only counts for a knight the world says is on line
  assert.equal(checkChat('shut up leo', { names: ['Sam'] }).strike, false);
  assert.equal(checkChat('shut up leo', { names: ['Leo'] }).strike, true);
});

test('a strike is always starred out: nothing that counts reaches another screen', () => {
  const all = ['you idiot', 'go die', 'shut up sam', 'kys', 'f u c k', 'fuuuck', 'heil hitler', 'thats gay', 'loser lol', 'ok go die.', 'you are so dumb at this'];
  for (const s of all) { const r = res(s); assert.ok(r.strike && r.masked, s); }
  // and over every two-word line the lists can make, a strike is never left unmasked
  const words = [].concat(BLOCKED, INSULTS, SAID_ABOUT_YOU, YOU_ARE, YOU_OR_YOUR, AT_SOMEONE, SAID_TO_SOMEONE, LINE_ALONE, AIMED_AT, ['sam', 'goblin', 'lol', '.']);
  for (const a of words) for (const b of ['', 'sam', 'goblin', 'lol', 'idiot', 'you', 'gay', 'die']) {
    const s = (a + ' ' + b).trim(), r = res(s);
    if (r.strike && !r.masked) assert.fail(s);
  }
});
