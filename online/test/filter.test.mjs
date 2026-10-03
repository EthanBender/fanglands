// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanChat, checkChat, nameRude, BLOCKED, BLOCKED_INSIDE, INSULTS, SAID_ABOUT_YOU, YOU_ARE, YOU_OR_YOUR, BETWEEN, GAY_INSULTS, AT_SOMEONE, SAID_TO_SOMEONE, LINE_ALONE, PEOPLE, LAUGHS, NAME_INSULTS } from '../src/filter.js';

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
  assert.deepEqual(checkChat('you idiot'), { text: '*** *****', masked: true });
  // about a monster it is no insult: only what is said AT someone counts (3 strikes is 24 hours out)
  assert.deepEqual(checkChat('this stupid goblin'), { text: 'this stupid goblin', masked: false });
  assert.deepEqual(checkChat('you stupid goblin'), { text: '*** ****** goblin', masked: true });
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
  for (const w of YOU_OR_YOUR.concat(BETWEEN, AT_SOMEONE, SAID_TO_SOMEONE, LINE_ALONE, PEOPLE, LAUGHS, NAME_INSULTS)) assert.match(w, /^[a-z]+( [a-z]+)*$/, w);
  assert.ok(SAID_ABOUT_YOU.includes('idiot') && SAID_ABOUT_YOU.includes('stupid') && SAID_ABOUT_YOU.includes('gay'));
  // the words a kid says about the game all evening are never on a list that counts anywhere in a line
  for (const w of ['stupid', 'loser', 'idiot', 'moron', 'dumbo', 'go die', 'shut up', 'hate you']) assert.ok(!INSULTS.includes(w) && !BLOCKED.includes(w), w);
  assert.ok(!YOU_ARE.includes('your') && !YOU_ARE.includes('ur') && !YOU_ARE.includes('yur'));
});

test('names: insults are refused at sign-up; nameRude flags an old name for what it says, not its shape', () => {
  for (const n of ['Stupid Sam', 'Gaylord', 'Gay Knight', 'Idiot', 'Big Loser']) { assert.equal(cleanName(n), null, n); assert.equal(nameRude(n), true, n); }
  for (const n of ['Cohen', 'MudGoll', 'Dumbledore', 'Big Dummy', 'Cassandra', 'Hancock']) { assert.equal(cleanName(n), n, n); assert.equal(nameRude(n), false, n); }
  // shapes cleanName refuses that are not rude: an old name is never flagged for them
  for (const n of ['admin', 'A', 'Name with seventeen', 'Co-hen']) assert.equal(nameRude(n), false, n);
  for (const n of ['xXfuckerXx', 'fu ck', 'Sh1thead']) assert.equal(nameRude(n), true, n);
  assert.equal(nameRude(null), false); assert.equal(nameRude(''), false);
});

// Review round 1: a kid is kept out for 24 hours after three strikes, so everyday game talk must never count.
// Each of these was a strike on the first build of the list (said in a real Room with two knights, and by checkChat).
test('game talk is never a strike: about a boss, the lag, lava, a pet, yourself, or a surprised shout', () => {
  const names = ['Sam', 'Leo'];
  for (const s of [
    'this boss is stupid hard', 'lets go die to the dragon again', 'stupid lag', 'ur dumb sword is cool', 'your fat dragon pet',
    'your ugly ogre', 'im gonna go die in the lava', 'dont go die', 'shut up no way you got the sword?', 'my stupid brother',
    'idiot proof plan', 'Dumbo the elephant', "I'm such a loser lol", 'I am stupid', 'the stupid goblin keeps hitting me',
    'shut up no way!', 'shut up and take my coins', 'i am a loser at this', 'go die goblin', 'i hate you goblin king',
    'your fat dragon is cool', 'your dumb pet', 'your ugly sweater lol', 'your fat stack of coins', 'see ya later',
    'is that your sword', 'the dumb goblin', 'you win', 'you are cool', 'my uncle is gay',
  ]) assert.deepEqual(checkChat(s, { names }), { text: s, masked: false }, s);
});

test('insults said at someone still count: after "you", at the end of the line, to a person, or as the whole line', () => {
  const names = ['Sam', 'Big Dummy'];
  const want = {
    'you idiot': '*** *****', 'you are stupid': '*** *** ******', 'ur a loser': '** * *****', 'ur stupid': '** ******',
    'u r stupid': '* * ******', 'your so stupid': '**** ** ******', "you're such an idiot": '****** **** ** *****', 'you big idiot': '*** *** *****',
    'ur dumb': '** ****', 'ur dumb lol': '** **** lol', 'ur dumb, sword is cool': '** ***** sword is cool', 'your dumb': '**** ****', 'see ya loser': 'see ** *****',
    'shut up': '**** **', 'ok shut up!': 'ok **** ***', 'shut up sam': '**** ** sam', 'shut up big dummy': '**** ** big dummy', 'shut up noob': '**** ** noob', 'shut up, no way': '**** *** no way',
    'i hate you': 'i **** ***', 'hate you Sam': '**** *** Sam', 'i hate you lol': 'i **** *** lol',
    'go die': '** ***', 'go die noob': '** *** noob', 'go die sam': '** *** sam', 'just go die': '**** ** ***', 'go die in a hole': '** *** ** * ****',
    'L0SER': '*****', 'loser lol': '***** lol', 'idiot': '*****', 'MORON!': '******',
  };
  for (const [s, text] of Object.entries(want)) assert.deepEqual(checkChat(s, { names }), { text, masked: true }, s);
  // a name only counts for a knight the world says is on line
  assert.equal(checkChat('shut up leo', { names }).masked, false);
  assert.equal(checkChat('shut up leo', { names: ['Leo'] }).masked, true);
});

test('names: NAME_INSULTS count anywhere in a name, spaced out too; harmless names still pass', () => {
  for (const n of ['Stu Pid', 'Loser Leo', 'Moron', 'Sir Idiot']) assert.equal(cleanName(n), null, n);
  for (const n of ['Fat Cat', 'Dumbo', 'Big Dummy', 'Ugly Duckling', 'Sam Gay']) assert.equal(cleanName(n), n, n);
});
