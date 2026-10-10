import { useMemo } from 'react'
import { pet } from '../app/game'
import { UNLOCKS, levelFor } from '../app/progress'
import { dayKey, emptyDay, store } from '../app/store'
import { useApp } from '../app/useStore'

const prettyDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return key === dayKey() ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

export function Diary() {
  const progress = useApp((s) => s.progress)
  const saved = useApp((s) => s.thoughts.saved)
  const lvl = levelFor(progress.xp)
  const days = useMemo(() => Object.values(progress.diary).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14), [progress.diary])
  const totals = useMemo(() => days.reduce((t, d) => ({ tasks: t.tasks + d.tasksDone, breaks: t.breaks + d.breaksTaken }), { tasks: 0, breaks: 0 }), [days])
  const today = progress.diary[dayKey()] ?? emptyDay(dayKey())

  return (
    <div className="diary">
      <section className="panel bond">
        <div className="bond-head">
          <div>
            <h2>
              {pet.name}'s diary
            </h2>
            <p className="muted">
              {progress.daysTogether} day{progress.daysTogether === 1 ? '' : 's'} together · {totals.tasks} tasks done · {totals.breaks} breaks taken
            </p>
          </div>
          <div className="level-badge big">Lv {lvl.level}</div>
        </div>
        <div className="xp-bar" title={`${lvl.into} / ${lvl.needed} XP`}>
          <div style={{ width: `${lvl.progress * 100}%` }} />
        </div>
        <p className="muted small">
          {lvl.needed - lvl.into} XP to level {lvl.level + 1}. Care for {pet.name}, take breaks and finish tasks to earn XP.
        </p>
        <div className="unlocks">
          {UNLOCKS.map((u) => (
            <span key={u.id} className={`unlock ${lvl.level >= u.level ? 'on' : ''}`}>
              {lvl.level >= u.level ? '✨' : '🔒'} {u.label} <span className="muted">Lv {u.level}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="day-cards">
        {(days.length ? days : [today]).map((d) => (
          <div key={d.date} className="panel day-card">
            <h3>{prettyDay(d.date)}</h3>
            <div className="day-stats">
              <span>✅ {d.tasksDone} tasks</span>
              <span>☕ {d.breaksTaken} breaks</span>
              <span>🍚 {d.feeds} meals</span>
              <span>💕 {d.pets} pets</span>
              <span>🧶 {d.plays} plays</span>
              <span>⭐ {d.xp} XP</span>
            </div>
          </div>
        ))}
      </section>

      <section className="panel">
        <h3>Saved thoughts</h3>
        {saved.length ? (
          <ul className="saved-thoughts">
            {saved.map((t) => (
              <li key={t.id}>
                <span>“{t.text}”</span>
                <button className="icon" title="Remove" onClick={() => store.set((s) => ({ ...s, thoughts: { ...s.thoughts, saved: s.thoughts.saved.filter((x) => x.id !== t.id) } }))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">Tap ⭐ on a thought bubble to keep it here.</p>
        )}
      </section>
    </div>
  )
}
