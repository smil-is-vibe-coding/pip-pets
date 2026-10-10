import { useEffect, useRef } from 'react'
import { type Pet, type PetViewOptions, mountPetView } from '../engine'

interface PetStageProps extends PetViewOptions {
  pet: Pet
  className?: string
}

/**
 * Mounts the engine's SVG view into a div. Works inside portals to other
 * documents (the PiP window) because the view binds to the div's own window.
 */
export function PetStage({ pet, className, fps, sleepFps, worldHeight, interactive, camera, bubbles, onSpeechAction }: PetStageProps) {
  const ref = useRef<HTMLDivElement>(null)
  const actionRef = useRef(onSpeechAction)
  useEffect(() => {
    actionRef.current = onSpeechAction
  }, [onSpeechAction])
  useEffect(() => {
    const view = mountPetView(ref.current!, pet, {
      fps,
      sleepFps,
      worldHeight,
      interactive,
      camera,
      bubbles,
      onSpeechAction: (s, a) => actionRef.current?.(s, a),
    })
    return () => view.destroy()
  }, [pet, fps, sleepFps, worldHeight, interactive, camera, bubbles])
  return <div ref={ref} className={className} />
}
