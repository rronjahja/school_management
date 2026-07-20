const SVG_STYLE = {
  width: '100%',
  height: '100%',
  display: 'block',
};

function AvatarFrame({ children }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      style={SVG_STYLE}
    >
      <circle cx="32" cy="32" r="32" fill="currentColor" opacity="0.14" />
      {children}
      <circle
        cx="32"
        cy="32"
        r="31"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.24"
      />
    </svg>
  );
}

function GirlAvatarGraphic() {
  return (
    <AvatarFrame>
      <path
        fill="currentColor"
        d="M16.2 27.3C16.2 15.8 22.7 9 32.3 9c10.2 0 16.3 7.2 16.3 18.9v14.4H15.9l.3-15Z"
      />
      <path
        fill="currentColor"
        d="M44.2 31.2c7.7 1.3 10.8 7.4 8.7 13.8.8 6-1.5 10.1-6.6 13.7 1.1-3.1.7-5.6-1.3-7.7-3.4-3.5-5.2-8.2-4.6-12.6.4-3.1 1.6-5.5 3.8-7.2Z"
      />
      <path
        fill="#fff"
        d="M20.4 27.3c0-1.1.1-2.1.2-3.1 5.6-1.5 9.8-4.4 12.3-8.8 2.8 4.1 7.3 6.9 13.4 8.3.2 1.1.3 2.3.3 3.6 0 9.7-5.7 17.6-13.1 17.6s-13.1-7.9-13.1-17.6Z"
      />
      <path fill="#fff" d="M27.2 42.2h10.6v7.1H27.2z" />
      <path
        fill="currentColor"
        d="M8.3 64c.7-10 4.8-15.3 12.4-17.2l6.5-1.7 5.3 6.2 5.3-6.2 6.5 1.7C51.9 48.7 56 54 56.7 64H8.3Z"
      />
      <path
        fill="#fff"
        opacity="0.9"
        d="m24.5 45.8 8 5.5-5.4 6.3-5.4-10.9 2.8-.9Zm16 0-8 5.5 5.4 6.3 5.4-10.9-2.8-.9Z"
      />
    </AvatarFrame>
  );
}

function BoyAvatarGraphic() {
  return (
    <AvatarFrame>
      <path
        fill="currentColor"
        d="M17 27.7c0-5.9 1.2-10.6 4.7-13.9C24.6 11 28.2 9.4 32.4 9.4c8.5 0 14.7 4.7 15.3 13.6.1 1.6 0 3.2-.2 4.8l-4.2 2.4-1.4-8.1c-5.7 3.6-13.3 5.4-22.2 3.7l-.8 5.2-1.9-3.3Z"
      />
      <path
        fill="currentColor"
        d="M17.8 21.2c3.4-8.5 10-12.3 18.8-11.7 4.7.3 8.3 2.1 10.8 5.2-8.7-2.3-17.7.3-29.6 6.5Z"
      />
      <path
        fill="#fff"
        d="M19.5 25c8.9 1.9 16.6.1 22.5-3.6l1.3 7.7 4-2.2c0 10-6.4 18-14.8 18S17.7 37 17.7 27l1.8-2Z"
      />
      <path fill="#fff" d="M27.2 42.3h10.6v7H27.2z" />
      <path
        fill="currentColor"
        d="M7.6 64c.8-10.1 5.1-15.4 12.9-17.3l6.7-1.6 5.3 6.1 5.3-6.1 6.7 1.6c7.8 1.9 12.1 7.2 12.9 17.3H7.6Z"
      />
      <path
        fill="#fff"
        opacity="0.9"
        d="m24.5 45.8 8 5.4-5.4 6.4-5.5-10.9 2.9-.9Zm16 0-8 5.4 5.4 6.4 5.5-10.9-2.9-.9Z"
      />
    </AvatarFrame>
  );
}

function NeutralAvatarGraphic() {
  return (
    <AvatarFrame>
      <circle cx="32" cy="25" r="11" fill="#fff" />
      <path
        fill="currentColor"
        d="M8.5 64c.8-11.7 9.1-19 23.5-19s22.7 7.3 23.5 19h-47Z"
      />
      <path
        fill="#fff"
        opacity="0.9"
        d="m24.8 45.9 7.2 5.7 7.2-5.7 4.3 1.4-5.1 10.3L32 52.8l-6.4 4.8-5.1-10.3 4.3-1.4Z"
      />
    </AvatarFrame>
  );
}

function normalizeGender(value) {
  return String(value || '').trim().toLowerCase();
}

export default function Avatar({ student, size = 46 }) {
  const {
    gender,
    first_name: first,
    last_name: last,
    category_color: color,
  } = student || {};

  const normalizedGender = normalizeGender(gender);
  const fullName = `${first || ''} ${last || ''}`.trim();
  const avatarColor = color || 'var(--primary)';

  const style = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    flex: `0 0 ${size}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: '50%',
    color: avatarColor,
    background: 'transparent',
    fontSize: 0,
    lineHeight: 0,
  };

  const isFemale = ['f', 'female', 'femër', 'femer'].includes(normalizedGender);
  const isMale = ['m', 'male', 'mashkull'].includes(normalizedGender);

  return (
    <span
      style={style}
      role="img"
      aria-label={fullName ? `Profili i ${fullName}` : 'Profili i nxënësit'}
      title={fullName}
    >
      {isFemale ? (
        <GirlAvatarGraphic />
      ) : isMale ? (
        <BoyAvatarGraphic />
      ) : (
        <NeutralAvatarGraphic />
      )}
    </span>
  );
}