import { useMemo, useState } from 'react'
import { director } from '../app/game'
import { currentBlock, nextUp, tasksFor } from '../app/planner'
import { dayKey, formatTime, minutesNow } from '../app/store'
import { useApp } from '../app/useStore'
import { useNow } from './hooks'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function FocusTimer({ compact }: { compact?: boolean }) {
  const focus = useApp((s) => s.session.focus)
  const focusMin = useApp((s) => s.settings.focusMin)
  const dndUntil = useApp((s) => s.session.dndUntil)
  const now = useNow(1000)
  const active = focus.mode !== 'idle'
  const total = focus.endsAt - focus.startedAt || 1
  const left = focus.endsAt - now
  const pct = active ? Math.min(1, Math.max(0, 1 - left / total)) : 0
  const dnd = dndUntil > now

  return (
    <div className={`focus-timer ${focus.mode} ${compact ? 'compact' : ''}`}>
      <div className="ring" style={{ background: `conic-gradient(var(--ring) ${pct * 360}deg, var(--line) 0)` }}>
        <span>{active ? mmss(left) : `${focusMin}m`}</span>
      </div>
      {!compact && (
        <div className="focus-info">
          <strong>{focus.mode === 'focus' ? 'Focusing…' : focus.mode === 'break' ? 'On a break' : 'Focus timer'}</strong>
          <span className="muted small">{focus.mode === 'focus' ? 'Bubbles are quiet until the break.' : `${focus.cycle} session${focus.cycle === 1 ? '' : 's'} today`}</span>
        </div>
      )}
      {focus.mode === 'focus' ? (
        <button className="chip" onClick={() => director.stopFocus()}>
          Stop
        </button>
      ) : (
        <button className="primary" onClick={() => director.startFocus()}>
          {compact ? '▶' : '▶ Focus'}
        </button>
      )}
      {!compact && (
        <button className={`chip ${dnd ? 'on' : ''}`} title="Quiet mode for meetings" onClick={() => director.setDnd(dnd ? 0 : 60)}>
          {dnd ? '🔕 Quiet on' : '🔕 Meeting'}
        </button>
      )}
    </div>
  )
}

/** The next task/block as a small chip; click to check it off. */
export function NextUpChip() {
  const tasks = useApp((s) => s.tasks)
  useNow(15000)
  const today = dayKey()
  const next = nextUp(tasks, today, minutesNow())
  const block = currentBlock(tasks, today, minutesNow())
  if (!next && !block) return null
  const t = block ?? next!.task
  const when = block ? 'now' : next!.inMin !== undefined ? (next!.inMin <= 0 ? 'now' : `in ${next!.inMin}m`) : ''
  return (
    <button className="next-chip" title="Click to mark done" onClick={() => director.toggleTask(t.id)}>
      <span>{t.kind === 'meeting' ? '🗓' : '✏️'}</span>
      <span className="next-title">{t.title}</span>
      {when && <span className="muted">{when}</span>}
    </button>
  )
}

export function TodayPanel() {
  const tasks = useApp((s) => s.tasks)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const today = dayKey()
  const list = useMemo(() => tasksFor(tasks, today), [tasks, today])
  useNow(30000)
  const nowMin = minutesNow()
  const done = list.filter((t) => t.done).length

  const add = () => {
    const task = director.addTask(text)
    if (task) setText('')
    setError(!task)
  }

  return (
    <div className="panel today">
      <div className="panel-head">
        <h3>Today</h3>
        <span className="muted small">
          {done}/{list.length} done
        </span>
      </div>
      <FocusTimer />
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add… e.g. “Standup 10:30 15m” or “Finish deck”" aria-invalid={error} />
        <button className="primary" type="submit">
          Add
        </button>
      </form>
      <ul className="task-list">
        {list.map((t) => {
          const past = t.start && !t.done && nowMin > Number(t.start.slice(0, 2)) * 60 + Number(t.start.slice(3)) + (t.durationMin ?? 30)
          return (
            <li key={t.id} className={`${t.done ? 'done' : ''} ${t.kind} ${past ? 'past' : ''}`}>
              <label>
                <input type="checkbox" checked={t.done} onChange={() => director.toggleTask(t.id)} />
                <span className="task-time">{t.start ? formatTime(t.start) : ''}</span>
                <span className="task-title">{t.title}</span>
                {t.durationMin && <span className="muted small">{t.durationMin}m</span>}
                {t.carriedFrom && <span className="tag">from {t.carriedFrom.slice(5)}</span>}
              </label>
              <button className="icon" title="Delete" onClick={() => director.deleteTask(t.id)}>
                ✕
              </button>
            </li>
          )
        })}
        {!list.length && <li className="empty muted small">Nothing planned yet. Add a task or a meeting and your cat will keep you on track.</li>}
      </ul>
    </div>
  )
}
