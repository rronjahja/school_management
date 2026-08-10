const PizZip = require('pizzip');
const pool = require('../config/db');
const { httpError } = require('../middleware/errorHandler');

/**
 * Migrimi i kontratave: lexon një kontratë .docx të Kolegjit ISPE dhe
 * nxjerr të dhënat e nxënësit për ta parambushur formularin e regjistrimit.
 *
 * Kontrata mbart tri tabela:
 *   1. të dhënat e nxënësit  (Emri, Mbiemri, Data e lindjes, ...)
 *   2. të dhënat e prindërve (dy emra në një qelizë: babai ↵ nëna)
 *   3. pasqyra financiare    (Çmimi bazë, zbritja, viti shkollor)
 *
 * Asgjë nuk shkruhet në bazë këtu — njeriu i sheh, i plotëson dhe i
 * konfirmon të dhënat te formulari i regjistrimit.
 */

// ---------------------------------------------------------------
//  Ndihmës për XML-in e Word-it
// ---------------------------------------------------------------

/** Teksti i një blloku XML: bashkon të gjitha <w:t>. */
function textOf(xml) {
  return (xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, ''))
    .join('');
}

/** Paragrafët me tekst brenda një blloku (p.sh. një qelize). */
function parasOf(xml) {
  return (xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [])
    .map(textOf)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Tabelat -> rreshta -> qeliza, ku çdo qelizë është lista e paragrafëve. */
function parseTables(xml) {
  return (xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/g) || []).map((tbl) =>
    (tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || []).map((tr) =>
      (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(parasOf)
    )
  );
}

// ---------------------------------------------------------------
//  Normalizues vlerash
// ---------------------------------------------------------------

/** "/" dhe boshllëqet trajtohen si "pa vlerë". */
function clean(v) {
  const t = String(v == null ? '' : v).trim();
  return t === '' || t === '/' || t === '-' ? null : t;
}

/** "07/01/2010" ose "07.01.2010" (dita e para) -> "2010-01-07". */
function parseAlDate(v) {
  const m = String(v || '').match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const day = Number(d); const mon = Number(mo);
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  // 31/02 nuk ekziston: pa kete kontroll, data e pamundur do te hynte ne
  // formular dhe do te refuzohej vetem ne fund, te ruajtja.
  const probe = new Date(Date.UTC(Number(y), mon - 1, day));
  if (probe.getUTCMonth() !== mon - 1 || probe.getUTCDate() !== day) return null;
  return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** "1600.00 €" / "1.600,00 €" -> 1600 */
function parseMoney(v) {
  const t = String(v || '').replace(/[€\s]/g, '');
  if (!t) return null;

  let norm;
  if (/,\d{1,2}$/.test(t)) {
    // formati europian me presje dhjetore: 1.600,00 -> 1600.00
    norm = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    // KUJDES: '1.600' ne kontrate eshte njemijegjashteqind, jo 1.6 —
    // pika ketu eshte ndares mijesheje, sepse pas saj vijne SAKTESISHT
    // tri shifra. Pa kete dege, cmimi i kontrates hyn ne formular si 1.60.
    norm = t.replace(/\./g, '');
  } else {
    norm = t.replace(/,/g, '');
  }

  const n = Number(norm);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/** Tabela etiketë-vlerë: [Emri, Afron, Mbiemri, Ferizi] -> map. */
function labelValueMap(table) {
  const map = {};
  for (const row of table) {
    for (let i = 0; i + 1 < row.length; i += 2) {
      const label = (row[i] || []).join(' ').trim();
      if (label) map[label] = row[i + 1] || [];
    }
    // rreshtat me nje cift te vetem (Kombësia, Drejtimi, Adresa)
    if (row.length === 2) {
      const label = (row[0] || []).join(' ').trim();
      if (label) map[label] = row[1] || [];
    }
  }
  return map;
}

const one = (arr) => clean((arr || []).join(' '));

// ---------------------------------------------------------------
//  Nxjerrja kryesore
// ---------------------------------------------------------------

/**
 * @param {Buffer} buffer skedari .docx
 * @returns {{ data: object, warnings: string[] }}
 */
function parseContractDocx(buffer) {
  let xml;
  try {
    const zip = new PizZip(buffer);
    xml = zip.file('word/document.xml').asText();
  } catch {
    throw httpError(400, 'Skedari nuk është dokument Word (.docx) i vlefshëm.');
  }

  const fullText = textOf(xml);
  const tables = parseTables(xml);
  const warnings = [];
  const data = {};

  const studentTbl = tables.find((t) => ((t[0] || [])[0] || []).join('') === 'Emri');
  const parentTbl = tables.find((t) =>
    ((t[0] || [])[0] || []).join(' ').includes('Emri i Prindit')
  );
  const financeTbl = tables.find((t) =>
    t.some((row) => row.some((cell) => cell.join(' ').includes('Çmimi bazë')))
  );

  // ---- nxënësi ----
  if (studentTbl) {
    const m = labelValueMap(studentTbl);
    data.first_name = one(m['Emri']);
    data.last_name = one(m['Mbiemri']);
    data.birthday = parseAlDate(one(m['Data e lindjes']));
    data.city = one(m['Komuna']);
    data.contract_number = one(m['Nr. ID']);
    data.phone = one(m['Telefoni']);
    data.citizenship = one(m['Shtetësia']);
    data.email = one(m['E-mail']);
    data.nationality = one(m['Kombësia']);
  } else {
    warnings.push('Tabela e të dhënave të nxënësit nuk u gjet.');
  }

  // numri i kontrates: rezerve nga paragrafi "Nr. NN/YYYY/KODI"
  if (!data.contract_number) {
    const m = fullText.match(/Nr\.\s*(\d{1,4}\/\d{4}\/[A-ZËÇ]{2,6})/);
    if (m) data.contract_number = m[1];
  }

  // drejtimi: kodi i kontrates eshte burimi i sigurt (22/2025/TF -> TF)
  const codeMatch = String(data.contract_number || '').match(/\/(\d{4})\/([A-ZËÇ]{2,6})$/);
  if (codeMatch) data.category_code = codeMatch[2];
  else warnings.push('Drejtimi nuk u dallua nga numri i kontratës.');

  // ---- prindërit ----
  if (parentTbl) {
    const m = labelValueMap(parentTbl);
    const emrat = m['Emri i Prindit'] || [];
    const mbiemrat = m['Mbiemri i Prindit'] || [];
    // rreshti i pare i qelizes = babai, i dyti = nëna (rendi i shabllonit)
    data.father_name = clean(emrat[0]);
    data.mother_name = clean(emrat[1]);
    data.father_last_name = clean(mbiemrat[0]);
    // Mbiemri i perbashket i familjes vlen si rezerve VETEM nese nena
    // eshte fare e permendur — perndryshe do te dilte nje mbiemer pa emer.
    data.mother_last_name = data.mother_name
      ? clean(mbiemrat[1] != null ? mbiemrat[1] : mbiemrat[0])
      : null;

    // Kontrata mban NJE datelindje/telefon/nr.personal/e-mail — te perfaqesuesit.
    // Se cilit prind i takojne, e vendos emri te "i përfaqësuar nga ...".
    const rep = fullText.match(/i përfaqësuar nga Prindi\/?Kujdestari\s+([^.,]+?)[.,]/);
    const repName = rep ? rep[1].trim() : null;
    const firstToken = (repName || '').split(/\s+/)[0] || '';
    let side = 'father';
    if (firstToken && data.mother_name && firstToken === data.mother_name) side = 'mother';
    else if (firstToken && data.father_name && firstToken !== data.father_name) {
      warnings.push(
        `Përfaqësuesi "${repName}" nuk përputhet me asnjë prind — kontrolloni kontaktin e parë.`
      );
    }
    data.primary_contact = side;
    data[`${side}_birthday`] = parseAlDate(one(m['Data e lindjes']));
    data[`${side}_phone`] = one(m['Telefoni']);
    data[`${side}_personal_id`] = one(m['Nr. Personal']);
    data[`${side}_email`] = one(m['E-mail']);
    data.address = one(m['Adresa']);
  } else {
    warnings.push('Tabela e prindërve nuk u gjet.');
  }

  // ---- financat ----
  if (financeTbl) {
    // qeliza para "Çmimi bazë" ne rreshtin pasues mban vleren; me e sigurt:
    // numri i pare me € ne rreshtin qe nis me vitin shkollor
    for (const row of financeTbl) {
      const flat = row.map((c) => c.join(' '));
      if (/^\d{4}\/\d{2}$/.test((flat[0] || '').trim())) {
        data.yearly_quota = parseMoney(flat[1]);
        const disc = (flat[2] || '').match(/(\d+(?:[.,]\d+)?)\s*%/);
        if (disc) {
          data.discount_type = 'percent';
          data.discount_value = Number(disc[1].replace(',', '.'));
        }
        break;
      }
    }
    if (data.yearly_quota == null) {
      // rezerve: rreshti "Totali"
      for (const row of financeTbl) {
        const flat = row.map((c) => c.join(' ')).join(' | ');
        if (flat.includes('Totali')) {
          data.yearly_quota = parseMoney(flat.split('Totali').pop());
          break;
        }
      }
    }
  }
  if (data.yearly_quota == null) warnings.push('Çmimi bazë nuk u gjet.');

  // ---- gjenerata dhe data e regjistrimit ----
  const gen = fullText.match(/vitin shkollor\s+(\d{4})\/(\d{4})/);
  if (gen) data.generation = `${gen[1]}/${gen[2]}`;
  else if (codeMatch) {
    const y = Number(codeMatch[1]);
    data.generation = `${y}/${y + 1}`;
    warnings.push('Gjenerata u mor nga numri i kontratës — kontrollojeni.');
  } else {
    warnings.push('Gjenerata nuk u gjet.');
  }

  const dt = fullText.match(/Datë:\s*(\d{1,2}[./]\d{1,2}[./]\d{4})/);
  data.enrollment_date = dt ? parseAlDate(dt[1]) : null;
  if (!data.enrollment_date) warnings.push('Data e nënshkrimit nuk u gjet.');

  // fushat qe kontrata NUK i permban — njeriu i ploteson te formulari
  warnings.push('Plani i pagesës nuk shënohet në dokument (qarkohet me dorë) — zgjidheni.');
  warnings.push('Viti i studimit, paralelja dhe gjinia plotësohen me dorë.');

  return { data, warnings };
}

// ---------------------------------------------------------------
//  Shtresa me bazën e të dhënave
// ---------------------------------------------------------------

/** Parse + përkthimi i kodit të drejtimit në id + kontrolli i dyfishimit. */
async function importContract(buffer, filename) {
  const { data, warnings } = parseContractDocx(buffer);

  if (data.category_code) {
    const [[cat]] = await pool.query(
      'SELECT id, name FROM categories WHERE code = ?', [data.category_code]
    );
    if (cat) {
      data.category_id = cat.id;
      data.category_name = cat.name;
    } else {
      warnings.push(`Drejtimi me kodin "${data.category_code}" nuk ekziston te Cilësimet.`);
    }
  }

  let existing = null;
  if (data.contract_number) {
    const [[row]] = await pool.query(
      'SELECT id, first_name, last_name FROM students WHERE contract_number = ?',
      [data.contract_number]
    );
    if (row) existing = row;
  }

  return { filename, data, warnings, existing };
}

/** Cilat nga këta numra kontratash ekzistojnë tashmë? (për rifreskim liste) */
async function checkExisting(numbers) {
  const list = (numbers || []).filter(Boolean).slice(0, 200);
  if (!list.length) return [];
  const [rows] = await pool.query(
    'SELECT id, contract_number, first_name, last_name FROM students WHERE contract_number IN (?)',
    [list]
  );
  return rows;
}

module.exports = { parseContractDocx, importContract, checkExisting };