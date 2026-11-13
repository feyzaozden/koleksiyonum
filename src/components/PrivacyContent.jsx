export default function PrivacyContent({ body }) {
  return body.split(/\n\s*\n/).map((part, index) => {
    if (part.startsWith('## ')) return <h2 key={index}>{part.slice(3)}</h2>
    return <p key={index} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{part.split(/([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/g).map((text, i) => /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(text) ? <a key={i} href={`mailto:${text}`}>{text}</a> : text)}</p>
  })
}
