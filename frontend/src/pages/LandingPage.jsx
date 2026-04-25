// src/pages/LandingPage.jsx
import { useAuth }     from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import './LandingPage.css'

function useSectionReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(el => { if (el.isIntersecting) el.target.classList.add('revealed') }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])
}

function useParallax() {
  useEffect(() => {
    let frame
    const onScroll = () => {
      frame = requestAnimationFrame(() => {
        const y = window.scrollY
        const bg     = document.querySelector('.hero-parallax-bg')
        const pieces = document.querySelector('.floating-pieces')
        if (bg)     bg.style.transform     = `translateY(${y * 0.35}px)`
        if (pieces) pieces.style.transform = `translateY(${y * 0.18}px)`
        if (window.innerWidth > 900) {
          document.querySelectorAll('.parallax-slow').forEach(el => {
            el.style.transform = `translateY(${y * 0.08}px)`
          })
        } else {
          document.querySelectorAll('.parallax-slow').forEach(el => {
            el.style.transform = 'none'
          })
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [])
}

function useAnimeText(selector, delay = 0) {
  useEffect(() => {
    let scriptEl
    const run = (anime) => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.dataset.animed) return
        el.dataset.animed = '1'
        const original = el.textContent
        el.innerHTML = original
          .split('')
          .map(ch => ch === ' '
            ? '<span class="anime-char" style="display:inline-block;">&nbsp;</span>'
            : `<span class="anime-char" style="display:inline-block;opacity:0;transform:translateY(14px)">${ch}</span>`)
          .join('')
        anime({
          targets: el.querySelectorAll('.anime-char'),
          opacity:   [0, 1],
          translateY:[14, 0],
          duration:  480,
          delay:     anime.stagger(38, { start: delay }),
          easing:    'easeOutExpo',
        })
      })
    }

    if (window.anime) { run(window.anime); return }
    scriptEl = document.createElement('script')
    scriptEl.src = 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js'
    scriptEl.onload = () => run(window.anime)
    document.head.appendChild(scriptEl)
    return () => { scriptEl?.remove() }
  }, [selector, delay])
}

function useAnimeOnReveal(selector) {
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || !window.anime) return
        const el = entry.target
        if (el.dataset.animed) return
        el.dataset.animed = '1'
        const original = el.textContent
        el.innerHTML = original
          .split('')
          .map(ch => ch === ' '
            ? '<span class="anime-char" style="display:inline-block;">&nbsp;</span>'
            : `<span class="anime-char" style="display:inline-block;opacity:0;transform:translateY(10px)">${ch}</span>`)
          .join('')
        window.anime({
          targets: el.querySelectorAll('.anime-char'),
          opacity:   [0, 1],
          translateY:[10, 0],
          duration:  420,
          delay:     window.anime.stagger(30),
          easing:    'easeOutExpo',
        })
      })
    }, { threshold: 0.5 })
    document.querySelectorAll(selector).forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [selector])
}

function ChessScene3D() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let animId, THREE_lib, renderer, scene, camera

    const init = (THREE) => {
      THREE_lib = THREE
      const canvasW = mount.clientWidth  || 440
      const canvasH = mount.clientHeight || 420

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(canvasW, canvasH)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      mount.appendChild(renderer.domElement)

      scene = new THREE.Scene()

      camera = new THREE.PerspectiveCamera(55, canvasW / canvasH, 0.1, 100)
      camera.position.set(0, 4, 10)
      camera.lookAt(0, 0, 0)

      const ambient = new THREE.AmbientLight(0xf5f0e8, 0.6)
      scene.add(ambient)

      const dirLight = new THREE.DirectionalLight(0xfff4e0, 1.8)
      dirLight.position.set(5, 10, 6)
      dirLight.castShadow = true
      dirLight.shadow.mapSize.width  = 1024
      dirLight.shadow.mapSize.height = 1024
      scene.add(dirLight)

      const fillLight = new THREE.PointLight(0xc0392b, 0.5, 20)
      fillLight.position.set(-5, 3, -3)
      scene.add(fillLight)

      const rimLight = new THREE.PointLight(0x1a5276, 0.4, 20)
      rimLight.position.set(5, 2, -6)
      scene.add(rimLight)

      const boardGroup = new THREE.Group()
      scene.add(boardGroup)
      
      sceneRef.current = { boardGroup, fillLight, rimLight }

      const baseGeo  = new THREE.BoxGeometry(8.4, 0.25, 8.4)
      const baseMat  = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8, metalness: 0.1 })
      const baseMesh = new THREE.Mesh(baseGeo, baseMat)
      baseMesh.position.y = -0.125
      baseMesh.receiveShadow = true
      boardGroup.add(baseMesh)

      const borderGeo = new THREE.BoxGeometry(8.6, 0.28, 8.6)
      const borderMat = new THREE.MeshStandardMaterial({ color: 0x3a2208, roughness: 0.9 })
      const borderMesh = new THREE.Mesh(borderGeo, borderMat)
      borderMesh.position.y = -0.15
      boardGroup.add(borderMesh)

      const lightMat = new THREE.MeshStandardMaterial({ color: 0xf0d9b5, roughness: 0.6, metalness: 0.05 })
      const darkMat  = new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.7, metalness: 0.05 })
      const sqGeo    = new THREE.BoxGeometry(1, 0.05, 1)

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const isLight = (row + col) % 2 === 0
          const mesh = new THREE.Mesh(sqGeo, isLight ? lightMat : darkMat)
          mesh.position.set(col - 3.5, 0.026, row - 3.5)
          mesh.receiveShadow = true
          boardGroup.add(mesh)
        }
      }

      const wMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.3, metalness: 0.15 })
      const bMat = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.4, metalness: 0.25 })

      function addCylinder(group, mat, rx, ry, height, y, segs = 16) {
        const geo  = new THREE.CylinderGeometry(rx, ry, height, segs)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = y
        mesh.castShadow = true
        group.add(mesh)
      }
      function addSphere(group, mat, r, y, segs = 12) {
        const geo  = new THREE.SphereGeometry(r, segs, segs)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = y
        mesh.castShadow = true
        group.add(mesh)
      }
      function addBox(group, mat, w, h, d, y) {
        const geo  = new THREE.BoxGeometry(w, h, d)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = y
        mesh.castShadow = true
        group.add(mesh)
      }
      function addTorus(group, mat, r, tube, y) {
        const geo  = new THREE.TorusGeometry(r, tube, 8, 24)
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.y = y
        mesh.rotation.x = Math.PI / 2
        mesh.castShadow = true
        group.add(mesh)
      }

      function makePawn(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.36, 0.42, 0.1,  0.05, 12)
        addCylinder(g, mat, 0.22, 0.30, 0.55, 0.37, 12)
        addSphere(g, mat, 0.28, 0.82, 12)
        return g
      }
      function makeRook(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.38, 0.44, 0.1,  0.05, 12)
        addCylinder(g, mat, 0.28, 0.34, 0.7,  0.45)
        addCylinder(g, mat, 0.34, 0.34, 0.1,  0.85)
        addBox(g, mat, 0.14, 0.22, 0.56, 1.0)
        addBox(g, mat, 0.56, 0.22, 0.14, 1.0)
        return g
      }
      function makeKnight(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.38, 0.44, 0.1,  0.05, 12)
        addCylinder(g, mat, 0.24, 0.32, 0.65, 0.42)
        const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.52), mat)
        headBox.position.set(0.08, 1.0, 0)
        headBox.rotation.z = -0.18
        headBox.castShadow = true
        g.add(headBox)
        addSphere(g, mat, 0.22, 1.28, 8)
        return g
      }
      function makeBishop(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.38, 0.44, 0.1,  0.05, 12)
        addCylinder(g, mat, 0.2,  0.28, 0.7,  0.45)
        addSphere(g, mat, 0.26, 0.92, 12)
        addCylinder(g, mat, 0.06, 0.06, 0.22, 1.24)
        addSphere(g, mat, 0.1,  1.38, 8)
        return g
      }
      function makeQueen(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.42, 0.48, 0.1,  0.05, 12)
        addCylinder(g, mat, 0.22, 0.36, 0.8,  0.5)
        addTorus(g, mat, 0.28, 0.07, 1.0)
        addSphere(g, mat, 0.28, 1.18, 12)
        addSphere(g, mat, 0.1,  1.54, 8)
        return g
      }
      function makeKing(mat) {
        const g = new THREE.Group()
        addCylinder(g, mat, 0.44, 0.5,  0.1,  0.05, 12)
        addCylinder(g, mat, 0.24, 0.38, 0.85, 0.52)
        addTorus(g, mat, 0.3,  0.07, 1.05)
        addSphere(g, mat, 0.3, 1.25, 12)
        addBox(g, mat, 0.12, 0.4,  0.12, 1.68)
        addBox(g, mat, 0.28, 0.12, 0.12, 1.78)
        return g
      }

      const SCALE = 0.82

      function placePiece(maker, mat, col, row) {
        const p = maker(mat)
        p.scale.setScalar(SCALE)
        p.position.set(col - 3.5, 0.05, row - 3.5)
        boardGroup.add(p)
      }

      const W = wMat, B = bMat
      placePiece(makeRook,   W, 0, 0); placePiece(makeRook,   W, 7, 0)
      placePiece(makeKnight, W, 1, 0); placePiece(makeKnight, W, 6, 0)
      placePiece(makeBishop, W, 2, 0); placePiece(makeBishop, W, 5, 0)
      placePiece(makeQueen,  W, 3, 0)
      placePiece(makeKing,   W, 4, 0)
      for (let c = 0; c < 8; c++) placePiece(makePawn, W, c, 1)

      placePiece(makeRook,   B, 0, 7); placePiece(makeRook,   B, 7, 7)
      placePiece(makeKnight, B, 1, 7); placePiece(makeKnight, B, 6, 7)
      placePiece(makeBishop, B, 2, 7); placePiece(makeBishop, B, 5, 7)
      placePiece(makeQueen,  B, 3, 7)
      placePiece(makeKing,   B, 4, 7)
      for (let c = 0; c < 8; c++) placePiece(makePawn, B, c, 6)

      let isDragging = false
      let prevMouse  = { x: 0, y: 0 }
      let rotY = -0.3, rotX = 0.28
      let targetRotY = rotY, targetRotX = rotX

      const onDown = (e) => {
        isDragging = true
        const p = e.touches ? e.touches[0] : e
        prevMouse = { x: p.clientX, y: p.clientY }
      }
      const onUp = () => { isDragging = false }
      const onMove = (e) => {
        if (!isDragging) return
        const p = e.touches ? e.touches[0] : e
        const dx = (p.clientX - prevMouse.x) * 0.01
        const dy = (p.clientY - prevMouse.y) * 0.008
        targetRotY += dx
        targetRotX  = Math.max(-0.1, Math.min(0.7, targetRotX + dy))
        prevMouse = { x: p.clientX, y: p.clientY }
      }

      renderer.domElement.addEventListener('mousedown',  onDown)
      renderer.domElement.addEventListener('touchstart', onDown, { passive: true })
      window.addEventListener('mouseup',   onUp)
      window.addEventListener('touchend',  onUp)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('touchmove', onMove, { passive: true })

      let autoRot = true
      renderer.domElement.addEventListener('mousedown', () => { autoRot = false })
      renderer.domElement.addEventListener('mouseup',   () => { setTimeout(() => { autoRot = true }, 2000) })

      const clock = new THREE.Clock()
      const animate = () => {
        animId = requestAnimationFrame(animate)
        const t = clock.getElapsedTime()

        if (autoRot) targetRotY += 0.003

        rotY += (targetRotY - rotY) * 0.06
        rotX += (targetRotX - rotX) * 0.06

        boardGroup.rotation.y = rotY
        boardGroup.rotation.x = rotX

        if (sceneRef.current) {
          sceneRef.current.fillLight.intensity = 0.4 + Math.sin(t * 0.8) * 0.15
          sceneRef.current.rimLight.intensity  = 0.3 + Math.cos(t * 0.6) * 0.12
        }

        renderer.render(scene, camera)
      }
      animate()

      const onResize = () => {
        const w = mount.clientWidth, h = mount.clientHeight
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      window.addEventListener('resize', onResize)
      sceneRef.current._cleanup = () => {
        cancelAnimationFrame(animId)
        renderer.domElement.removeEventListener('mousedown',  onDown)
        renderer.domElement.removeEventListener('touchstart', onDown)
        window.removeEventListener('mouseup',   onUp)
        window.removeEventListener('touchend',  onUp)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('touchmove', onMove)
        window.removeEventListener('resize',    onResize)
        renderer.dispose()
      }
    }

    if (window.THREE) { init(window.THREE); return }
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload = () => init(window.THREE)
    document.head.appendChild(script)

    return () => {
      mountedRef.current = false
      sceneRef.current?._cleanup?.()
      const canvas = mount.querySelector('canvas')
      if (canvas) canvas.remove()
      sceneRef.current = null
      mountedRef.current = true
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="three-scene"
      title="Drag to rotate the board"
    />
  )
}

const SYMBOLS = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
}
const FILES = ['a','b','c','d','e','f','g','h']
const RANKS = [8,7,6,5,4,3,2,1]
const SQ    = 48

function MiniBoard({ position, highlightSquares = [] }) {
  return (
    <svg viewBox={`0 0 ${SQ*8} ${SQ*8}`} width="100%" style={{ display:'block' }} aria-label="Chess board">
      {RANKS.map((rank, ri) =>
        FILES.map((file, fi) => {
          const sq    = file + rank
          const light = (ri + fi) % 2 === 0
          const piece = position[sq]
          const isHl  = highlightSquares.includes(sq)
          const x = fi * SQ, y = ri * SQ
          return (
            <g key={sq}>
              <rect x={x} y={y} width={SQ} height={SQ} fill={light ? '#f0d9b5' : '#b58863'} />
              {isHl && <rect x={x} y={y} width={SQ} height={SQ} fill="rgba(92,138,60,0.5)" className="sq-pulse" />}
              {piece && (
                <text x={x+SQ/2} y={y+SQ/2+1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={SQ*0.7} style={{ userSelect:'none', fontFamily:'serif' }}
                  fill={piece.startsWith('w') ? '#1a1612' : '#3a1a00'}
                  stroke={piece.startsWith('b') ? 'rgba(26,22,18,0.15)' : 'none'} strokeWidth="0.5">
                  {SYMBOLS[piece]}
                </text>
              )}
            </g>
          )
        })
      )}
    </svg>
  )
}

const POS_SICILIAN = {
  a1:'wR', c1:'wB', d1:'wQ', f1:'wR',
  a2:'wP', b2:'wP', c2:'wP', g2:'wP', h2:'wP',
  f3:'wN', d4:'wP', e4:'wP', g3:'wB',
  a6:'bP', c5:'bP',
  a7:'bP', b7:'bP', c7:'bP', d7:'bP', f7:'bP', g7:'bP', h7:'bP',
  a8:'bR', b8:'bN', c8:'bB', d8:'bQ', e8:'bK', g8:'bN', h8:'bR', f6:'bN',
}
const POS_RUY = {
  a1:'wR', c1:'wB', e1:'wK', f1:'wR',
  a2:'wP', b2:'wP', c2:'wP', g2:'wP', h2:'wP',
  d3:'wP', f3:'wN', b5:'wB', e4:'wP',
  e5:'bP', a6:'bP',
  a7:'bP', b7:'bP', c7:'bP', d7:'bP', f7:'bP', g7:'bP', h7:'bP',
  a8:'bR', b8:'bN', c8:'bB', d8:'bQ', e8:'bK', g8:'bN', h8:'bR', c6:'bN',
}
const POS_QGD = {
  a1:'wR', c1:'wB', e1:'wK', f1:'wR',
  a2:'wP', b2:'wP', d2:'wP', e2:'wP', f2:'wP', g2:'wP', h2:'wP',
  c4:'wP', d4:'wP', c3:'wN', f3:'wN',
  e6:'bP', d5:'bP',
  a7:'bP', b7:'bP', c7:'bP', e7:'bB', f7:'bP', g7:'bP', h7:'bP',
  a8:'bR', b8:'bN', c8:'bB', d8:'bQ', e8:'bK', h8:'bR', f6:'bN', g6:'bB',
}

const PIECE_CHARS = ['♚','♛','♜','♝','♞','♟','♔','♕','♖','♗','♘','♙']

function FloatingPieces() {
  return (
    <div className="floating-pieces" aria-hidden="true">
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} className="fp" style={{
          left:              `${(i * 37 + 11) % 100}%`,
          top:               `${(i * 53 + 7)  % 100}%`,
          animationDelay:    `${(i * 0.37).toFixed(2)}s`,
          animationDuration: `${8 + (i % 5) * 1.5}s`,
          fontSize:          `${28 + (i % 4) * 16}px`,
          opacity:           0.04 + (i % 3) * 0.018,
        }}>
          {PIECE_CHARS[i % PIECE_CHARS.length]}
        </div>
      ))}
    </div>
  )
}

const STATS = [
  { value: '3,500+',   label: 'Openings recognized' },
  { value: '<1s',      label: 'Analysis time'        },
  { value: 'Depth 18', label: 'Stockfish depth'      },
  { value: '100%',     label: 'Browser-native'       },
]

function IconCamera() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
}
function IconScan() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 7 4"/><polyline points="17 4 20 4 20 7"/><polyline points="20 17 20 20 17 20"/><polyline points="7 20 4 20 4 17"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
}
function IconCpu() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
}
function IconBook() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
}
function IconGithub() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="GitHub">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  )
}

const STEPS = [
  { num:'01', Icon:IconCamera, title:'Snap or upload',       desc:'Photograph a physical board, screenshot a digital game, or paste a FEN or PGN directly.' },
  { num:'02', Icon:IconScan,   title:'Auto-detect position', desc:'The vision pipeline crops, enhances, and reads every square. Uncertain pieces are flagged for review.' },
  { num:'03', Icon:IconCpu,    title:'Stockfish analyses',   desc:'The engine runs at depth 18 in your browser — no server, no waiting. Results in under a second.' },
  { num:'04', Icon:IconBook,   title:'Save and study',       desc:'Games are stored in your library. Pattern analysis surfaces recurring mistakes across all your sessions.' },
]

const FEATURES = [
  { tag:'Vision',  headline:'Board-to-FEN in one tap',            accentVar:'--red',   position:POS_SICILIAN, hl:['c5','d4'],  body:'Point your camera at any physical board — club games, books, magazines. The preprocessing pipeline auto-crops, sharpens, and fixes lighting before recognition.' },
  { tag:'Engine',  headline:'Grandmaster analysis, zero latency', accentVar:'--green', position:POS_RUY,      hl:['b5','c6'],  body:'Stockfish 10 compiles to WebAssembly and runs in a dedicated background thread. Top-3 lines, evaluation bar, move quality grades — all instantly, offline-capable.' },
  { tag:'Library', headline:'Every game, forever searchable',     accentVar:'--blue',  position:POS_QGD,      hl:['d4','d5'],  body:'Save positions and full PGN games. Replay move-by-move with live engine commentary. Pattern analysis aggregates hundreds of games to find your blind spots.' },
]

const GITHUB_URL = 'https://github.com/epsilon003/chess-lens'

export default function LandingPage() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useSectionReveal()
  useParallax()

  useAnimeText('.hero-h1 em', 300)
  useAnimeOnReveal('.feature-tag')

  const handleCTA = () => {
    if (user) navigate('/analyze')
    else signInWithGoogle()
  }

  return (
    <div className="landing-v2">

      {/* ── HERO ──────────────────────────────────────────── */}
      <section className="hero-v2">
        <div className="hero-parallax-bg" aria-hidden="true">
          <div className="hero-grid-bg" />
        </div>
        <FloatingPieces />

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="eyebrow-pip" />
              AI Chess Analysis
            </div>

            <h1 className="hero-h1">
              See the game<br />
              <em>beyond</em> the board
            </h1>

            <p className="hero-lead">
              Upload any board photo. Get instant Stockfish analysis.
              Save your games. Uncover your patterns.
            </p>

            <div className="hero-cta-row">
              <button onClick={handleCTA} className="cta-primary">
                {user ? 'Open analyzer \u2192' : 'Start for free \u2192'}
              </button>

              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="github-btn"
                title="View source on GitHub"
              >
                <IconGithub />
                <span>Source</span>
              </a>

              {!user && <span className="cta-note">No credit card · Works on any device</span>}
            </div>

            <div className="hero-stats">
              {STATS.map(s => (
                <div key={s.label} className="stat-item">
                  <span className="stat-val">{s.value}</span>
                  <span className="stat-lbl">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-3d-wrap">
            <div className="hero-3d-card">
              <ChessScene3D />
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="section-how">
        <div className="section-inner">
          <div className="section-label reveal">Process</div>
          <h2 className="section-h2 reveal">Four steps to mastery</h2>
          <div className="steps-grid">
            {STEPS.map((step, i) => (
              <div key={step.num} className="step-card reveal" style={{ transitionDelay:`${i * 0.08}s` }}>
                <div className="step-num">{step.num}</div>
                <div className="step-icon-wrap"><step.Icon /></div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
                <div className="step-line" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section className="section-features">
        <div className="section-inner">
          <div className="section-label reveal">Features</div>
          <h2 className="section-h2 reveal">Everything a serious player needs</h2>
          {FEATURES.map((f, i) => (
            <div key={f.tag} className={`feature-row reveal ${i % 2 === 1 ? 'feature-row-flip' : ''}`}>
              <div className="feature-text">
                <span className="feature-tag" style={{ color:`var(${f.accentVar})`, borderColor:`var(${f.accentVar})` }}>
                  {f.tag}
                </span>
                <h3 className="feature-headline">{f.headline}</h3>
                <p className="feature-body">{f.body}</p>
              </div>
              <div className="feature-visual parallax-slow">
                <div className="feature-board-wrap" style={{ borderColor:`var(${f.accentVar})` }}>
                  <MiniBoard position={f.position} highlightSquares={f.hl} />
                  <div className="feature-board-accent" style={{ background:`var(${f.accentVar})` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="section-cta">
        <div className="cta-inner">
          <div className="cta-board-bg" aria-hidden="true">
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} className="cta-sq" style={{
                background: (Math.floor(i / 8) + i) % 2 === 0
                  ? 'rgba(240,217,181,0.07)'
                  : 'rgba(181,136,99,0.1)',
              }} />
            ))}
          </div>
          <div className="cta-content reveal">
            <h2 className="cta-h2">Ready to see deeper?</h2>
            <p className="cta-sub">Join thousands of players who analyze smarter with ChessLens.</p>
            <div className="cta-btn-row">
              <button onClick={handleCTA} className="cta-primary cta-large">
                {user ? 'Go to Analyzer \u2192' : 'Get started free \u2192'}
              </button>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="github-btn github-btn-light">
                <IconGithub />
                <span>Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}