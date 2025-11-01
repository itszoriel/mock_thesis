import { useEffect, useState } from 'react'
import { useAdminStore } from '../lib/store'
import type { AdminState, User } from '../lib/store'
import { authApi, mediaUrl, showToast } from '../lib/api'

export default function Profile() {
  const storeUser = useAdminStore((state: AdminState) => state.user)
  const updateUser = useAdminStore((state: AdminState) => state.updateUser)
  const [user, setUser] = useState<User | undefined>(storeUser)
  const [form, setForm] = useState<{ first_name: string; middle_name?: string; last_name: string; phone_number?: string }>(
    { first_name: storeUser?.first_name || '', middle_name: storeUser?.middle_name || '', last_name: storeUser?.last_name || '', phone_number: (storeUser as any)?.phone_number || '' }
  )
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Refresh profile on mount to ensure latest data
    ;(async () => {
      try {
        const res = await authApi.getProfile()
        const u = ((res as any)?.data || res) as User
        setUser(u)
        setForm({ first_name: u.first_name || '', middle_name: u.middle_name || '', last_name: u.last_name || '', phone_number: (u as any).phone_number || '' })
        updateUser(u)
      } catch {}
    })()
  }, [updateUser])

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8">
        <div className="flex items-center gap-6 mb-6">
          {user?.profile_picture ? (
            <img src={mediaUrl(user.profile_picture)} alt="Profile" className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-neutral-200 flex items-center justify-center text-neutral-700 text-2xl font-semibold">
              {(user?.first_name?.[0] || 'A')}{(user?.last_name?.[0] || '')}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">{user?.first_name} {user?.last_name}</h2>
            <p className="text-neutral-600">{user?.email}</p>
            <p className="text-neutral-600">{user?.admin_municipality_name || user?.municipality_name}</p>
            <div className="mt-3 flex items-center gap-2">
              <input type="file" accept="image/*" onChange={(e) => setFile((e.target.files && e.target.files[0]) || null)} />
              <button
                className="px-3 py-1.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm"
                disabled={!file}
                onClick={async () => {
                  if (!file) return
                  try {
                    const res = await authApi.uploadProfilePhoto(file)
                    const u = (res as any)?.data?.user || (res as any)?.user || res
                    setUser(u)
                    updateUser(u)
                    setFile(null)
                    showToast('Profile photo updated', 'success')
                  } catch (e: any) {
                    const msg = e?.response?.data?.error || 'Failed to upload photo'
                    showToast(msg, 'error')
                  }
                }}
              >Upload</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Personal Information</h3>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-neutral-500">First name</span>
                <input className="input-field mt-1" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-neutral-500">Middle name</span>
                <input className="input-field mt-1" value={form.middle_name || ''} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-neutral-500">Last name</span>
                <input className="input-field mt-1" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </label>
              <div className="flex justify-between"><span className="text-neutral-500">Username</span><span className="text-neutral-900">{user?.username || '—'}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Email</span><span className="text-neutral-900">{user?.email || '—'}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Admin Assignment</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Municipality name</span><span className="text-neutral-900">{user?.admin_municipality_name || user?.municipality_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Municipality slug</span><span className="text-neutral-900">{user?.admin_municipality_slug || user?.municipality_slug || '—'}</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Role</span><span className="text-neutral-900">{user?.role || '—'}</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Security</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Password</span><span className="text-neutral-900">••••••••</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Admin secret</span><span className="text-neutral-900">••••••••</span></div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Verification Documents</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-neutral-500">Valid ID (front)</span><span className="text-neutral-900">On file</span></div>
              <div className="flex justify-between"><span className="text-neutral-500">Valid ID (back)</span><span className="text-neutral-900">On file</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          <button
            className="px-5 py-2 rounded bg-ocean-600 text-white hover:bg-ocean-700 disabled:opacity-60"
            disabled={saving || !form.first_name || !form.last_name}
            onClick={async () => {
              setSaving(true)
              try {
                const res = await authApi.updateProfile({ first_name: form.first_name, middle_name: form.middle_name, last_name: form.last_name, phone_number: form.phone_number })
                const u = (res as any)?.data?.user || (res as any)?.user || res
                setUser(u)
                updateUser(u)
                showToast('Profile updated', 'success')
              } catch (e: any) {
                const msg = e?.response?.data?.error || 'Failed to update profile'
                showToast(msg, 'error')
              } finally {
                setSaving(false)
              }
            }}
          >Save Changes</button>
        </div>
      </div>
    </div>
  )
}



