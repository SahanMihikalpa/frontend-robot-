import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  listUsers, updateUser, deleteUser,
  bulkImportUsers, downloadUsersCsvTemplate,
  type AdminUser,
} from '../../lib/api'
import { getStoredUser } from '../../lib/session'
import CsvImportModal from '../../components/CsvImportModal'
import ModalMobileHeader from '../../components/ModalMobileHeader'

const ROLES: AdminUser['role'][] = ['student', 'teacher', 'admin']

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
}

function RoleBadge({ role }: { role: string }) {
  const variant: Record<string, string> = {
    student: 'success',
    teacher: 'warning',
    admin: 'danger',
  }
  return (
    <span className={`badge ${variant[role] || 'neutral'}`}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  const [showImport, setShowImport] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<{ id: number; message: string } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const me = getStoredUser()
  const myId = me?.id

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listUsers()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let list = users
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [users, roleFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { student: 0, teacher: 0, admin: 0 }
    users.forEach((u) => { c[u.role] = (c[u.role] || 0) + 1 })
    return c
  }, [users])

  async function applyUpdate(user: AdminUser, payload: { role?: AdminUser['role']; is_active?: boolean }) {
    setSavingId(user.id)
    setRowError(null)
    // optimistic update
    const prev = users
    setUsers((list) => list.map((u) => (u.id === user.id ? { ...u, ...payload } : u)))
    try {
      const updated = await updateUser(user.id, payload)
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)))
    } catch (err: any) {
      setUsers(prev) // revert
      setRowError({ id: user.id, message: err?.response?.data?.detail || 'Update failed' })
    } finally {
      setSavingId(null)
    }
  }

  function changeRole(user: AdminUser, role: AdminUser['role']) {
    if (role === user.role) return
    applyUpdate(user, { role })
  }

  function toggleActive(user: AdminUser) {
    applyUpdate(user, { is_active: !user.is_active })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteUser(deleteTarget.id)
      setUsers((list) => list.filter((u) => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err: any) {
      setDeleteError(err?.response?.data?.detail || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="admin-dashboard student-dash">
      <section className="teacher-hero">
        <div>
          <p className="teacher-eyebrow">Operations</p>
          <h2 className="editorial-title">User management</h2>
          <p>
            Assign roles, activate or deactivate accounts, and bulk-create users from a CSV.
            You cannot change your own role or remove the last admin.
          </p>
        </div>
        <div className="teacher-hero-note">
          <span>Accounts</span>
          <strong>{users.length}</strong>
          <p>users total</p>
        </div>
      </section>

      <div className="teacher-roster-nav">
        <Link href="/dashboard/admin" className="teacher-action primary">
          <span>01</span>
          Admin Dashboard
        </Link>
        <Link href="/analytics" className="teacher-action">
          <span>02</span>
          Analytics
        </Link>
      </div>

      <section className="teacher-kpi-grid">
        <div className="teacher-kpi-card">
          <p>Total users</p>
          <strong>{users.length}</strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Students</p>
          <strong>{counts.student || 0}</strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Teachers</p>
          <strong>{counts.teacher || 0}</strong>
        </div>
        <div className="teacher-kpi-card">
          <p>Admins</p>
          <strong>{counts.admin || 0}</strong>
        </div>
      </section>

      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Filters</p>
            <h3 className="editorial-title">Search & scope</h3>
          </div>
          <button type="button" className="skills-action secondary" onClick={() => setShowImport(true)}>
            Bulk upload
          </button>
        </div>

        <div className="skills-search-row">
          <input
            type="search"
            placeholder="Search by name, username, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="skills-search-input"
          />
        </div>
        <div className="skills-chip-row">
          <button
            type="button"
            className={`skills-chip ${roleFilter === 'all' ? 'active' : ''}`}
            onClick={() => setRoleFilter('all')}
          >
            All ({users.length})
          </button>
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              className={`skills-chip ${roleFilter === r ? 'active' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {ROLE_LABELS[r]} ({counts[r] || 0})
            </button>
          ))}
        </div>

        {error && <p className="feedback error">{error}</p>}
      </section>

      <section className="teacher-panel">
        <div className="teacher-panel-header">
          <div>
            <p className="teacher-eyebrow">Accounts</p>
            <h3 className="editorial-title">User list</h3>
          </div>
          <span className="skills-count-pill subtle">
            {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
          </span>
        </div>

        {loading ? (
          <div className="empty-state"><p className="meta">Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No users found.</p></div>
        ) : (
          <div className="skills-table-wrap">
            <table className="skills-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isSelf = u.id === myId
                  const busy = savingId === u.id
                  return (
                    <tr key={u.id}>
                      <td>
                        <strong className="skills-name">{u.full_name || u.username}</strong>
                        <p className="meta" style={{ fontSize: 11, margin: '2px 0 0' }}>
                          @{u.username}{isSelf ? ' · you' : ''}
                        </p>
                      </td>
                      <td>{u.email}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        {u.is_active
                          ? <span className="badge success">Active</span>
                          : <span className="badge neutral">Inactive</span>}
                      </td>
                      <td>
                        <div className="skills-row-actions" style={{ alignItems: 'center' }}>
                          <select
                            value={u.role}
                            disabled={busy || isSelf}
                            title={isSelf ? 'You cannot change your own role' : 'Change role'}
                            onChange={(e) => changeRole(u, e.target.value as AdminUser['role'])}
                            style={{ padding: '4px 8px' }}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`skills-mini-action ${u.is_active ? 'danger' : ''}`}
                            disabled={busy || isSelf}
                            title={isSelf ? 'You cannot deactivate your own account' : ''}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="skills-mini-action danger"
                            disabled={busy || isSelf}
                            title={isSelf ? 'You cannot delete your own account' : 'Delete user'}
                            onClick={() => { setDeleteError(''); setDeleteTarget(u) }}
                          >
                            Delete
                          </button>
                          {rowError?.id === u.id && (
                            <span className="feedback error" style={{ margin: 0, fontSize: 11 }}>
                              {rowError.message}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showImport && (
        <CsvImportModal
          title="Bulk create users from CSV"
          subtitle="Create many accounts at once. Download the template, fill one user per row, then upload it. Existing usernames or emails are skipped. Leave the password blank to auto-generate a temporary one."
          columnsHint="username (required), email (required), full_name, role (student | teacher | admin), password (optional, min 8 chars)"
          onDownloadTemplate={downloadUsersCsvTemplate}
          onImport={bulkImportUsers}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {deleteTarget && (
        <div className="modal-overlay skills-modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal skills-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <ModalMobileHeader
              title="Delete user?"
              subtitle="This cannot be undone"
              backLabel="Back to user list"
              onBack={() => !deleting && setDeleteTarget(null)}
            />
            <div className="skills-modal-scroll">
              <p className="meta">
                "<strong>{deleteTarget.full_name || deleteTarget.username}</strong>" (@{deleteTarget.username})
                and all of their learning data — interactions, mastery, sessions, and history — will be
                permanently removed.
              </p>

              {deleteError && <p className="feedback error">{deleteError}</p>}

              <div className="skills-modal-actions">
                <button type="button" className="skills-modal-button danger" onClick={confirmDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Yes, delete user'}
                </button>
                <button type="button" className="skills-modal-button" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
