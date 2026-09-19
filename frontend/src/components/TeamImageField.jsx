import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'

import { resolveMediaURL } from '../services/api'

const MAX_SIZE = 5 * 1024 * 1024

export default function TeamImageField({
  currentURL = '',
  file = null,
  onFileChange,
  onRemove,
  teamName = '',
  compact = false,
  disabled = false,
}) {
  const inputId = useId()
  const [error, setError] = useState('')

  const preview = useMemo(
    () => file ? URL.createObjectURL(file) : '',
    [file],
  )

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const chooseFile = (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''

    if (!selected) return

    if (!['image/jpeg', 'image/png'].includes(selected.type)) {
      setError('Gunakan gambar JPG atau PNG.')
      return
    }

    if (selected.size > MAX_SIZE) {
      setError('Ukuran gambar maksimal 5 MB.')
      return
    }

    setError('')
    onFileChange(selected)
  }

  const source = preview || resolveMediaURL(currentURL)

  return (
    <div className={`team-image-field ${compact ? 'is-compact' : ''}`}>
      <div className={`team-image-preview ${source ? 'has-image' : ''}`}>
        {source ? (
          <img src={source} alt={`Preview gambar ${teamName || 'team'}`} />
        ) : (
          <div>
            <ImagePlus size={compact ? 28 : 42} />
            <strong>{teamName || 'Gambar Team'}</strong>
            <span>Tampilkan identitas team kamu</span>
          </div>
        )}
      </div>

      <div className="team-image-controls">
        <label className="button button-secondary" htmlFor={inputId}>
          <Upload size={15} />
          {source ? 'Ganti Gambar' : 'Pilih Gambar'}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png"
          onChange={chooseFile}
          disabled={disabled}
        />

        {file && (
          <button
            className="team-image-remove"
            type="button"
            onClick={() => onFileChange(null)}
            disabled={disabled}
          >
            Batal pilih
          </button>
        )}

        {!file && currentURL && onRemove && (
          <button
            className="team-image-remove"
            type="button"
            onClick={onRemove}
            disabled={disabled}
          >
            <Trash2 size={14} /> Hapus gambar
          </button>
        )}

        <small>JPG atau PNG, maksimal 5 MB.</small>
        {error && <span className="team-image-error" role="alert">{error}</span>}
      </div>
    </div>
  )
}
