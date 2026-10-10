import { useState } from 'react'
import { catAudio } from '../app/audio'
import { director, pet } from '../app/game'
import { type BreakStyle, type Settings as S, type ThoughtFreq, type Vibe, store } from '../app/store'
import { VIBE_LABELS } from '../app/thoughts/packs'
import { useApp } from '../app/useStore'
import { ACTIONS, type ActionId, type CueKind } from '../engine'
import { clearSave, savePet } from '../storage'

const patch = (p: Partial<S>) => store.set((s) => ({ ...s, settings: { ...s.settings, ...p } }))
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function VibePicker() {
  const vibes = useApp((s) => s.settings.vibes)
  const toggle = (v: Vibe) => patch({ vibes: vibes.includes(v) ? vibes.filter((x) => x !== v) : [...vibes, v] })
  return (
    <div className="vibe-cards">
      {(Object.keys(VIBE_LABELS) as Vibe[]).map((v) => (
        <button key={v} className={`vibe-card ${vibes.includes(v) ? 'on' : ''}`} onClick={() => toggle(v)}>
          <span className="emoji">{VIBE_LABELS[v].emoji}</span>
          <strong>{VIBE_LABELS[v].label}</strong>
          <span className="muted small">“{VIBE_LABELS[v].sample}”</span>
        </button>
      ))}
    </div>
  )
}

export function FrequencyPicker() {
  const freq = useApp((s) => s.settings.thoughtFreq)
  return (
    <div className="segmented">
      {(['rare', 'sometimes', 'chatty'] as ThoughtFreq[]).map((f) => (
        <button key={f} className={freq === f ? 'on' : ''} onClick={() => patch({ thoughtFreq: f })}>
          {f === 'rare' ? 'Rare' : f === 'sometimes' ? 'Sometimes' : 'Chatty'}
        </button>
      ))}
    </div>
  )
}

export function WorkdayFields() {
  const s = useApp((x) => x.settings)
  return (
    <div className="grid2">
      <label className="field">
        <span>Work starts</span>
        <input type="time" value={s.workStart} onChange={(e) => patch({ workStart: e.target.value })} />
      </label>
      <label className="field">
        <span>Work ends</span>
        <input type="time" value={s.workEnd} onChange={(e) => patch({ workEnd: e.target.value })} />
      </label>
      <label className="field">
        <span>Lunch</span>
        <input type="time" value={s.lunch ?? ''} onChange={(e) => patch({ lunch: e.target.value || null })} />
      </label>
      <div className="field">
        <span>Workdays</span>
        <div className="days">
          {DAYS.map((d, i) => (
            <button key={i} className={s.workdays.includes(i) ? 'on' : ''} onClick={() => patch({ workdays: s.workdays.includes(i) ? s.workdays.filter((x) => x !== i) : [...s.workdays, i].sort() })}>
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const BREAK_STYLES: { id: BreakStyle; label: string; blurb: string }[] = [
  { id: 'pomodoro', label: '🍅 Pomodoro', blurb: 'Focus 25 min, break 5. Start focus when you want.' },
  { id: 'gentle', label: '🌿 Gentle', blurb: 'A stretch nudge every 50 minutes.' },
  { id: 'water', label: '💧 Just water', blurb: 'Only hydration reminders.' },
  { id: 'off', label: '🔕 Off', blurb: 'No break reminders.' },
]

export function BreakFields() {
  const s = useApp((x) => x.settings)
  return (
    <>
      <div className="preset-cards">
        {BREAK_STYLES.map((b) => (
          <button
            key={b.id}
            className={`preset-card ${s.breakStyle === b.id ? 'on' : ''}`}
            onClick={() => patch({ breakStyle: b.id, hydrateEveryMin: b.id === 'off' ? 0 : s.hydrateEveryMin || 60 })}
          >
            <strong>{b.label}</strong>
            <span className="muted small">{b.blurb}</span>
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={s.eyeBreaks} onChange={(e) => patch({ eyeBreaks: e.target.checked })} />
        20-20-20 eye breaks (look far away every 20 minutes)
      </label>
    </>
  )
}

function CustomThoughts() {
  const custom = useApp((s) => s.thoughts.custom)
  const [text, setText] = useState('')
  return (
    <div>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          store.set((s) => ({ ...s, thoughts: { ...s.thoughts, custom: [...s.thoughts.custom, text.trim()] } }))
          setText('')
        }}
      >
        <input value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder="Your own line, e.g. “Call mom after work 💕”" />
        <button className="primary">Add</button>
      </form>
      <ul className="saved-thoughts">
        {custom.map((t, i) => (
          <li key={i}>
            <span>{t}</span>
            <button className="icon" onClick={() => store.set((s) => ({ ...s, thoughts: { ...s.thoughts, custom: s.thoughts.custom.filter((_, j) => j !== i) } }))}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function exportData() {
  savePet(pet)
  const blob = new Blob([JSON.stringify({ app: JSON.parse(store.export()), pet: pet.toJSON() }, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pip-pets-${pet.name.toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function importData(file: File) {
  try {
    const data = JSON.parse(await file.text())
    if (data.app) store.import(JSON.stringify(data.app))
    if (data.pet) localStorage.setItem('pip-pets:cat:v1', JSON.stringify(data.pet))
    location.reload()
  } catch {
    alert("That file doesn't look like a Pip Pets backup.")
  }
}

const LAB: ActionId[] = ['explore', 'watch', 'perch', 'loaf', 'groom', 'sleep', 'checkBowl', 'drink', 'seekAttention', 'batYarn', 'hunt', 'scratch', 'hide', 'cowork', 'zoomies', 'knead']
const CUES: CueKind[] = ['greet', 'celebrate', 'remind', 'stretch-break', 'drink', 'look-outside', 'goodnight']

function DevLab() {
  const [speed, setSpeed] = useState(pet.simSpeed)
  const [hour, setHour] = useState<number | ''>('')
  return (
    <section className="panel">
      <h3>🧪 Animation lab (dev only)</h3>
      <div className="coat-row">
        {LAB.map((id) => (
          <button key={id} className="chip" onClick={() => pet.start(id, undefined, true)}>
            {id}
          </button>
        ))}
      </div>
      <div className="coat-row">
        {CUES.map((c) => (
          <button key={c} className="chip" onClick={() => pet.cue(c)}>
            cue: {c}
          </button>
        ))}
      </div>
      <div className="grid2">
        <label className="field">
          <span>Time speed ×{speed}</span>
          <input type="range" min={1} max={600} value={speed} onChange={(e) => (pet.setSimSpeed(Number(e.target.value)), setSpeed(Number(e.target.value)))} />
        </label>
        <label className="field">
          <span>Time of day {hour === '' ? '(real)' : `${hour}:00`}</span>
          <input
            type="range"
            min={-1}
            max={23.9}
            step={0.5}
            value={hour === '' ? -1 : hour}
            onChange={(e) => {
              const v = Number(e.target.value)
              pet.world.hourOverride = v < 0 ? null : v
              setHour(v < 0 ? '' : v)
            }}
          />
        </label>
      </div>
      <div className="coat-row">
        <button className="chip" onClick={() => pet.setNeed('fullness', 15)}>Hungry</button>
        <button className="chip" onClick={() => pet.setNeed('hydration', 15)}>Thirsty</button>
        <button className="chip" onClick={() => pet.setNeed('energy', 10)}>Tired</button>
        <button className="chip" onClick={() => pet.setNeed('affection', 15)}>Lonely</button>
        <button className="chip" onClick={() => pet.setNeed('fun', 15)}>Bored</button>
        <button className="chip" onClick={() => pet.setAnnoyance(80)}>Grumpy</button>
        <button className="chip" onClick={() => store.set((s) => ({ ...s, progress: { ...s.progress, xp: s.progress.xp + 200 } }))}>+200 XP</button>
        <button className="chip" onClick={() => store.set((s) => ({ ...s, session: { ...s.session, lastHydrate: 0 } }))}>Trigger water break</button>
      </div>
    </section>
  )
}

export function Settings() {
  const s = useApp((x) => x.settings)
  return (
    <div className="settings">
      <section className="panel">
        <h3>🗓️ Workday</h3>
        <WorkdayFields />
        <label className="field narrow">
          <span>Remind me before meetings</span>
          <select value={s.meetingReminderMin} onChange={(e) => patch({ meetingReminderMin: Number(e.target.value) })}>
            {[1, 2, 5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel">
        <h3>☕ Breaks</h3>
        <BreakFields />
        <div className="grid2">
          <label className="field">
            <span>Focus length</span>
            <select value={s.focusMin} onChange={(e) => patch({ focusMin: Number(e.target.value) })}>
              {[15, 25, 30, 45, 50, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Break length</span>
            <select value={s.breakMin} onChange={(e) => patch({ breakMin: Number(e.target.value) })}>
              {[3, 5, 10, 15].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Water reminders</span>
            <select value={s.hydrateEveryMin} onChange={(e) => patch({ hydrateEveryMin: Number(e.target.value) })}>
              <option value={0}>Off</option>
              {[30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  Every {m} min
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <h3>💭 Thoughts</h3>
        <VibePicker />
        <div className="row">
          <span className="muted small">How often</span>
          <FrequencyPicker />
        </div>
        <label className="check">
          <input type="checkbox" checked={s.onlineThoughts} onChange={(e) => patch({ onlineThoughts: e.target.checked })} />
          Mix in fresh quotes, advice and cat facts from free online sources (DummyJSON, Advice Slip, catfact.ninja, meowfacts). Nothing about you is sent.
        </label>
        <h4>Your own lines</h4>
        <CustomThoughts />
      </section>

      <section className="panel">
        <h3>🔔 Sound & reminders</h3>
        <label className="check">
          <input
            type="checkbox"
            checked={s.sound}
            onChange={(e) => {
              patch({ sound: e.target.checked })
              if (e.target.checked) {
                catAudio.enable()
                catAudio.play('meow')
              } else catAudio.disable()
            }}
          />
          Cat sounds (meows, purrs, all synthesized)
        </label>
        {s.sound && (
          <label className="field narrow">
            <span>Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => (patch({ volume: Number(e.target.value) }), catAudio.setVolume(Number(e.target.value)))} />
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={s.notifications}
            onChange={async (e) => {
              if (e.target.checked) await director.enableNotifications()
              else patch({ notifications: false })
            }}
          />
          Desktop notifications when the cat isn't visible
        </label>
      </section>

      <section className="panel">
        <h3>💾 Your data</h3>
        <p className="muted small">Everything lives in this browser only. Nothing is uploaded.</p>
        <div className="coat-row">
          <button className="chip" onClick={exportData}>
            ⬇️ Export backup
          </button>
          <label className="chip file">
            ⬆️ Import backup
            <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </label>
          <button
            className="chip danger"
            onClick={() => {
              if (!confirm(`This deletes ${pet.name}, your tasks and progress. Continue?`)) return
              store.reset()
              clearSave()
              location.reload()
            }}
          >
            🗑️ Start over
          </button>
        </div>
      </section>

      {import.meta.env.DEV && <DevLab />}
      <p className="muted small center">{Object.keys(ACTIONS).length} cat behaviors · made with 🧡</p>
    </div>
  )
}
