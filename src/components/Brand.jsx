export default function Brand({ large = false }) {
  return (
    <span className={'wordmark' + (large ? ' wordmark-large' : '')}>
      <span className="wordmark-name">koleksiyonum<span aria-hidden="true">/</span></span>
      <span className="wordmark-caption">kitap · film · dizi</span>
    </span>
  )
}
