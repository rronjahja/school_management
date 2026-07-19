import { useState } from 'react';
import { fetchStudent } from '../../api/students';
import { fetchBanks } from '../../api/meta';
import { errorMessage } from '../../api/client';
import { buildReminder, copyToClipboard } from '../../utils/reminder';
import Modal from '../ui/Modal.jsx';

/**
 * Gjeneron mesazhin e rikujtesës për një student, e kopjon menjëherë
 * në clipboard dhe e shfaq për shikim/redaktim para dërgimit.
 */
export default function ReminderButton({ studentId, compact = false, label = 'Rikujtesë' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const generate = async (e) => {
    e.stopPropagation(); // rreshti eshte i klikueshem — mos hap studentin
    setBusy(true);
    setError('');
    try {
      const [student, banks] = await Promise.all([fetchStudent(studentId), fetchBanks()]);
      const msg = buildReminder(student, banks);
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

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                    Mbyll
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