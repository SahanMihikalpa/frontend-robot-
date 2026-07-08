import { useRef, useState } from 'react'
import type { BulkImportResult } from '../lib/api'
import ModalMobileHeader from './ModalMobileHeader'

type Props = {
  title: string
  subtitle: string
  columnsHint: string
  onDownloadTemplate: () => Promise<void> | void
  onImport: (file: File) => Promise<BulkImportResult>
  onImported: () => Promise<void> | void
  onClose: () => void
}

export default function CsvImportModal({
  title, subtitle, columnsHint, onDownloadTemplate, onImport, onImported, onClose,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BulkImportResult | null>(null)

  async function handleDownload() {
    setError('')
    try {
      await onDownloadTemplate()
    } catch {
      setError('Template download failed')
    }
  }

  async function handleImport() {
    if (!file) { setError('Choose a CSV file first'); return }
    setUploading(true)
    setError('')
    try {
      const res = await onImport(file)
      setResult(res)
      if (res.created > 0) await onImported()
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  function pickAnotherFile() {
    setResult(null)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="modal-overlay skills-modal-overlay" onClick={onClose}>
      <div className="modal skills-modal" onClick={(e) => e.stopPropagation()}>
        <ModalMobileHeader
          title={title}
          subtitle="Bulk Import"
          backLabel="Close import dialog"
          onBack={onClose}
        />

        <div className="skills-modal-scroll">
          <p className="skills-modal-subtitle">{subtitle}</p>

          {!result ? (
            <>
              <p className="modal-section-label">Step 1 — Download template</p>
              <div className="field">
                <label>Template columns</label>
                <p className="meta" style={{ fontSize: 11, marginBottom: 6 }}>
                  {columnsHint}
                </p>
                <button type="button" className="skills-action secondary" onClick={handleDownload}>
                  Download CSV template
                </button>
              </div>

              <p className="modal-section-label">Step 2 — Upload your filled CSV</p>
              <div className="field">
                <label>CSV file</label>
                <label className="csv-file-drop">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <span className="csv-file-drop-icon" aria-hidden="true">↑</span>
                  {file ? (
                    <span className="csv-file-drop-name">{file.name}</span>
                  ) : (
                    <span className="csv-file-drop-hint">
                      <strong>Choose a CSV file</strong>
                      or drop it here
                    </span>
                  )}
                </label>
              </div>

              {error && <p className="feedback error">{error}</p>}

              <div className="skills-modal-actions">
                <button
                  type="button"
                  className="skills-modal-button primary"
                  onClick={handleImport}
                  disabled={uploading || !file}
                >
                  {uploading ? 'Importing…' : 'Import'}
                </button>
                <button type="button" className="skills-modal-button" onClick={onClose}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="modal-section-label">Import results</p>
              <div className="field">
                <label>Summary</label>
                <p className="meta" style={{ marginTop: 4 }}>
                  {result.created} created · {result.skipped} skipped (already exist) ·{' '}
                  {result.errors.length} failed · {result.total_rows} rows total
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="field">
                  <label>Row errors</label>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {result.errors.map((e, i) => (
                      <p key={i} className="feedback error" style={{ margin: '4px 0', fontSize: 12 }}>
                        Row {e.row}: {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {result.notes && result.notes.length > 0 && (
                <div className="field">
                  <label>Temporary passwords</label>
                  <p className="meta" style={{ fontSize: 11, marginBottom: 6 }}>
                    Copy these now — they are shown only once. Share each password with its
                    user and ask them to change it after first sign-in.
                  </p>
                  <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {result.notes.map((n, i) => (
                      <p key={i} className="meta" style={{ margin: '4px 0', fontSize: 12, fontFamily: 'monospace' }}>
                        {n}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="skills-modal-actions">
                <button type="button" className="skills-modal-button" onClick={pickAnotherFile}>
                  Import another file
                </button>
                <button type="button" className="skills-modal-button primary" onClick={onClose}>Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
