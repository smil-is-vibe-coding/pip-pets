import { pet } from '../app/game'
import { useApp } from '../app/useStore'
import { PetStage } from '../react/PetStage'
import { usePetSnapshot } from '../react/usePet'
import { CareBar, NeedsMeter } from './CareBar'
import { useRateThought } from './hooks'
import { PromptCard } from './PromptCard'
import { FocusTimer, NextUpChip } from './TodayPanel'

/**
 * The compact companion: lives in the Picture-in-Picture window (or the
 * floating in-page widget). Follow camera, next task, prompt, hover HUD.
 */
export function Companion({ onClose }: { onClose?: () => void }) {
  const snap = usePetSnapshot(pet)
  const focus = useApp((s) => s.session.focus.mode)
  const rate = useRateThought()
  return (
    <div className="companion">
      <PetStage pet={pet} className="companion-stage" camera="follow" fps={30} sleepFps={12} onSpeechAction={rate} />
      <div className="companion-top">
        <NextUpChip />
        {focus !== 'idle' && <FocusTimer compact />}
      </div>
      <div className="companion-prompt">
        <PromptCard compact />
      </div>
      <div className="companion-hud">
        <div className="hud-row">
          <NeedsMeter snap={snap} compact />
          {focus === 'idle' && <FocusTimer compact />}
        </div>
        <CareBar pet={pet} snap={snap} compact />
      </div>
      {onClose && (
        <button className="companion-close" title="Close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  )
}
