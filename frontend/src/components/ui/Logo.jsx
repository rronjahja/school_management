/**
 * Komponent bazë për logot.
 *
 * - `height` — lartësia në px, gjerësia rregullohet vetvetiu.
 * - `fluid`  — logoja zë të gjithë gjerësinë e kontejnerit, lartësia rregullohet vetvetiu.
 *
 * Kështu funksionojnë njësoj logot katrore dhe ato horizontale.
 * Nëse `src` mungon, kalohet automatikisht te `fallback`.
 */
export default function Logo({ src, fallback, alt, height = 40, fluid = false, className = '' }) {
  const handleError = (e) => {
    if (fallback && e.currentTarget.src !== fallback && !e.currentTarget.dataset.fallback) {
      e.currentTarget.dataset.fallback = '1';
      e.currentTarget.src = fallback;
    }
  };

  return (
    <img
      src={src}
      alt={alt}
      className={`logo${fluid ? ' logo-fluid' : ''} ${className}`.trim()}
      style={fluid ? undefined : { height: `${height}px` }}
      onError={handleError}
    />
  );
}