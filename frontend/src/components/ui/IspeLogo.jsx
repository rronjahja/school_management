import Logo from './Logo.jsx';
import { LOGOS } from '../../config/assets.js';

/**
 * Logoja e shkollës ISPE.
 * Skedari: `public/logos/ispe.svg` (shiko README-në atje).
 */
export default function IspeLogo({ height = 40, tone = 'dark', className = '' }) {
  return (
    <Logo
      src={tone === 'light' ? LOGOS.ispeLight : LOGOS.ispe}
      fallback={LOGOS.ispe}
      alt="Logoja e shkollës ISPE"
      height={height}
      className={className}
    />
  );
}