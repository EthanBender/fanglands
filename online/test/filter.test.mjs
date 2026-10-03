// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanChat, checkChat, nameRude, BLOCKED, BLOCKED_INSIDE, INSULTS, SAID_ABOUT_YOU, YOU_ARE, GAY_INSULTS } from '../src/filter.js';

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
// Word strikes (docs/ONLINE.md, "Word strikes"): the filter says whether it had to star anything out
// ---------------------------------------------------------------------------
test('checkChat: the masked line and whether anything was masked; cleanChat is its text', () => {
  assert.deepEqual(checkChat('hello there'), { text: 'hello there', masked: false });
  assert.deepEqual(checkChat('what the fuck'), { text: 'what the ****', masked: true });
  assert.deepEqual(checkChat('f u c k you'), { text: '* * * * you', masked: true });
  assert.deepEqual(checkChat('kill yourself'), { text: '**** ********', masked: true });
  assert.deepEqual(checkChat(''), { text: '', masked: false });
  assert.deepEqual(checkChat(null), { text: '', masked: false });
  assert.deepEqual(checkChat('   '), { text: '', masked: false });
  for (const s of ['what the fuck', 'hello', 'you are gay', 'kill the goblin', 'x'.repeat(200)]) assert.equal(cleanChat(s), checkChat(s).text, s);
});

test('insults are masked and counted: plain insults, and words said about someone', () => {
  assert.deepEqual(checkChat('you idiot'), { text: 'you *****', masked: true });
  assert.deepEqual(checkChat('this stupid goblin'), { text: 'this ****** goblin', masked: true });
  assert.deepEqual(checkChat('L0SER'), { text: '*****', masked: true });
  assert.deepEqual(checkChat('shut up'), { text: '**** **', masked: true });
  assert.deepEqual(checkChat('you dumb'), { text: '*** ****', masked: true });
  assert.deepEqual(checkChat('ur so ugly'), { text: '** ** ****', masked: true });
  assert.deepEqual(checkChat('u r dumb'), { text: '* * ****', masked: true });
  assert.deepEqual(checkChat("you're fat"), { text: '****** ***', masked: true });
});

test('"gay" used as an insult is masked; other uses are not', () => {
  for (const s of ['you are gay', 'ur gay', 'Ur Gay', 'u r gay', "you're gay", 'you’re gay', 'youre so gay', 'your gay', "that's gay", 'thats so gay', 'its gay', 'this is gay', 'so gay', 'gay boy', 'gay noob', 'gay', 'GAY!', 'gaaay', 'g4y', 'gaylord', 'Gayboy', 'u gaaay']) {
    assert.equal(checkChat(s).masked, true, s);
    assert.ok(!/gay/i.test(checkChat(s).text), s + ' -> ' + checkChat(s).text);
  }
  // said about nobody: left alone (and "is gay" on purpose, see filter.js)
  for (const s of ['my uncle is gay', 'Sam is gay', "it's a gay old time", 'gay rights', 'the dumb goblin', 'fat dragon', 'hit the dummy', 'you win', 'you are cool', 'is that your sword']) assert.deepEqual(checkChat(s), { text: s, masked: false }, s);
});

test('the insult lists are plain lower-case words a parent can edit', () => {
  for (const w of INSULTS.concat(SAID_ABOUT_YOU, YOU_ARE, GAY_INSULTS)) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  assert.ok(INSULTS.includes('idiot') && INSULTS.includes('stupid') && SAID_ABOUT_YOU.includes('gay'));
});

test('names: insults are refused at sign-up; nameRude flags an old name for what it says, not its shape', () => {
  for (const n of ['Stupid Sam', 'Gaylord', 'Gay Knight', 'Idiot', 'Big Loser']) { assert.equal(cleanName(n), null, n); assert.equal(nameRude(n), true, n); }
  for (const n of ['Cohen', 'MudGoll', 'Dumbledore', 'Big Dummy', 'Cassandra', 'Hancock']) { assert.equal(cleanName(n), n, n); assert.equal(nameRude(n), false, n); }
  // shapes cleanName refuses that are not rude: an old name is never flagged for them
  for (const n of ['admin', 'A', 'Name with seventeen', 'Co-hen']) assert.equal(nameRude(n), false, n);
  for (const n of ['xXfuckerXx', 'fu ck', 'Sh1thead']) assert.equal(nameRude(n), true, n);
  assert.equal(nameRude(null), false); assert.equal(nameRude(''), false);
});
