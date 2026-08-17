export default function StarsDisplay({ rating }) {
  if (!rating) return null
  return (
    <div className="item-stars">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
        <span key={i} className={'star ' + (i <= rating ? 'on' : 'off')}>★</span>
      ))}
      <span className="star-score">{rating}/10</span>
    </div>
  )
}
