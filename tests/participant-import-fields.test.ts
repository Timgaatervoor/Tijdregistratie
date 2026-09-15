import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { autoDetectMapping, parseFile, validateAndMapRows } from '../src/services/stamhoofdParser';
import type { Wave } from '../src/types';

const waves: Wave[] = [{ id: 'wave-2', name: 'Tweede groep', waveNumber: 2, status: 'SCHEDULED' } as Wave];
const headers = ['Voornaam', 'Achternaam', 'Categorie', 'Artikel', 'Stamhoofd ID', 'Startgroepen (waves)', 'Notities | opmerkingen', 'Club/school', 'Team / Ploeg'];
const values = ['Jan', 'Test', 'U12', 'Korte afstand', '00123', 'Tweede groep', 'Afspraak: "aanmelden"\nBij de start', 'School De Zee', 'Ploeg A'];

for (const extension of ['csv', 'xlsx']) {
  test(`${extension} imports independent article, source ID, wave, notes, school and team fields`, async () => {
    let file: File;
    if (extension === 'csv') {
      const csv = [headers, values].map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(';')).join('\n');
      file = new File([csv], 'deelnemers.csv');
    } else {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([headers, values]), 'Deelnemers');
      file = new File([XLSX.write(book, { type: 'array', bookType: 'xlsx' })], 'deelnemers.xlsx');
    }
    const parsed = await parseFile(file);
    const mapping = autoDetectMapping(parsed.headers);
    assert.equal(mapping.category, 'Categorie');
    const [candidate] = validateAndMapRows(parsed.rows, mapping, [], false, waves);
    assert.deepEqual(candidate.validationErrors, []);
    assert.equal(candidate.article, 'Korte afstand');
    assert.equal(candidate.externalId, '00123');
    assert.equal(candidate.waveId, 'wave-2');
    assert.equal(candidate.notes, values[6]);
    assert.equal(candidate.club, 'School De Zee');
    assert.equal(candidate.team, 'Ploeg A');
  });
}

test('wave matching accepts exact name, number or ID, and flags unknown, ambiguous and started groups', () => {
  const candidate = (wave: string, available = waves) => validateAndMapRows([{ rowIndex: 2, data: { Voornaam: 'Jan', Categorie: 'U12', Wave: wave } }], { firstName: 'Voornaam', category: 'Categorie', wave: 'Wave' }, [], false, available)[0];
  for (const value of ['tweede groep', '2', 'wave-2']) assert.equal(candidate(value).waveId, 'wave-2');
  assert.match(candidate('Onbekend').validationErrors.join(), /Onbekende startgroep/);
  assert.match(candidate('2', [...waves, { ...waves[0], id: 'other' }]).validationErrors.join(), /Meerdere startgroepen/);
  assert.match(candidate('2', [{ ...waves[0], status: 'STARTED' }]).validationErrors.join(), /al gestart/);
  assert.equal(candidate('').isValid, true);
  assert.equal(autoDetectMapping(['Startgroepen (waves)', 'Team / Ploeg', 'Club/school']).category, undefined);
});
