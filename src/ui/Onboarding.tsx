import { useMemo, useState } from 'react'
import { director, pet } from '../app/game'
import { store } from '../app/store'
import { useApp } from '../app/useStore'
import { type AppearanceInput, Pet, emptyScene } from '../engine'
import { PetStage } from '../react/PetStage'
import { pipSupported } from '../react/usePictureInPicture'
import { FrequencyPicker, VibePicker, WorkdayFields, BreakFields } from './Settings'
import { Customizer } from './wardrobe/Customizer'
import { COATS, randomAppearance } from './wardrobe/presets'
import { NameField, PersonalityPicker, ScenePicker } from './wardrobe/Wardrobe'

const STEPS = ['Welcome', 'Adopt', 'Make it yours', 'Personality', 'Thoughts', 'Your day', 'Today', 'Home', 'Ready'] as const

const setStep = (n: number) => store.set((s) => ({ ...s, onboardingStep: Math.max(0, Math.min(STEPS.length - 1, n)) }))

/** Six adoptable kittens, each a tiny live cat. */
function AdoptGrid() {
  const [roll, setRoll] = useState(0)
  const [picked, setPicked] = useState(-1)
  const kittens = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const look: AppearanceInput = roll === 0 && i < COATS.length ? { ...randomAppearance(), ...COATS[i].look } : randomAppearance()
        return { look, pet: new Pet({ appearance: look, scene: emptyScene(220), personality: { chaotic: 0.2, lazy: 0.5 } }) }
      }),
    [roll],
  )
  return (
    <>
      <div className="adopt-grid">
        {kittens.map((k, i) => (
          <button
            key={`${roll}-${i}`}
            className={`adopt-card ${picked === i ? 'on' : ''}`}
            onClick={() => {
              setPicked(i)
              pet.setAppearance(k.look)
            }}
          >
            <PetStage pet={k.pet} className="adopt-stage" fps={30} worldHeight={190} bubbles={false} />
          </button>
        ))}
      </div>
      <button className="chip" onClick={() => setRoll((r) => r + 1)}>
        🎲 Show me other kittens
      </button>
    </>
  )
}

function QuickTasks() {
  const tasks = useApp((s) => s.tasks)
  const [text, setText] = useState('')
  return (
    <>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (director.addTask(text)) setText('')
        }}
      >
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. “Standup 10:30 15m”, “Finish the deck”, “1:1 with Sam at 3pm”" />
        <button className="primary">Add</button>
      </form>
      <ul className="task-list">
        {tasks.map((t) => (
          <li key={t.id}>
            <label>
              <span className="task-time">{t.start ?? ''}</span>
              <span className="task-title">{t.title}</span>
              {t.durationMin && <span className="muted small">{t.durationMin}m</span>}
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Onboarding({ onTakeWithYou }: { onTakeWithYou: () => Promise<void> | void }) {
  const step = useApp((s) => s.onboardingStep)
  const online = useApp((s) => s.settings.onlineThoughts)
  const name = pet.name

  const finish = () => store.set((s) => ({ ...s, onboarded: true, onboardingStep: 0 }))

  const body = (() => {
    switch (step) {
      case 0:
        return (
          <>
            <h1>Hi! I'm your new desk cat 🐾</h1>
            <p>I keep you company while you work: in a tiny window on top of everything, with your to-do list and gentle break reminders.</p>
            <ul className="promise">
              <li>✨ Nothing to install, no account</li>
              <li>🔒 Everything stays in this browser</li>
              <li>🧘 Calm by default. I go quiet when you focus.</li>
            </ul>
          </>
        )
      case 1:
        return (
          <>
            <h2>Adopt a kitten</h2>
            <p className="muted">Pick the one that steals your heart. You can change everything next.</p>
            <AdoptGrid />
          </>
        )
      case 2:
        return (
          <>
            <h2>Make them yours</h2>
            <Customizer pet={pet} />
          </>
        )
      case 3:
        return (
          <>
            <h2>Name & personality</h2>
            <NameField />
            <PersonalityPicker showSliders={false} />
          </>
        )
      case 4:
        return (
          <>
            <h2>What should {name} think about?</h2>
            <p className="muted">Little thought bubbles through the day. Pick any you like.</p>
            <VibePicker />
            <div className="row">
              <span className="muted small">How often</span>
              <FrequencyPicker />
            </div>
            <label className="check">
              <input type="checkbox" checked={online} onChange={(e) => store.set((s) => ({ ...s, settings: { ...s.settings, onlineThoughts: e.target.checked } }))} />
              Mix in fresh quotes & cat facts from free online sources
            </label>
          </>
        )
      case 5:
        return (
          <>
            <h2>Your workday</h2>
            <p className="muted">{name} will remind you about lunch and breaks, and say good night when you're done.</p>
            <WorkdayFields />
            <BreakFields />
          </>
        )
      case 6:
        return (
          <>
            <h2>Anything on today's list?</h2>
            <p className="muted">Add a few things. Times become reminders. You can skip this.</p>
            <QuickTasks />
          </>
        )
      case 7:
        return (
          <>
            <h2>Pick a home</h2>
            <p className="muted">More rooms unlock as your bond grows.</p>
            <ScenePicker />
          </>
        )
      default:
        return (
          <>
            <h2>Take {name} with you</h2>
            {pipSupported() ? (
              <>
                <p>Click below and {name} hops into a small window that stays on top of your other apps (email, docs, calls).</p>
                <ul className="promise">
                  <li>📌 Pin this tab: closing it closes {name}'s window too</li>
                  <li>🖱️ Hover the window for food, water, play & focus</li>
                  <li>🐾 Move your cursor across {name} to pet them</li>
                </ul>
              </>
            ) : (
              <p>Your browser doesn't support picture-in-picture windows (desktop Chrome, Edge and Firefox do), so {name} will float in the corner of this page instead.</p>
            )}
          </>
        )
    }
  })()

  return (
    <div className="onboarding">
      <div className="onb-stage">
        <PetStage pet={pet} className="stage" camera="follow" worldHeight={230} />
      </div>
      <div className="onb-card panel">
        <div className="onb-steps" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={i === step ? 'on' : i < step ? 'done' : ''} title={s} />
          ))}
        </div>
        <div className="onb-body">{body}</div>
        <div className="onb-nav">
          {step > 0 && (
            <button className="chip" onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          )}
          <span className="spacer" />
          {step > 0 && step < STEPS.length - 1 && (
            <button className="link" onClick={() => setStep(step + 1)}>
              Skip
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button className="primary big" onClick={() => setStep(step + 1)}>
              {step === 0 ? "Let's go!" : 'Next →'}
            </button>
          ) : (
            <>
              <button className="chip" onClick={finish}>
                Maybe later
              </button>
              <button
                className="primary big"
                onClick={async () => {
                  finish()
                  await onTakeWithYou()
                }}
              >
                {pipSupported() ? '🪟 Take me with you' : '📌 Float in corner'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
