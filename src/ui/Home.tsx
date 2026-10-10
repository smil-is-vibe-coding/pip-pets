import { pet } from '../app/game'
import { PetStage } from '../react/PetStage'
import { usePetSnapshot } from '../react/usePet'
import { CareBar, NeedsMeter } from './CareBar'
import { PromptCard } from './PromptCard'
import { useRateThought } from './hooks'
import { NextUpChip, TodayPanel } from './TodayPanel'

interface Props {
  pipOpen: boolean
  pipSupported: boolean
  resumeHint: boolean
  widgetOpen: boolean
  onTakeWithYou: () => void
  onBringBack: () => void
}

export function Home({ pipOpen, pipSupported, resumeHint, widgetOpen, onTakeWithYou, onBringBack }: Props) {
  const snap = usePetSnapshot(pet)
  const rate = useRateThought()
  const away = pipOpen || widgetOpen

  return (
    <div className="home">
      <section className="stage-card">
        {resumeHint && !away && (
          <div className="resume-banner">
            <span>
              👋 {snap.name} was keeping you company. Bring them back to your corner?
            </span>
            <button className="primary" onClick={onTakeWithYou}>
              Resume with {snap.name}
            </button>
          </div>
        )}
        <PromptCard />
        {away ? (
          <div className="away">
            <div className="away-emoji">🐈</div>
            <p>
              <strong>{snap.name}</strong> is keeping you company {pipOpen ? 'in the picture-in-picture window' : 'in the corner'}.
            </p>
            {pipOpen && <p className="muted small">📌 Tip: pin this tab (right-click → Pin) so it doesn't get closed by accident. Closing it closes the window too.</p>}
            <button className="primary" onClick={onBringBack}>
              Bring {snap.name} back
            </button>
          </div>
        ) : (
          <PetStage pet={pet} className="stage" camera="fit" onSpeechAction={rate} />
        )}
        <div className="stage-actions">
          <CareBar pet={pet} snap={snap} />
          <button className="primary big" onClick={away ? onBringBack : onTakeWithYou}>
            {away ? '↩ Bring back' : pipSupported ? '🪟 Take me with you' : '📌 Float in corner'}
          </button>
        </div>
        {!pipSupported && <p className="muted small">Picture-in-picture (cat on top of all your windows) needs desktop Chrome, Edge or Firefox. Here it floats in the corner of this page instead.</p>}
      </section>
      <aside>
        <div className="panel">
          <NeedsMeter snap={snap} />
          <div className="next-row">
            <NextUpChip />
          </div>
        </div>
        <TodayPanel />
      </aside>
    </div>
  )
}
