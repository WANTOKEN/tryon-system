import PropTypes from 'prop-types'

const VARIANTS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'bg-error text-white hover:bg-error/90',
  ghost: 'hover:bg-gray-100 text-gray-600',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm',
  xl: 'px-8 py-4 text-base',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  leftIcon,
  rightIcon,
  ...props
}) {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 touch-target'
  const variantClass = VARIANTS[variant] || VARIANTS.primary
  const sizeClass = SIZES[size] || SIZES.md
  const stateClass =
    disabled || loading ? 'btn-disabled opacity-50 cursor-not-allowed' : 'hover:shadow-md active:scale-95'

  return (
    <button
      type='button'
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClass} ${sizeClass} ${stateClass} ${className}`}
      {...props}
    >
      {loading && (
        <span className='h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent' />
      )}
      {!loading && leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'ghost']),
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  className: PropTypes.string,
  leftIcon: PropTypes.node,
  rightIcon: PropTypes.node,
}
