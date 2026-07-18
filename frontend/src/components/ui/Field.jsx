/** Etikete + kontroll formulari, me shenjen e detyrueshme. */
export default function Field({ label, required, children, span }) {
  return (
    <label className={`field${span ? ' field-span' : ''}`}>
      <span className="field-label">
        {label}
        {required && <em aria-hidden="true"> *</em>}
      </span>
      {children}
    </label>
  );
}
