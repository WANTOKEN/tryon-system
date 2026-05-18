import PropTypes from 'prop-types'

export default function Checkbox({
  id,
  checked,
  onChange,
  label,
  labelClassName = '',
  checkboxClassName = '',
  ...props
}) {
  return (
    <div className='flex items-start gap-3'>
      <div className='relative flex h-5 w-5 flex-shrink-0 items-center justify-center'>
        <input
          type='checkbox'
          id={id}
          checked={checked}
          onChange={onChange}
          className={`peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-gray-300 transition-all checked:border-green-500 checked:bg-green-500 hover:border-green-400 ${checkboxClassName}`}
          {...props}
        />
        <svg
          className='pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M5 13l4 4L19 7' />
        </svg>
      </div>
      {label && (
        <label
          htmlFor={id}
          className={`block cursor-pointer text-xs leading-relaxed text-gray-600 ${labelClassName}`}
        >
          {label}
        </label>
      )}
    </div>
  )
}

Checkbox.propTypes = {
  id: PropTypes.string.isRequired,
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.node,
  labelClassName: PropTypes.string,
  checkboxClassName: PropTypes.string,
}
