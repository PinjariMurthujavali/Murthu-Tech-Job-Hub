import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupCategories } from '../src/lib/categories.ts';

const category = {
  id: 1, name: 'Software', slug: 'software', groupName: 'IT',
  description: null, sortOrder: 0, activeCount: 2,
};

test('category grouping tolerates HTML, objects, null and malformed array entries', () => {
  for (const value of ['<!doctype html>', {}, null, undefined, [null, {}, 'bad']]) {
    assert.deepEqual(Object.entries(groupCategories(value)), []);
  }
});

test('groups valid categories and safely handles names inherited by plain objects', () => {
  const special = { ...category, id: 2, groupName: '__proto__' };
  const groups = groupCategories([category, special]);
  assert.deepEqual(groups.IT, [category]);
  assert.deepEqual(groups.__proto__, [special]);
});
