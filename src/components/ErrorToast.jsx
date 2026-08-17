export default function ErrorToast({ message }) {
  if (!message) return null
  return <div className="error-toast">{message}</div>
}
