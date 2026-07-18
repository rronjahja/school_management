export default function EmptyState({ title, hint, action }) {
  return (
    <div className="empty-state">
      <div className="empty-glyph" aria-hidden="true">
        ∅
      </div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  );
}
