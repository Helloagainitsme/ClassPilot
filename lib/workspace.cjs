'use strict';

const {randomUUID} = require('node:crypto');
const {isDeepStrictEqual} = require('node:util');

const MAX_BYTES = 18 * 1024 * 1024;
const SUBJECTS = ['fr', 'math', 'ar', 'science', 'en', 'social', 'islamic', 'art', 'pe'];
const STATUSES = ['notAssessed', 'notAcquired', 'guided', 'developing', 'mastered', 'consolidated'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
function invalid() { throw new Error('Invalid workspace data. No changes were saved.'); }
function text(value, max = 100000) { return typeof value === 'string' && value.length <= max; }
function id(value) { return text(value, 128) && value.trim().length > 0; }
function jsonSafe(value, depth = 0) {
  if (depth > 35) invalid();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (value.length > 100000) invalid();
    for (const item of value) jsonSafe(item, depth + 1);
    return;
  }
  if (!isObject(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid();
  for (const [key, item] of Object.entries(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) invalid();
    jsonSafe(item, depth + 1);
  }
}
function records(value) {
  if (!Array.isArray(value) || value.length > 100000) invalid();
  const ids = new Set();
  for (const item of value) {
    if (!isObject(item) || !id(item.id) || ids.has(item.id)) invalid();
    ids.add(item.id);
  }
  return ids;
}
function date(value) {
  return text(value, 10) && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function validateWorkspace(value) {
  jsonSafe(value);
  if (!isObject(value) || Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) invalid();
  const students = records(value.students);
  records(value.assessments);
  if (students.size || value.competencies !== undefined) {
    for (const field of ['competencies', 'levels', 'results', 'weeklySessions']) if (!isObject(value[field])) invalid();
    for (const field of ['observations', 'groups', 'plans']) if (!Array.isArray(value[field])) invalid();
  }
  if (!Array.isArray(value.activeSubjects) || new Set(value.activeSubjects).size !== value.activeSubjects.length ||
      value.activeSubjects.some(subject => !SUBJECTS.includes(subject))) invalid();
  for (const key of ['lang', 'planLang']) if (value[key] !== undefined && !['fr', 'en', 'ar'].includes(value[key])) invalid();
  for (const student of value.students) {
    if (!text(student.name, 300) || !student.name.trim()) invalid();
    if (student.group !== undefined && (!text(student.group, 300) || !student.group.trim())) invalid();
    if (student.archived !== undefined && typeof student.archived !== 'boolean') invalid();
  }
  for (const key of ['competencies', 'levels']) {
    if (value[key] === undefined) continue;
    if (!isObject(value[key])) invalid();
    for (const [subject, items] of Object.entries(value[key])) {
      if (!SUBJECTS.includes(subject)) invalid();
      records(items);
      for (const item of items) if (!text(item.name, 1000) || !item.name.trim()) invalid();
    }
  }
  for (const assessment of value.assessments) {
    if (!students.has(assessment.studentId) || !SUBJECTS.includes(assessment.subject) ||
        !['pre', 'mid', 'post', 'skill'].includes(assessment.type) || !date(assessment.date)) invalid();
    if (assessment.levelId && value.levels &&
        !(value.levels[assessment.subject] || []).some(level => level.id === assessment.levelId)) invalid();
    for (const key of ['score', 'maxScore']) {
      const score = assessment[key];
      if (score !== undefined && score !== null && score !== '' &&
          !((typeof score === 'number' || typeof score === 'string') && String(score).trim() &&
             Number.isFinite(Number(score)) && Number(score) >= 0)) invalid();
    }
    if (assessment.maxScore !== undefined && assessment.maxScore !== '' && assessment.maxScore !== null &&
        (Number(assessment.maxScore) <= 0 || (assessment.score !== '' && assessment.score != null &&
         Number(assessment.score) > Number(assessment.maxScore)))) invalid();
    if (assessment.note !== undefined && !text(assessment.note)) invalid();
  }
  if (value.observations !== undefined) {
    records(value.observations);
    for (const observation of value.observations) {
      if (!students.has(observation.studentId) || !SUBJECTS.includes(observation.subject) ||
          !date(observation.date) || !text(observation.text) || !observation.text.trim()) invalid();
    }
  }
  if (value.groups !== undefined) {
    records(value.groups);
    for (const group of value.groups) {
      if (!SUBJECTS.includes(group.subject) || !Array.isArray(group.members) ||
          new Set(group.members).size !== group.members.length || group.members.some(member => !students.has(member))) invalid();
    }
  }
  if (value.plans !== undefined) {
    records(value.plans);
    for (const plan of value.plans) if (!students.has(plan.studentId) || !SUBJECTS.includes(plan.subject)) invalid();
  }
  if (value.results !== undefined) {
    if (!isObject(value.results)) invalid();
    for (const [student, subjects] of Object.entries(value.results)) {
      if (!students.has(student) || !isObject(subjects)) invalid();
      for (const [subject, items] of Object.entries(subjects)) {
        if (!SUBJECTS.includes(subject) || !isObject(items)) invalid();
        for (const [competency, status] of Object.entries(items)) {
          if (!id(competency) || !STATUSES.includes(status)) invalid();
          if (value.competencies && !(value.competencies[subject] || []).some(item => item.id === competency)) invalid();
        }
      }
    }
  }
  return clone(value);
}
function assertAppendOnly(previous, next) {
  for (const key of ['assessments', 'observations']) {
    const current = new Map((next[key] || []).map(item => [item.id, item]));
    for (const item of previous[key] || []) {
      if (!isDeepStrictEqual(item, current.get(item.id))) {
        throw new Error('Existing assessment and observation evidence cannot be overwritten. Record a new event instead.');
      }
    }
  }
}
function auditChanges(previous, next) {
  const changes = [];
  const add = (kind, entityId, before, after, subject) => changes.push({
    id: randomUUID(), timestamp: new Date().toISOString(), actor: 'local-teacher',
    kind, entityId, ...(subject ? {subject} : {}), previous: before ?? null, next: after ?? null
  });
  for (const key of ['students', 'assessments', 'observations', 'groups', 'plans']) {
    const before = new Map((previous[key] || []).map(item => [item.id, item]));
    const after = new Map((next[key] || []).map(item => [item.id, item]));
    for (const entityId of new Set([...before.keys(), ...after.keys()])) {
      if (!isDeepStrictEqual(before.get(entityId), after.get(entityId))) add(key, entityId, before.get(entityId), after.get(entityId));
    }
  }
  for (const key of ['competencies', 'levels']) {
    for (const subject of SUBJECTS) {
      const before = new Map((previous[key]?.[subject] || []).map(item => [item.id, item]));
      const after = new Map((next[key]?.[subject] || []).map(item => [item.id, item]));
      for (const entityId of new Set([...before.keys(), ...after.keys()])) {
        if (!isDeepStrictEqual(before.get(entityId), after.get(entityId))) add(key, entityId, before.get(entityId), after.get(entityId), subject);
      }
    }
  }
  // Status maps and settings are also evidence, but are never written outside the encrypted envelope.
  const covered = new Set(['students', 'assessments', 'observations', 'groups', 'plans', 'competencies', 'levels']);
  for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    if (!covered.has(key) && !isDeepStrictEqual(previous[key], next[key])) add('workspace-field', key, previous[key], next[key]);
  }
  return changes;
}

module.exports = {MAX_BYTES, SUBJECTS, clone, validateWorkspace, assertAppendOnly, auditChanges};
