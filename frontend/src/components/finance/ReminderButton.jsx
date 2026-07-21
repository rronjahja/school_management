import { useState } from 'react';
import { fetchStudent } from '../../api/students';
import { fetchBanks, fetchReminderTemplate } from '../../api/meta';
import { downloadSlipPdf, shareSlipWithText, reminderSlipUrl } from '../../utils/slip';
import { errorMessage } from '../../api/client';
import { buildReminder, copyToClipboard } from '../../utils/reminder';
import Modal from '../ui/Modal.jsx';

/**
 * Gjeneron mesazhin e rikujtesës për një nxënës, e kopjon menjëherë
 * në clipboard dhe e shfaq për shikim/redaktim para dërgimit.
 */
export default function ReminderButton({ studentId, compact = false, label = 'Rikujtesë' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [combined, setCombined] = useState(null);
  const [slipBusy, setSlipBusy] = useState('');
  const [slipError, setSlipError] = useState('');

  const runSlip = async (kind, fn) => {
    setSlipBusy(kind);
    setSlipError('');
    setCombined(null);
    try {
      await fn();
    } catch {
      setSlipError(
        kind === 'copy'
          ? 'Dërgimi dështoi — shfletuesi e lejon vetëm në lidhje të sigurt (https ose localhost).'
          : 'Gjenerimi i fletëpagesës dështoi. Provoni përsëri.'
      );
    } finally {
      setSlipBusy('');
    }
  };
  const [error, setError] = useState('');

  const generate = async (e) => {
    e.stopPropagation(); // rreshti eshte i klikueshem — mos hap nxenesin
    setBusy(true);
    setError('');
    try {
      const [student, banks, tpl] = await Promise.all([
        fetchStudent(studentId),
        fetchBanks(),
        fetchReminderTemplate().catch(() => null), // rrjeti deshton -> parazgjedhja lokale
      ]);
      const msg = buildReminder(student, banks, tpl ? tpl.template : null);
      setText(msg);
      setOpen(true);
      setCopied(await copyToClipboard(msg));
    } catch (err) {
      setError(errorMessage(err));
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const copyAgain = async () => setCopied(await copyToClipboard(text));

  return (
    <>
      <button
        type="button"
        className={`btn btn-ghost ${compact ? 'btn-icon' : 'btn-small'}`}
        onClick={generate}
        disabled={busy}
        title="Gjenero rikujtesë dhe kopjoje"
      >
        {compact ? '✉' : busy ? '…' : `✉ ${label}`}
      </button>

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <Modal title="Rikujtesë për pagesë" onClose={() => setOpen(false)}>
            {error ? (
              <p className="form-error">{error}</p>
            ) : (
              <>
                <p className={`copy-note${copied ? ' ok' : ' warn'}`}>
                  {copied
                    ? '✓ Teksti u kopjua — ngjiteni te Viber, WhatsApp ose SMS.'
                    : 'Kopjimi automatik nuk funksionoi. Përdorni butonin “Kopjo tekstin”.'}
                </p>

                <textarea
                  className="reminder-text"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setCopied(false);
                  }}
                  rows={16}
                  spellCheck={false}
                />

                {slipError && <p className="form-error">{slipError}</p>}
                {combined === 'shared' && (
                  <p className="copy-note ok">
                    ✓ U hap dritarja e ndarjes — zgjidhni Viber ose WhatsApp dhe
                    do të dërgohen bashkë fletëpagesa dhe teksti.
                  </p>
                )}
                {combined === 'copied' && (
                  <p className="copy-note ok">
                    ✓ U kopjua fletëpagesa si foto. Ngjiteni te biseda, pastaj
                    shtypni <strong>Kopjo tekstin</strong> dhe ngjiteni si koment —
                    Viber/WhatsApp marrin vetëm fotografinë nga një ngjitje e vetme.
                  </p>
                )}

                <div className="modal-actions reminder-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                    Mbyll
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={Boolean(slipBusy)}
                    onClick={() => runSlip('pdf', () =>
                      downloadSlipPdf(reminderSlipUrl(studentId), 'Fletepagesa.pdf'))}
                    title="Shkarkon fletëpagesën si PDF për ta bashkëngjitur si skedar"
                  >
                    {slipBusy === 'pdf' ? '…' : 'Fletëpagesa (PDF)'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={Boolean(slipBusy)}
                    onClick={() => runSlip('copy', async () => {
                      const how = await shareSlipWithText(
                        reminderSlipUrl(studentId),
                        text,
                        'Fletepagesa.pdf'
                      );
                      setCombined(how);
                    })}
                    title="Dërgon fletëpagesën bashkë me tekstin te Viber/WhatsApp"
                  >
                    {slipBusy === 'copy' ? '…' : 'Dërgo me tekst'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={copyAgain}>
                    {copied ? '✓ U kopjua' : 'Kopjo tekstin'}
                  </button>
                </div>
              </>
            )}
          </Modal>
        </div>
      )}
    </>
  );
}