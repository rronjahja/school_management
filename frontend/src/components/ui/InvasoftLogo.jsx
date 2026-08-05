import Logo from './Logo.jsx';
import { LOGOS } from '../../config/assets.js';

/**
 * Logoja e kompanisë Invasoft.
 * Skedari: `public/logos/invasoft.svg` (shiko README-në atje).
 *
 * `fluid` — zë të gjithë gjerësinë e kontejnerit (p.sh. te menyja anësore).
 * `variant="icon"` — përdor `invasoft-icon.svg` nëse ekziston.
 */
export default function InvasoftLogo({
  height = 18,
  fluid = false,
  variant = 'full',
  tone = 'dark',
  className = '',
}) {
  let src = LOGOS.invasoft;
  if (variant === 'icon') src = LOGOS.invasoftIcon;
  else if (tone === 'light') src = LOGOS.invasoftLight;

  return (
    <Logo
      src={src}
      fallback={LOGOS.invasoft}
      alt="Invasoft"
      height={height}
      fluid={fluid}
      className={className}
    />
  );
}