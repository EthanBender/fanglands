// Secret words: hashing round-trips, wrong ones fail, and the compare does not care about length.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHash, checkPassword, hashPassword, randomHex, sameString } from '../src/auth.js';

test('a secret word round-trips through the hash', async () => {
  const { salt, hash } = await makeHash('sword fish');
  assert.equal(salt.length, 32);   // 16 bytes as hex
  assert.equal(hash.length, 64);   // 256 bits as hex
  assert.equal(await checkPassword('sword fish', salt, hash), true);
});

test('a wrong secret word does not pass, nor does a near miss', async () => {
  const { salt, hash } = await makeHash('sword fish');
  assert.equal(await checkPassword('sword fis', salt, hash), false);
  assert.equal(await checkPassword('Sword fish', salt, hash), false);
  assert.equal(await checkPassword('', salt, hash), false);
});

test('the same word gets a different salt and hash every time', async () => {
  const a = await makeHash('same'), b = await makeHash('same');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(await hashPassword('same', a.salt), a.hash);   // but it is deterministic for one salt
});

test('randomHex and sameString', () => {
  assert.match(randomHex(32), /^[0-9a-f]{64}$/);
  assert.notEqual(randomHex(8), randomHex(8));
  assert.equal(sameString('abc', 'abc'), true);
  assert.equal(sameString('abc', 'abd'), false);
  assert.equal(sameString('abc', 'abcd'), false);
  assert.equal(sameString('', ''), true);
  assert.equal(sameString('a', ''), false);
});
