import PropTypes from 'prop-types'

const STEP_ICONS = {
  avatar: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    />
  ),
  clothing: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2z'
    />
  ),
  tryon: (
    <path
      strokeLinecap='round'
      strokeLinejoin='round'
      strokeWidth='2'
      d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
    />
  ),
  check: <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='3' d='M5 13l4 4L19 7' />,
}

export default function StepIndicator({ steps, currentStep, className = '' }) {
  return (
    <div className={`step-indicator-wrapper ${className}`}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isActive = index === currentStep

        let statusClass = ''
        if (isCompleted) {
          statusClass = 'completed'
        } else if (isActive) {
          statusClass = 'active'
        } else {
          statusClass = 'pending'
        }

        return (
          <div key={step.key} className='step-indicator-item'>
            <div className={`step-indicator-v2 ${statusClass}`}>
              <div className='step-dot-v2'>
                <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  {isCompleted ? STEP_ICONS.check : STEP_ICONS[step.icon]}
                </svg>
              </div>
              <span className='step-label'>{step.label}</span>
            </div>
            {index < steps.length - 1 && <div className='step-line' />}
          </div>
        )
      })}
    </div>
  )
}

StepIndicator.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.oneOf(['avatar', 'clothing', 'tryon', 'check']).isRequired,
    })
  ).isRequired,
  currentStep: PropTypes.number.isRequired,
  className: PropTypes.string,
}
