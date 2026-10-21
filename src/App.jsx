import { useCallback, useEffect, useMemo, useState } from 'react'
import Terrain from './components/Terrain'
import Hero from './components/Hero'
import Timeline from './components/Timeline'
import Lab from './components/Lab'
import Toolbox from './components/Toolbox'
import Scoreboard from './components/Scoreboard'
import GitHubActivity from './components/GitHubActivity'
import Connect from './components/Connect'
import ThemeSwitch from './components/ThemeSwitch'
import CommandPalette from './components/CommandPalette'
import { chapters, links, projects, toolbox } from './data'
import { THEMES, applyTheme, currentTheme, themeBefore } from './lib/theme'

const scrollToId = (id, block = 'start') => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block })
}

const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

export default function App() {
  const [theme, setTheme] = useState(currentTheme)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [pastHero, setPastHero] = useState(false)
  const themes = THEMES

  const changeTheme = useCallback((id) => {
    applyTheme(id)
    setTheme(id)
  }, [])
  const back = useMemo(() => themeBefore(theme, themes), [theme, themes])
  const repeatTheme = () => changeTheme(back.id)

  useEffect(() => {
    const name = document.querySelector('.hero__name')
    if (!name) return
    const io = new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting), {
      rootMargin: '-72px 0px 0px 0px',
    })
    io.observe(name)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (e.key === '/' && !isTyping(document.activeElement)) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const commands = useMemo(
    () => [
      ...chapters.map((c) => ({
        id: `chapter-${c.id}`,
        group: 'Jump to',
        label: `${c.year}: ${c.title}`,
        keywords: `${c.role} ${c.place} ${c.tags.join(' ')}`,
        run: () => scrollToId(`chapter-${c.id}`),
      })),
      { id: 'go-scoreboard', group: 'Jump to', label: 'The scoreboard', keywords: 'stats numbers highlights achievements', run: () => scrollToId('scoreboard') },
      { id: 'go-lab', group: 'Jump to', label: 'On the workbench', keywords: 'projects sensors terrin', run: () => scrollToId('lab') },
      { id: 'go-github', group: 'Jump to', label: 'GitHub activity', keywords: 'contributions commits josephcake jgaosos', run: () => scrollToId('github') },
      { id: 'go-tools', group: 'Jump to', label: 'Skills', keywords: 'tools skills toolbox stack ai builder', run: () => scrollToId('tools') },
      { id: 'go-contact', group: 'Jump to', label: 'Say hello', keywords: 'contact', run: () => scrollToId('contact') },
      {
        id: 'demo-dispatch',
        group: 'Try',
        label: 'Place a 9-1-1 call on the map',
        keywords: 'geospatial dispatch rapidsos manhattan map',
        run: () => {
          scrollToId('dispatch', 'center')
          setTimeout(() => window.dispatchEvent(new Event('dispatch:simulate')), 700)
        },
      },
      {
        id: 'demo-gis',
        group: 'Try',
        label: 'Crawl and search GIS services',
        keywords: 'geospatial arcgis catalog crawler redis search layers patent',
        run: () => {
          window.dispatchEvent(new CustomEvent('lab:open', { detail: 'gis' }))
          setTimeout(() => scrollToId('gis', 'center'), 120)
        },
      },
      {
        id: 'demo-indoor',
        group: 'Try',
        label: 'Find the way out of a building',
        keywords: 'indoor navigation floor plan route stairs elevator pathfinding',
        run: () => {
          window.dispatchEvent(new CustomEvent('lab:open', { detail: 'indoor' }))
          setTimeout(() => scrollToId('indoor', 'center'), 120)
        },
      },
      {
        id: 'demo-radar',
        group: 'Try',
        label: 'Get tracked by the sensor lab',
        keywords: 'hardware mmwave radar tracking raspberry pi sensor velocity intensity',
        run: () => {
          window.dispatchEvent(new CustomEvent('lab:open', { detail: 'radar' }))
          setTimeout(() => scrollToId('radar', 'center'), 120)
        },
      },
      ...themes.map((t) => ({
        id: `theme-${t.id}`,
        group: 'Theme',
        label: `Switch to ${t.name}`,
        swatch: t.id,
        hint: theme === t.id ? 'Current' : undefined,
        keywords: 'theme color dark light tennis roland garros wimbledon',
        run: () => changeTheme(t.id),
      })),
      { id: 'open-github', group: 'Open', label: 'Personal GitHub (josephcake)', keywords: 'github', run: () => window.open(links.github, '_blank', 'noopener') },
      { id: 'open-linkedin', group: 'Open', label: 'LinkedIn profile', run: () => window.open(links.linkedin, '_blank', 'noopener') },
      { id: 'open-terrin', group: 'Open', label: 'Terrin.io', run: () => window.open(links.terrin, '_blank', 'noopener') },
    ],
    [theme, themes, changeTheme],
  )

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Terrain />
      <nav className="nav" aria-label="Sections">
        <a className={`nav__home ${pastHero ? 'is-shown' : ''}`} href="#top">Joseph Gao</a>
        <div className="nav__links">
          <a href="#timeline">Timeline</a>
          <a href="#lab">Workbench</a>
          <a href="#github">GitHub</a>
          <a href="#tools">Skills</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav__tools">
          <ThemeSwitch themes={themes} theme={theme} back={back} onChange={changeTheme} onRepeat={repeatTheme} />
          <button type="button" className="nav__search" onClick={() => setPaletteOpen(true)}>
            Menu <kbd>⌘K</kbd>
          </button>
        </div>
      </nav>
      <main id="main">
        <Hero />
        <Timeline chapters={chapters} />
        <Scoreboard />
        <Lab projects={projects} />
        <GitHubActivity />
        <Toolbox toolbox={toolbox} />
      </main>
      <Connect chapters={chapters} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </>
  )
}
