import PropTypes from 'prop-types'

const ICONS = {
  upload: (
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='M12 4v16m8-8H4' />
  ),
  camera: (
    <>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
        d='M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
        d='M15 13a3 3 0 11-6 0 3 3 0 016 0z'
      />
    </>
  ),
  user: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    />
  ),
  check: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2.5' d='M5 13l4 4L19 7' />,
  sun: (
    <>
      <circle
        cx='12'
        cy='12'
        r='4'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
        d='M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41'
      />
    </>
  ),
  moon: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'
    />
  ),
  globe: (
    <>
      <circle
        cx='12'
        cy='12'
        r='9'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
        d='M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18'
      />
    </>
  ),
  palette: (
    <>
      <circle
        cx='12'
        cy='12'
        r='9'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.5'
        d='M12 3a6 6 0 00-6 6c0 3.314 4 3.314 4 6 0 1.657-1 2-3 2M14 3a1 1 0 00-1 1v2a1 1 0 001 1 1 1 0 001-1V4a1 1 0 00-1-1zM18 9a1 1 0 00-1 1v2a1 1 0 001 1 1 1 0 001-1v-2a1 1 0 00-1-1z'
      />
    </>
  ),
  refresh: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
    />
  ),
  trash: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
    />
  ),
  heart: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
    />
  ),
  heartFilled: (
    <path
      fill='currentColor'
      d='M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001a.752.752 0 01-.704 0l-.003-.001z'
    />
  ),
  share: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
    />
  ),
  search: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7'
    />
  ),
  close: (
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12' />
  ),
  menu: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M4 6h16M4 12h16M4 18h16'
    />
  ),
  clock: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    />
  ),
  image: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
    />
  ),
  info: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
    />
  ),
  sparkle: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
    />
  ),
  logout: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'
    />
  ),
  store: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M3 9l1.5-4h15L21 9m-18 0h18m-18 0v11a1 1 0 001 1h16a1 1 0 001-1V9M8 13h2m4 0h2m-10 4h2m4 0h2'
    />
  ),
  users: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 100-8 4 4 0 000 8zm6 0a4 4 0 100-8 4 4 0 000 8z'
    />
  ),
  chevronRight: (
    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 18l6-6-6-6' />
  ),
  history: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M12 8v4l3 3m6-3a9 9 0 11-3.5-7.1M21 3v5h-5'
    />
  ),
  plus: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 5v14M5 12h14' />,
  qr: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 3h3m0 0h3m-3 0v3m0-3v3'
    />
  ),
  mobile: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'
    />
  ),
  eye: (
    <>
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
      />
      <path
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='2'
        d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
      />
    </>
  ),
  wardrobe: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='1.5'
      d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    />
  ),
  document: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    />
  ),
  loader: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83'
    />
  ),
}

export default function Icon({ name, className = '', ...props }) {
  const iconPath = ICONS[name]

  if (!iconPath) {
    console.warn(`Icon "${name}" not found`)
    return null
  }

  return (
    <svg className={className} fill='none' stroke='currentColor' viewBox='0 0 24 24' {...props}>
      {iconPath}
    </svg>
  )
}

Icon.propTypes = {
  name: PropTypes.oneOf(Object.keys(ICONS)).isRequired,
  className: PropTypes.string,
}
