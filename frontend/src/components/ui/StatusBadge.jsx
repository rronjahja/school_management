import { STATUS_META } from '../../utils/format';

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.ok;
  return (
    <span className={`badge badge-${meta.tone}`}>
      <span className="badge-dot" />
      {meta.label}
    </span>
  );
}
