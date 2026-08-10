import { useEffect, useState } from 'react';

/**
 * Fusha e datës — gjithnjë dd/mm/vvvv.
 *
 * PSE JO `<input type="date">`: shfletuesi e vizaton atë fushë sipas gjuhës
 * së SISTEMIT, jo të faqes. Në një Windows anglisht e njëjta datë shfaqet
 * `08/10/2026`, ndërsa kontratat, fletëpagesat dhe tabelat e shkruajnë
 * `10/08/2026` — dy formate për të njëjtën datë brenda të njëjtit ekran.
 *
 * Vlera që del jashtë mbetet ISO (`VVVV-MM-DD`), si më parë: `onChange`
 * merr `{ target: { value } }`, ndaj çdo `set('fusha')` punon i paprekur.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** '2026-08-10' -> '10/08/2026' */
function isoToDisplay(iso) {
    const m = ISO.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** '10/08/2026' -> '2026-08-10'; kthen '' nëse data s'ekziston. */
function displayToIso(text) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim());
    if (!m) return '';

    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return '';
    if (year < 1900 || year > 2200) return '';

    // 31/02 nuk ekziston: e kap kalendari, jo kufijtë e mësipërm.
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return '';

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Vizat i vendos vetë fusha ndërsa shkruhet: 10082026 -> 10/08/2026
 *
 * Shifrat e pamundura ndreqen në vend, nuk hidhen poshtë:
 *   · «4» si shifër e parë e ditës  -> 04 (nuk ka ditë që nis me 4)
 *   · ditë mbi 31                   -> 31
 *   · «7» si shifër e parë e muajit -> 07
 *   · muaj mbi 12                   -> 12
 *
 * Ndreqja është më e mirë se bllokimi: po ta refuzonim shifrën, shkrimi do
 * të ngecte dhe shifrat e mëpasme do të humbisnin pa u vënë re.
 */
function withSlashes(raw) {
    let d = String(raw).replace(/\D/g, '').slice(0, 8);

    // ---- dita ----
    if (d.length === 1 && Number(d) > 3) d = `0${d}`;
    if (d.length >= 2 && Number(d.slice(0, 2)) > 31) d = `31${d.slice(2)}`;

    // ---- muaji ----
    if (d.length === 3 && Number(d[2]) > 1) d = `${d.slice(0, 2)}0${d[2]}`;
    if (d.length >= 4 && Number(d.slice(2, 4)) > 12) d = `${d.slice(0, 2)}12${d.slice(4)}`;

    if (d.length <= 2) return d;
    if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export default function DateInput({
    value,
    onChange,
    required = false,
    disabled = false,
    id,
    'aria-label': ariaLabel,
}) {
    const [text, setText] = useState(() => isoToDisplay(value));
    const [touched, setTouched] = useState(false);

    // Kur vlera vjen nga jashtë (ngarkimi i formularit, pastrimi i filtrave),
    // teksti ndjek atë — por JO ndërsa përdoruesi është duke shkruar, se do
    // t'i fshihej gjysma e datës nën gishta.
    useEffect(() => {
        if (displayToIso(text) !== (value || '')) setText(isoToDisplay(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = (e) => {
        const next = withSlashes(e.target.value);
        setText(next);

        // Vlera del vetëm kur data është e plotë dhe reale; ndërkohë fusha
        // mbetet e zbrazët për pjesën tjetër të aplikacionit.
        const iso = displayToIso(next);
        if (iso || next === '') onChange({ target: { value: iso } });
    };

    // 31/02 dhe datat gjysmake nuk kapen dot shkronjë për shkronjë; shënohen
    // kur përdoruesi del nga fusha, jo ndërsa është ende duke shkruar.
    const invalid = touched && text !== '' && !displayToIso(text);

    return (
        <input
            id={id}
            type="text"
            inputMode="numeric"
            className={`date-field${invalid ? ' is-invalid' : ''}`}
            placeholder="dd/mm/vvvv"
            value={text}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            title={invalid ? 'Data nuk është e vlefshme (dd/mm/vvvv)' : undefined}
            required={required}
            disabled={disabled}
            maxLength={10}
            autoComplete="off"
            aria-label={ariaLabel}
        />
    );
}