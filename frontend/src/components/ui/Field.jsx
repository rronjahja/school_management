/** Etikete + kontroll formulari, me shenjen e detyrueshme dhe nje shpjegim opsional. */
export default function Field({ label, required, children, span, hint }) {
  return (
    <label className={`field${span ? ' field-span' : ''}`}>
      <span className="field-label">
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}