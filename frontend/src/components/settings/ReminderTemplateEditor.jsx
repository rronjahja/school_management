import { useEffect, useState } from 'react';
import { fetchReminderTemplate, saveReminderTemplate } from '../../api/meta';
import { errorMessage } from '../../api/client';

/**
 * Mbajtesit e vendit qe njeh mesazhi. Dy te paret lakohen sipas gjinise:
 * per nxenes mashkull "të nxënësit", per femer "të nxënëses";
 * pershendetja sipas kontaktit te pare (nena -> znj., babai -> z.,
 * kujdestari sipas gjinise se vet).
 */
const PLACEHOLDERS = [
  ['{pershendetja}', '"i nderuar z." / "e nderuara znj." sipas kontaktit'],
  ['{emri_kontaktit}', 'emri i plotë i kontaktit të parë'],
  ['{te_nxenesit}', '"të nxënësit" / "të nxënëses" sipas gjinisë'],
  ['{nxenesi}', '"nxënësi" / "nxënësja" sipas gjinisë'],
  ['{emri_nxenesit}', 'emri i plotë i nxënësit'],
  ['{drejtimi}', 'drejtimi i nxënësit'],
  ['{viti_fraza}', '", Viti II" — bosh nëse mungon'],
  ['{klasa_fraza}', '", paralelja XI/1" — bosh nëse mungon'],
  ['{detyrimet}', 'lista e detyrimeve (këstet, borxhi, totali)'],
  ['{detyrimi_total}', 'shuma e mbetur gjithsej'],
  ['{llogarite_bankare}', 'bankat me numër llogarie'],
  ['{pagesa_kesh}', 'mundësia e pagesës me para të gatshme në shkollë'],
  ['{shkolla}', 'emri i shkollës'],
  ['{telefoni_shkolles}', 'telefoni i shkollës'],
  ['{data}', 'data e sotme'],
];

export default function ReminderTemplateEditor() {
  const [template, setTemplate] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const apply = (data) => {
    setTemplate(data.template);
    setIsDefault(data.is_default);
  };

  useEffect(() => {
    fetchReminderTemplate()
      .then((d) => { apply(d); setLoaded(true); })
      .catch((e) => { setError(errorMessage(e)); setLoaded(true); });
  }, []);

  const save = async (value) => {
    setBusy(true); setError(''); setNotice('');
    try {
      apply(await saveReminderTemplate(value));
      setNotice(
        value.trim() === ''
          ? 'Mesazhi u rikthye në parazgjedhje.'
          : 'Mesazhi u ruajt. Rikujtesat e reja do ta përdorin këtë tekst.'
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <div className="card-title-row">
        <h2 className="card-title">Mesazhi i rikujtesës</h2>
        {!isDefault && <span className="contact-note">i personalizuar</span>}
      </div>
      <p className="muted card-sub">
        Ky tekst përdoret sa herë gjenerohet një rikujtesë. Mbajtësit e vendit
        në kllapa zëvendësohen me të dhënat e nxënësit; dy të parët lakohen
        vetvetiu sipas gjinisë.
      </p>

      {error && <p className="form-error">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      {!loaded ? (
        <p className="muted">Duke ngarkuar…</p>
      ) : (
        <>
          <textarea
            className="tpl-editor"
            rows={16}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            spellCheck={false}
          />

          <details className="tpl-legend">
            <summary>Mbajtësit e vendit ({PLACEHOLDERS.length})</summary>
            <dl>
              {PLACEHOLDERS.map(([key, desc]) => (
                <div key={key}>
                  <dt className="mono">{key}</dt>
                  <dd>{desc}</dd>
                </div>
              ))}
            </dl>
          </details>

          <div className="tpl-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => save('')}
              title="Kthen tekstin e parazgjedhur të shkollës"
            >
              Rikthe parazgjedhjen
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => save(template)}
            >
              Ruaj mesazhin
            </button>
          </div>
        </>
      )}
    </section>
  );
}