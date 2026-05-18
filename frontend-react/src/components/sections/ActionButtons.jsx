import PropTypes from 'prop-types'

export default function ActionButtons({ hasResult }) {
  if (!hasResult) {
    return null
  }

  return null
}

ActionButtons.propTypes = {
  hasResult: PropTypes.bool.isRequired,
}
