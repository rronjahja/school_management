import { useEffect, useState } from 'react';
import {
  fetchPromotionOverview,
  fetchPromotionPreview,
  runPromotion,
} from '../api/promotion';
import { errorMessage } from '../api/client';
import PageHeader from '../components/ui/PageHeader.jsx';
import Loader from '../components/ui/Loader.jsx';
import Modal from '../components/ui/Modal.jsx';
import Field from '../components/ui/Field.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import { money, date, YEAR_LABELS, shortGen } from '../utils/format';
import UserManager from '../components/settings/UserManager.jsx';
import DataManager from '../components/settings/DataManager.jsx';

export default function Settings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [selected, setSelected] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({
    create_new_year: true,
    quota_increase: 0,
    year_start_date: '',
  });

  const load = () =>
    fetchPromotionOverview()
      .then(setData)
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  const choose = (generation) => {
    setSelected(generation);
    setPreview(null);
    setNotice('');
    setPreviewBusy(true);
    fetchPromotionPreview(generation)
      .then((p) => {
        setPreview(p);
        setOpts((o) => ({
          ...o,
          year_start_date: `${String(p.to_generation).slice(0, 4)}-09-01`,
        }));
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setPreviewBusy(false));
  };

  const execute = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await runPromotion({
        from_generation: selected,
        create_new_year: opts.create_new_year,
        quota_increase: Number(opts.quota_increase) || 0,
        year_start_date: opts.year_start_date || undefined,
        force: Boolean(preview && preview.already_done),
      });
      setNotice(
        `U krye: ${res.promoted} studentë kaluan në ${shortGen(res.to_generation)}, ` +
          `${res.graduated} u diplomuan.`
      );
      setConfirmOpen(false);
      setPreview(null);
      setSelected('');
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <EmptyState title="Gabim" hint={error} />;
  if (!data) return <Loader />;

  return (
    <>
      <PageHeader
        title="Cilësimet"
        subtitle="Veprime administrative që kryhen rrallë — përdorni me kujdes"
      />

      {error && <p className="form-error form-error-page">{error}</p>}
      {notice && <p className="form-success">{notice}</p>}

      <section className="card">
        <h2 className="card-title">Kalimi i vitit shkollor</h2>
        <p className="settings-intro">
          Kalon të gjithë studentët e një gjenerate një vit përpara:
          <strong> Viti I → Viti II</strong>, <strong>Viti II → Viti III</strong>, ndërsa
          <strong> Viti III diplomohet</strong>. Këstet dhe pagesat ekzistuese nuk fshihen
          kurrë — borxhi i mbetur i ndjek studentët edhe pas diplomimit.
        </p>

        <p className="settings-current">
          Viti shkollor aktual sipas datës: <strong>{shortGen(data.current_generation)}</strong>
        </p>

        {data.generations.length === 0 ? (
          <p className="muted">Nuk ka studentë aktivë.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Gjenerata</th>
                  <th className="num">Viti I</th>
                  <th className="num">Viti II</th>
                  <th className="num">Viti III</th>
                  <th className="num">Gjithsej</th>
                  <th>Kalon në</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.generations.map((g) => {
                  const done = data.history.some((h) => h.from_generation === g.generation);
                  return (
                    <tr key={g.generation} className={selected === g.generation ? 'row-selected' : ''}>
                      <td>
                        <strong>{shortGen(g.generation)}</strong>
                      </td>
                      <td className="num">{g.viti1}</td>
                      <td className="num">{g.viti2}</td>
                      <td className="num">{g.viti3}</td>
                      <td className="num">{g.total}</td>
                      <td>{g.next ? shortGen(g.next) : '—'}</td>
                      <td>
                        <span className="cell-actions">
                          {done && (
                            <span className="badge badge-green">
                              <span className="badge-dot" /> E kryer
                            </span>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => choose(g.generation)}
                          >
                            {done ? 'Përsërit' : 'Përgatit kalimin'}
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {previewBusy && <Loader text="Duke përgatitur parapamjen…" />}

        {preview && (
          <div className="promo-preview">
            <h3>
              Parapamje: {shortGen(preview.from_generation)} → {shortGen(preview.to_generation)}
            </h3>

            {preview.already_done && (
              <p className="promo-repeat">
                Kjo gjeneratë është promovuar një herë më parë. Kjo është normale nëse
                studentë të tjerë kanë hyrë në të pas kalimit të mëparshëm — do të preken
                vetëm {preview.promote_total + preview.graduate_total} studentët aktualë.
              </p>
            )}

            <div className="promo-cols">
              <div className="promo-box">
                <span className="promo-label">Kalojnë një vit përpara</span>
                <strong className="promo-big">{preview.promote_total}</strong>
                <ul>
                  {preview.promote.map((y) => (
                    <li key={y.study_year}>
                      {YEAR_LABELS[y.study_year]} → {YEAR_LABELS[y.study_year + 1]}:{' '}
                      <strong>{y.students}</strong> studentë
                    </li>
                  ))}
                  {preview.promote.length === 0 && <li className="muted">Asnjë</li>}
                </ul>
              </div>

              <div className="promo-box promo-box-grad">
                <span className="promo-label">Diplomohen</span>
                <strong className="promo-big">{preview.graduate_total}</strong>
                <ul>
                  <li>
                    Borxh i pashlyer:{' '}
                    <strong className="cell-owed">{money(preview.graduate_debt)}</strong>
                  </li>
                  <li className="muted">
                    Kalojnë te faqja «Të diplomuarit» dhe borxhi mbetet i ndjekshëm.
                  </li>
                </ul>
              </div>
            </div>

            <div className="form-grid promo-opts">
              <Field label="Data e fillimit të vitit të ri">
                <input
                  type="date"
                  value={opts.year_start_date}
                  onChange={(e) => setOpts({ ...opts, year_start_date: e.target.value })}
                />
              </Field>
              <Field label="Rrit kuotën për vitin e ri (%)">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={opts.quota_increase}
                  onChange={(e) => setOpts({ ...opts, quota_increase: e.target.value })}
                  disabled={!opts.create_new_year}
                />
              </Field>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={opts.create_new_year}
                  onChange={(e) => setOpts({ ...opts, create_new_year: e.target.checked })}
                />
                <span>
                  Gjenero këstet e vitit të ri
                  <em>
                    Nëse çkyçet, studentët kalojnë vitin por nuk u krijohen detyrime të reja.
                  </em>
                </span>
              </label>
            </div>

            <div className="promo-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
                Anulo
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmOpen(true)}
              >
                Kryej kalimin
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Historiku i kalimeve</h2>
        {data.history.length === 0 ? (
          <p className="muted">Ende nuk është kryer asnjë kalim viti.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nga</th>
                  <th>Në</th>
                  <th className="num">Kaluan</th>
                  <th className="num">U diplomuan</th>
                  <th className="num">Rritje kuote</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.id}>
                    <td>{shortGen(h.from_generation)}</td>
                    <td>{shortGen(h.to_generation)}</td>
                    <td className="num">{h.promoted_count}</td>
                    <td className="num">{h.graduated_count}</td>
                    <td className="num">{Number(h.quota_increase)}%</td>
                    <td>{date(h.run_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <DataManager />

      <UserManager />

      {confirmOpen && preview && (
        <Modal title="Konfirmo kalimin e vitit" onClose={() => setConfirmOpen(false)}>
          <p className="modal-hint">
            Do të preken <strong>{preview.promote_total + preview.graduate_total}</strong>{' '}
            studentë të gjeneratës <strong>{shortGen(preview.from_generation)}</strong>:
          </p>
          <ul className="confirm-list">
            <li>
              <strong>{preview.promote_total}</strong> kalojnë në {shortGen(preview.to_generation)}
              {opts.create_new_year && ' dhe u gjenerohen këstet e vitit të ri'}
            </li>
            <li>
              <strong>{preview.graduate_total}</strong> diplomohen
              {preview.graduate_debt > 0 && (
                <> (me borxh {money(preview.graduate_debt)} që mbetet i regjistruar)</>
              )}
            </li>
          </ul>
          <p className="confirm-warning">
            Ky veprim nuk mund të kthehet mbrapsht. Rekomandohet një kopje rezervë e bazës
            së të dhënave përpara se të vazhdoni.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
              Anulo
            </button>
            <button type="button" className="btn btn-primary" onClick={execute} disabled={busy}>
              {busy ? 'Duke kryer…' : 'Po, kryeje kalimin'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}