import { Fragment } from 'react'

const VALUES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

export default function StarInput({ name, value, onChange, className = 'star-input' }) {
  return (
    <div className={className}>
      {VALUES.map((v) => (
        <Fragment key={v}>
          <input
            type="radio"
            name={name}
            id={`${name}-${v}`}
            value={v}
            checked={value === v}
            onChange={() => onChange(v)}
          />
          <label htmlFor={`${name}-${v}`}>★</label>
        </Fragment>
      ))}
    </div>
  )
}
