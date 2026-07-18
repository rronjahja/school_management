export default function CategoryChip({ name, color }) {
  return (
    <span className="category-chip" style={{ '--chip-color': color || '#2E6FB7' }}>
      <span className="chip-dot" />
      {name}
    </span>
  );
}
