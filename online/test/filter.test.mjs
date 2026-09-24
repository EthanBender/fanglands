// The word filter: names and chat. node --test online/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName, cleanChat, BLOCKED, BLOCKED_INSIDE } from '../src/filter.js';

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
