import { useState } from 'react';
import Field from './Field.jsx';

/**
 * Numri i telefonit.
 *
 * Pothuajse çdo numër këtu është kosovar: nëntë shifra që nisin me «04»
 * për celular. Prandaj fusha e nis vetë me 04 dhe i vendos vijat ndërsa
 * shkruhet — 044-123-456 lexohet me një vështrim, kurse 044123456 duhet
 * numëruar me gisht.
 *
 * Në BAZË ruhen VETËM SHIFRAT. Vijat janë çështje pamjeje: po të ruheshin,
 * i njëjti numër do të ekzistonte në dy forma varësisht se kush e shkroi,
 * dhe kërkimi për «044123456» s'do ta gjente atë me viza.
 *
 * Ndonjëherë numri është i huaj dhe nuk i përshtatet asnjë forme. Për atë
 * shërben çelësi «tjetër»: fusha bëhet e lirë dhe ruhet ashtu siç shkruhet.
 */

/** Vetëm shifrat, deri në nëntë. */
export const phoneDigits = (value) => String(value || '').replace(/\D/g, '').slice(0, 9);

/** Numër kosovar i plotë: nëntë shifra që nisin me zero. */
export const isLocalPhone = (value) => /^0\d{8}$/.test(String(value || '').replace(/\D/g, ''))
    && !/[^\d\s-]/.test(String(value || ''));

/** '044123456' → '044-123-456'. Çdo gjë tjetër kthehet e paprekur. */
export function formatPhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    // Numrat e huaj (me +, me hapësira, me gjatësi tjetër) nuk formatohen
    if (!isLocalPhone(raw)) return raw;
    const d = raw.replace(/\D/g, '');
    return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join('-');
}

export default function PhoneInput({
    label, value, onChange, required = false, span = false, hint,
}) {
    // Një numër që nuk i përshtatet formës vendore është i huaj: fusha
    // hapet drejt e në mënyrën e lirë, pa e detyruar përdoruesin ta zgjedhë.
    const [free, setFree] = useState(() => Boolean(value) && !isLocalPhone(value));

    const digits = phoneDigits(value);
    const incomplete = !free && digits.length > 2 && digits.length < 9;

    const handleLocal = (e) => onChange(phoneDigits(e.target.value));

    const handleFocus = () => {
        if (!free && !digits) onChange('04');
    };

    /** Nëse mbeti vetëm parashtesa, fusha lihet bosh — s'është numër. */
    const handleBlur = () => {
        if (!free && digits.length <= 2) onChange('');
    };

    const toggle = () => {
        setFree((wasFree) => {
            if (wasFree) {
                // Nga «tjetër» te forma vendore. Një numër i huaj nuk shkurtohet
                // dot në nëntë shifra pa u kthyer në numër tjetër — «+41 76 123
                // 45 67» do të bëhej «417-612-345», që i përket dikujt tjetër.
                // Prandaj mbahet vetëm nëse është vërtet numër vendor; përndryshe
                // fusha zbrazet dhe shkruhet nga e para.
                onChange(isLocalPhone(value) ? phoneDigits(value) : '');
            }
            return !wasFree;
        });
    };

    return (
        <Field
            label={
                <>
                    {label}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={free}
                        className={`phone-other${free ? ' active' : ''}`}
                        title="Numër i huaj ose në formë tjetër — shkruhet i lirë"
                        onClick={toggle}
                    >
                        <i aria-hidden="true" />
                        tjetër
                    </button>
                </>
            }
            required={required}
            span={span}
            hint={incomplete ? 'Numri duhet të ketë nëntë shifra, p.sh. 044-123-456' : hint}
        >
            {free ? (
                <input
                    type="tel"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={required}
                    maxLength={30}
                    placeholder="p.sh. +41 76 123 45 67"
                />
            ) : (
                <input
                    type="tel"
                    inputMode="numeric"
                    value={formatPhone(digits) || digits}
                    onChange={handleLocal}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    required={required}
                    maxLength={11}
                    placeholder="04X-XXX-XXX"
                    className={incomplete ? 'input-warn' : undefined}
                />
            )}
        </Field>
    );
}