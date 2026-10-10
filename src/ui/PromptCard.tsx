import { useState } from 'react'
import { director } from '../app/game'
import { emptyDay, dayKey } from '../app/store'
import { useApp } from '../app/useStore'

/** The current break/reminder card with its actions. Used on the page and in PiP. */
export function PromptCard({ compact }: { compact?: boolean }) {
  const prompt = useApp((s) => s.session.prompt)
  const notifications = useApp((s) => s.settings.notifications)
  const day = useApp((s) => s.progress.diary[dayKey()])
  const [asked, setAsked] = useState(false)
  if (!prompt) return null
  const stats = day ?? emptyDay(dayKey())

  const reminder = ['break', 'hydrate', 'meeting', 'lunch', 'eyes'].includes(prompt.kind)
  const canAsk = reminder && !notifications && !asked && typeof Notification !== 'undefined' && Notification.permission === 'default'

  const actions: [string, Parameters<typeof director.respond>[0], boolean?][] =
    prompt.kind === 'hydrate'
      ? [['I drank 💧', 'done', true], ['Snooze', 'snooze'], ['Skip', 'skip']]
      : prompt.kind === 'break' || prompt.kind === 'eyes'
        ? [['Done ✓', 'done', true], ...(prompt.kind === 'eyes' ? [['Snooze', 'snooze'] as [string, 'snooze']] : []), ['Skip', 'skip']]
        : prompt.kind === 'lunch'
          ? [['Going! 🍱', 'done', true], ['Later', 'skip']]
          : prompt.kind === 'focusDone'
            ? [['Start focus', 'start', true], ['Not now', 'skip']]
            : prompt.kind === 'meeting'
              ? [['Got it', 'skip', true]]
              : prompt.kind === 'summary'
                ? [['Good night 🌙', 'skip', true]]
                : [['Yay! 🎉', 'skip', true]]

  return (
    <div className={`prompt-card kind-${prompt.kind} ${compact ? 'compact' : ''}`} role="alert">
      <div className="prompt-text">
        <strong>{prompt.title}</strong>
        {!compact && prompt.body && <span>{prompt.body}</span>}
        {prompt.kind === 'summary' && !compact && (
          <div className="summary-stats">
            <span>✅ {stats.tasksDone} tasks</span>
            <span>☕ {stats.breaksTaken} breaks</span>
            <span>💕 {stats.pets} pets</span>
            <span>⭐ {stats.xp} XP</span>
          </div>
        )}
      </div>
      <div className="prompt-actions">
        {actions.map(([label, action, primary]) => (
          <button key={label} className={primary ? 'primary' : 'chip'} onClick={() => director.respond(action)}>
            {label}
          </button>
        ))}
        {canAsk && !compact && (
          <button
            className="link"
            onClick={() => {
              setAsked(true)
              void director.enableNotifications()
            }}
          >
            🔔 Remind me even when the cat is hidden
          </button>
        )}
      </div>
    </div>
  )
}
