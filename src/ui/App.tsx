import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { catAudio } from '../app/audio'
import { director, pet, pipFlag } from '../app/game'
import { levelFor } from '../app/progress'
import { store } from '../app/store'
import { useApp } from '../app/useStore'
import { getScene } from '../engine'
import { usePersistence, usePetSnapshot } from '../react/usePet'
import { usePictureInPicture } from '../react/usePictureInPicture'
import { savePet } from '../storage'
import { Companion } from './Companion'
import { Diary } from './Diary'
import { Home } from './Home'
import { Onboarding } from './Onboarding'
import { type Route, go, useRoute } from './router'
import { Settings } from './Settings'
import { Wardrobe } from './wardrobe/Wardrobe'

const NAV: { id: Route; label: string }[] = [
  { id: 'home', label: '🏠 Home' },
  { id: 'wardrobe', label: '🎀 Wardrobe' },
  { id: 'diary', label: '📔 Diary' },
  { id: 'settings', label: '⚙️ Settings' },
]

export default function App() {
  const onboarded = useApp((s) => s.onboarded)
  const xp = useApp((s) => s.progress.xp)
  const sound = useApp((s) => s.settings.sound)
  const sceneId = useApp((s) => s.settings.sceneId)
  const route = useRoute()
  const snap = usePetSnapshot(pet)
  const pip = usePictureInPicture()
  const [widget, setWidget] = useState(false)
  const [resumeHint] = useState(() => pipFlag.get())

  usePersistence(pet, useCallback((p: typeof pet) => savePet(p), []))

  useEffect(() => {
    director.start()
    if (import.meta.env.DEV) Object.assign(window, { pet, director, store, catAudio })
    return () => director.stop()
  }, [])

  // Keep the cat's room in sync with settings (e.g. after an import).
  useEffect(() => {
    if (pet.world.def.id !== sceneId) pet.setScene(getScene(sceneId))
  }, [sceneId])

  useEffect(() => {
    director.pipOpen = !!pip.pipWindow
    pipFlag.set(!!pip.pipWindow)
  }, [pip.pipWindow])

  // Browsers only allow audio after a click: arm it on the first one,
  // in the page or in the PiP window (its events don't reach this window).
  useEffect(() => {
    if (!sound) return
    const targets = [window, pip.pipWindow].filter((w): w is Window => !!w)
    const arm = () => catAudio.enable()
    targets.forEach((w) => w.addEventListener('pointerdown', arm, { once: true }))
    return () => targets.forEach((w) => w.removeEventListener('pointerdown', arm))
  }, [sound, pip.pipWindow])

  const takeWithYou = async () => {
    if (pip.supported) {
      await pip.open({ width: 320, height: 300 })
    } else setWidget(true)
    if (sound) catAudio.enable()
  }
  const bringBack = () => {
    pip.close()
    setWidget(false)
  }

  const lvl = levelFor(xp)
  const companion = <Companion />

  return (
    <>
      {!onboarded ? (
        <Onboarding onTakeWithYou={takeWithYou} />
      ) : (
        <div className="app">
          <header className="topbar">
            <a className="brand" href="#/home">
              🐾 Pip Pets
            </a>
            <nav>
              {NAV.map((n) => (
                <button key={n.id} className={route === n.id ? 'on' : ''} onClick={() => go(n.id)}>
                  {n.label}
                </button>
              ))}
            </nav>
            <button className="level-badge" title={`${lvl.into}/${lvl.needed} XP to next level`} onClick={() => go('diary')}>
              <span>
                {snap.name} · Lv {lvl.level}
              </span>
              <span className="mini-xp">
                <span style={{ width: `${lvl.progress * 100}%` }} />
              </span>
            </button>
          </header>
          <main>
            {route === 'home' && <Home pipOpen={!!pip.pipWindow} pipSupported={pip.supported} resumeHint={resumeHint} widgetOpen={widget} onTakeWithYou={takeWithYou} onBringBack={bringBack} />}
            {route === 'wardrobe' && <Wardrobe />}
            {route === 'diary' && <Diary />}
            {route === 'settings' && <Settings />}
          </main>
        </div>
      )}
      {pip.pipWindow && createPortal(companion, pip.pipWindow.document.body)}
      {widget && !pip.pipWindow && (
        <div className="float-widget">
          <Companion onClose={() => setWidget(false)} />
        </div>
      )}
    </>
  )
}
