export default function Loader({ text = 'Duke ngarkuar…' }) {
  return (
    <div className="loader" role="status">
      <span className="loader-ring" aria-hidden="true" />
      {text}
    </div>
  );
}
