import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useVenue } from '../../contexts/VenueContext'
import { useSession } from '../../contexts/SessionContext'
import { useToast } from '../../components/ui/Toast'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

function useNotices(venueId) {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const { data } = await supabase
      .from('noticeboard_posts')
      .select('*')
      .eq('venue_id', venueId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data ?? [])
    setLoading(false)
  }, [venueId])

  useEffect(() => { load() }, [load])
  return { notices, loading, reload: load }
}

function PostCard({ notice, isManager, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <div className={`bg-white rounded-2xl p-5 flex flex-col gap-3 ${notice.pinned ? 'border-accent/30' : 'border-charcoal/10'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {notice.pinned && (
            <span title="Pinned" className="text-accent shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V17z"/></svg>
            </span>
          )}
          <h3 className="font-semibold text-charcoal text-base leading-snug">{notice.title}</h3>
        </div>
        {isManager && (
          <div className="shrink-0">
            {confirming ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-charcoal/40">Delete?</span>
                <button
                  onClick={async () => {
                    setDeleting(true)
                    await onDelete(notice.id)
                    setDeleting(false)
                    setConfirming(false)
                  }}
                  disabled={deleting}
                  className="text-xs text-danger font-medium hover:text-danger/80 transition-colors"
                >
                  {deleting ? '…' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="text-xs text-charcoal/40 hover:text-charcoal transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="text-xs text-charcoal/30 hover:text-danger transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {notice.body && (
        <p className="text-sm text-charcoal/70 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-charcoal/6">
        {notice.created_by_name && (
          <span className="text-[11px] text-charcoal/35">{notice.created_by_name}</span>
        )}
        <span className="text-[11px] text-charcoal/25">·</span>
        <span className="text-[11px] text-charcoal/35">
          {format(new Date(notice.created_at), 'd MMM yyyy, HH:mm')}
        </span>
      </div>
    </div>
  )
}

function NewPostForm({ venueId, staffName, onPosted, onCancel }) {
  const toast = useToast()
  const [form, setForm] = useState({ title: '', body: '', pinned: false })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast('Title is required', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('noticeboard_posts').insert({
      venue_id: venueId,
      title: form.title.trim(),
      body: form.body.trim() || null,
      pinned: form.pinned,
      created_by_name: staffName,
    })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    toast('Notice posted ✓')
    onPosted()
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border-charcoal/10 p-5 flex flex-col gap-4">
      <p className="text-[11px] tracking-widest uppercase text-charcoal/40">New Notice</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Title <span className="text-danger">*</span></label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="e.g. Staff meeting this Friday"
          className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] tracking-widest uppercase text-charcoal/40">Message</label>
        <textarea
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder="Add more detail here…"
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg border border-charcoal/15 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-charcoal/20 placeholder-charcoal/25"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => set('pinned', !form.pinned)}
          className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.pinned ? 'bg-accent' : 'bg-charcoal/20'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.pinned ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-sm text-charcoal/70">Pin this notice to the top</span>
      </label>

      <div className="flex gap-2 pt-1 border-t border-charcoal/8">
        <Button type="submit" variant="primary" disabled={saving} className="flex-1">
          {saving ? 'Posting…' : 'Post Notice'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function NoticeBoardPage() {
  const { venueId } = useVenue()
  const { session, isManager } = useSession()
  const toast = useToast()
  const { notices, loading, reload } = useNotices(venueId)
  const [showForm, setShowForm] = useState(false)

  const deleteNotice = async (id) => {
    const { error } = await supabase.from('noticeboard_posts').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast('Notice deleted')
    reload()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-charcoal">Noticeboard</h1>
        {isManager && !showForm && (
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Post Notice
          </Button>
        )}
      </div>

      {isManager && showForm && (
        <NewPostForm
          venueId={venueId}
          staffName={session?.staffName ?? 'Manager'}
          onPosted={() => { setShowForm(false); reload() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10"><LoadingSpinner /></div>
      ) : notices.length === 0 ? (
        <div className="bg-white rounded-2xl border-dashed border-charcoal/20 p-10 text-center">
          <p className="text-charcoal/30 text-sm">No notices yet.</p>
          {isManager && (
            <p className="text-xs text-charcoal/25 mt-1">Post the first notice above.</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {notices.map((notice) => (
            <PostCard
              key={notice.id}
              notice={notice}
              isManager={isManager}
              onDelete={deleteNotice}
            />
          ))}
        </div>
      )}
    </div>
  )
}
