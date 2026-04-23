import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ref, update } from 'firebase/database'
import { useAuth } from '../../../hooks/useAuth'
import { useVoiceChat } from '../../../hooks/useVoiceChat'
import { rtdb } from '../../../firebase/config'
import {
  subscribeToRoom, subscribeToGameState, updateGameState,
  pushPlayerAction, subscribeToActions, endGame,
} from '../../../firebase/services'
import {
  initUnoGame, processPlayCard, processDrawCard, processSayUno,
  processUnoChallenge, getPlayableCards, getCardColorClass, validateMove,
} from '../../../utils/unoEngine'
import UnoCard from './UnoCard'
import ColorPicker from './ColorPicker'
import VoicePanel from '../../ui/VoicePanel'
import { Home, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function UnoGame({ roomId }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [roomData, setRoomData] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pendingWildCard, setPendingWildCard] = useState(null)
  const [showUnoButton, setShowUnoButton] = useState(false)
  const [unoPressed, setUnoPressed] = useState(false)
  const [lastActionDisplay, setLastActionDisplay] = useState(null)
  const [isAnimatingDraw, setIsAnimatingDraw] = useState(false)

  const processedActionsRef = useRef(new Set())
  const isHostRef = useRef(false)
  const initializingRef = useRef(false)
  const drawCardRef = useRef(null)

  const players = roomData?.players ? Object.values(roomData.players) : []
  const { isMuted, isConnected, voiceEnabled, enableVoice, toggleMute } = useVoiceChat(roomId, players)

  useEffect(() => {
    const unsubRoom = subscribeToRoom(roomId, (data) => {
      if (!data) return
      setRoomData(data)
      const myPlayer = data.players?.[user.uid]
      isHostRef.current = myPlayer?.isHost || false

      if (isHostRef.current && !data.gameInitialized && !initializingRef.current) {
        initializingRef.current = true
        initGame(data)
      }
    })

    const unsubGame = subscribeToGameState(roomId, (state) => {
      if (state) setGameState(state)
    })

    return () => { unsubRoom(); unsubGame() }
  }, [roomId, user.uid])

  useEffect(() => {
    const unsubActions = subscribeToActions(roomId, (actions) => {
      for (const action of actions) {
        if (processedActionsRef.current.has(action.key)) continue
        processedActionsRef.current.add(action.key)
        handleRemoteAction(action)
      }
    })
    return unsubActions
  }, [roomId, gameState])

  const initGame = async (data) => {
    try {
      const playersList = Object.values(data.players || {})
      if (playersList.length < 2) return
      const state = initUnoGame(playersList)
      await updateGameState(roomId, state)
      await update(ref(rtdb, `rooms/${roomId}`), { gameInitialized: true })
    } catch {
      initializingRef.current = false
    }
  }

  const handleRemoteAction = useCallback((action) => {
    if (action.playerId === user.uid) return

    setGameState((prev) => {
      if (!prev) return prev
      if (action.type === 'play') return processPlayCard(prev, action.playerId, action.cardId, action.chosenColor)
      if (action.type === 'draw') return processDrawCard(prev, action.playerId)
      if (action.type === 'uno') return processSayUno(prev, action.playerId)
      if (action.type === 'uno-challenge') return processUnoChallenge(prev, action.challengerId, action.targetId)
      return prev
    })
  }, [user.uid])

  const myPlayerState = gameState?.players?.find((p) => p.uid === user.uid)
  const isMyTurn = gameState?.players?.[gameState?.currentPlayerIndex]?.uid === user.uid
  const currentPlayer = gameState?.players?.[gameState?.currentPlayerIndex]
  const playableCards = gameState && myPlayerState
    ? getPlayableCards(myPlayerState.hand || [], gameState.topCard, gameState.currentColor, gameState.pendingDrawCount)
    : []

  const handleDrawCard = useCallback(async () => {
    if (!isMyTurn || !gameState) return
    setIsAnimatingDraw(true)
    const newState = processDrawCard(gameState, user.uid)
    setGameState(newState)
    await updateGameState(roomId, newState)
    await pushPlayerAction(roomId, { type: 'draw', playerId: user.uid })
    setTimeout(() => setIsAnimatingDraw(false), 600)
  }, [isMyTurn, gameState, user.uid, roomId])

  useEffect(() => {
    drawCardRef.current = handleDrawCard
  }, [handleDrawCard])

  useEffect(() => {
    if (!myPlayerState) return
    if (myPlayerState.hand?.length === 1 && isMyTurn) {
      setShowUnoButton(true)
      setUnoPressed(false)
      const timer = setTimeout(() => {
        if (!unoPressed) {
          drawCardRef.current?.()
          toast.error('UNO penalty! You forgot to say UNO!')
        }
        setShowUnoButton(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [myPlayerState?.hand?.length, isMyTurn])

  useEffect(() => {
    if (!gameState?.lastAction || gameState.lastAction.playerId === user.uid) return
    const action = gameState.lastAction
    const playerName = gameState.players?.find((p) => p.uid === action.playerId)?.name || 'Player'
    if (action.type === 'play') setLastActionDisplay({ text: `${playerName} played a card`, timeout: 2000 })
    else if (action.type === 'draw') setLastActionDisplay({ text: `${playerName} drew ${action.count || 1} card${action.count > 1 ? 's' : ''}`, timeout: 2000 })
    else if (action.type === 'uno') setLastActionDisplay({ text: `${playerName} said UNO! 🃏`, timeout: 3000 })
  }, [gameState?.lastAction])

  useEffect(() => {
    if (!lastActionDisplay) return
    const t = setTimeout(() => setLastActionDisplay(null), lastActionDisplay.timeout)
    return () => clearTimeout(t)
  }, [lastActionDisplay])

  const handlePlayCard = useCallback(async (card) => {
    if (!isMyTurn || !gameState) return
    const validation = validateMove(gameState, user.uid, card, null)
    if (!validation.valid) { toast.error(validation.reason); return }
    if (card.type === 'wild') { setPendingWildCard(card); setShowColorPicker(true); return }
    await executePlayCard(card, null)
  }, [isMyTurn, gameState, user.uid])

  const handleColorChosen = async (color) => {
    setShowColorPicker(false)
    if (pendingWildCard) {
      await executePlayCard(pendingWildCard, color)
      setPendingWildCard(null)
    }
  }

  const executePlayCard = async (card, chosenColor) => {
    const newState = processPlayCard(gameState, user.uid, card.id, chosenColor)
    setGameState(newState)
    await updateGameState(roomId, newState)
    await pushPlayerAction(roomId, { type: 'play', playerId: user.uid, cardId: card.id, chosenColor })
    if (newState.phase === 'finished') {
      toast.success('🎉 You won!')
      await endGame(roomId)
    }
  }

  const handleSayUno = useCallback(async () => {
    if (!gameState) return
    setUnoPressed(true)
    setShowUnoButton(false)
    const newState = processSayUno(gameState, user.uid)
    setGameState(newState)
    await updateGameState(roomId, newState)
    await pushPlayerAction(roomId, { type: 'uno', playerId: user.uid })
    toast.success('UNO! 🃏')
  }, [gameState, user.uid, roomId])

  const handleUnoChallenge = useCallback(async (targetId) => {
    if (!gameState) return
    const newState = processUnoChallenge(gameState, user.uid, targetId)
    setGameState(newState)
    await updateGameState(roomId, newState)
    await pushPlayerAction(roomId, { type: 'uno-challenge', challengerId: user.uid, targetId })
    if (newState.lastAction?.success) toast.success('Challenge successful! They draw 2!')
    else toast('Challenge failed — they said UNO')
  }, [gameState, user.uid, roomId])

  if (!gameState) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-neon-cyan text-xs tracking-widest">INITIALIZING GAME</p>
        </div>
      </div>
    )
  }

  if (gameState.phase === 'finished') {
    const winner = gameState.players?.find((p) => p.uid === gameState.winner)
    return (
      <GameOverScreen
        winner={winner}
        isWinner={gameState.winner === user.uid}
        players={gameState.players}
        onLeave={() => navigate('/lobby')}
      />
    )
  }

  const otherPlayers = gameState.players?.filter((p) => p.uid !== user.uid) || []

  const colorStyle = (() => {
    const c = gameState.currentColor
    if (c === 'red') return { color: '#ef4444', border: '1px solid #ef4444' }
    if (c === 'blue') return { color: '#3b82f6', border: '1px solid #3b82f6' }
    if (c === 'green') return { color: '#22c55e', border: '1px solid #22c55e' }
    if (c === 'yellow') return { color: '#fbbf24', border: '1px solid #fbbf24' }
    return { color: '#9ca3af', border: '1px solid #4b5563' }
  })()

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-4 gap-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/lobby')}
            className="text-gray-600 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          >
            <Home size={16} />
          </button>

          <div className="flex items-center gap-3">
            <div
              className="px-3 py-1.5 rounded-lg font-mono text-xs font-bold"
              style={{ ...colorStyle }}
            >
              {gameState.currentColor?.toUpperCase() || 'WILD'}
            </div>

            {gameState.pendingDrawCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-3 py-1.5 rounded-lg border border-neon-pink text-neon-pink font-display text-xs font-bold animate-pulse"
              >
                +{gameState.pendingDrawCount} STACKED
              </motion.div>
            )}

            <span className="font-mono text-xs text-gray-600">
              {gameState.direction === 1 ? '→' : '←'} Direction
            </span>
          </div>

          <VoicePanel
            isMuted={isMuted}
            isConnected={isConnected}
            voiceEnabled={voiceEnabled}
            onEnable={enableVoice}
            onToggleMute={toggleMute}
          />
        </div>

        <div className="flex justify-center gap-6 flex-wrap">
          {otherPlayers.map((player) => (
            <OpponentZone
              key={player.uid}
              player={player}
              isCurrentTurn={currentPlayer?.uid === player.uid}
              onChallenge={
                player.hand?.length === 1 && !player.saidUno
                  ? () => handleUnoChallenge(player.uid)
                  : null
              }
            />
          ))}
        </div>

        <div className="flex-1 flex items-center justify-center gap-12">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {[2, 1, 0].map((i) => (
                <div
                  key={i}
                  className="absolute card-back rounded-xl"
                  style={{ width: 72, height: 108, top: i * -2, left: i * 2, zIndex: 3 - i }}
                />
              ))}
              <motion.button
                onClick={handleDrawCard}
                disabled={!isMyTurn}
                whileHover={isMyTurn ? { scale: 1.05, y: -4 } : {}}
                whileTap={isMyTurn ? { scale: 0.95 } : {}}
                className={`relative z-10 card-back rounded-xl flex items-center justify-center transition-all ${
                  isMyTurn && gameState.pendingDrawCount > 0
                    ? 'animate-pulse-glow ring-2 ring-neon-pink'
                    : isMyTurn
                    ? 'hover:ring-2 hover:ring-neon-cyan'
                    : 'cursor-default'
                } ${isAnimatingDraw ? 'animate-draw-penalty' : ''}`}
                style={{ width: 72, height: 108 }}
              >
                <span className="font-display text-neon-cyan/50 text-xs font-black">
                  {gameState.pendingDrawCount > 0 ? `+${gameState.pendingDrawCount}` : 'DRAW'}
                </span>
              </motion.button>
            </div>
            <p className="font-mono text-gray-700 text-[10px]">Draw Pile</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {gameState.topCard && (
              <div
                className={`rounded-xl bg-gradient-to-br ${getCardColorClass(
                  gameState.currentColor || gameState.topCard.color
                )} border-2 flex flex-col items-center justify-between p-1.5`}
                style={{ width: 72, height: 108 }}
              >
                <span className="self-start font-display font-black text-sm text-white leading-none">
                  {symb(gameState.topCard.value)}
                </span>
                <span className="font-display font-black text-2xl text-white">
                  {gameState.topCard.color === 'wild' ? '🌈' : symb(gameState.topCard.value)}
                </span>
                <span className="self-end rotate-180 font-display font-black text-sm text-white leading-none">
                  {symb(gameState.topCard.value)}
                </span>
              </div>
            )}
            <p className="font-mono text-gray-700 text-[10px]">Discard</p>
          </div>
        </div>

        <AnimatePresence>
          {lastActionDisplay && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <span className="font-mono text-xs text-neon-cyan/70 bg-neon-cyan/5 border border-neon-cyan/15 px-4 py-1.5 rounded-full">
                {lastActionDisplay.text}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isMyTurn ? 'bg-neon-green animate-pulse' : 'bg-gray-700'
                }`}
              />
              <span className="font-mono text-xs text-gray-500">
                {isMyTurn ? 'YOUR TURN' : `${currentPlayer?.name?.toUpperCase()}'S TURN`}
              </span>
            </div>
            <span className="font-mono text-xs text-gray-600">
              {myPlayerState?.hand?.length || 0} cards
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 min-h-24 items-end pb-2">
            <AnimatePresence>
              {myPlayerState?.hand?.map((card, i) => {
                const isCardPlayable = playableCards.some((c) => c.id === card.id)
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <UnoCard
                      card={card}
                      onClick={() => handlePlayCard(card)}
                      playable={isMyTurn ? isCardPlayable : false}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showUnoButton && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -180 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50"
          >
            <motion.button
              onClick={handleSayUno}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="bg-gradient-to-r from-red-600 to-orange-500 text-white font-display font-black text-2xl px-10 py-5 rounded-2xl shadow-2xl border-4 border-yellow-400 tracking-wider"
              style={{ boxShadow: '0 0 40px rgba(255,165,0,0.8)' }}
            >
              UNO!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {showColorPicker && <ColorPicker onSelect={handleColorChosen} />}
    </div>
  )
}

function symb(value) {
  const map = { skip: '⊘', reverse: '⇄', draw2: '+2', wild: '★', wild4: '+4' }
  return map[value] || value
}

function OpponentZone({ player, isCurrentTurn, onChallenge }) {
  return (
    <motion.div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        isCurrentTurn ? 'border-neon-gold/50 bg-neon-gold/5' : 'border-white/5'
      }`}
    >
      <div className="relative">
        <img
          src={player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`}
          className="w-10 h-10 rounded-full border border-white/10"
          alt={player.name}
        />
        {isCurrentTurn && (
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute -top-1 -right-1 w-3 h-3 bg-neon-gold rounded-full"
          />
        )}
      </div>

      <p className="font-body text-white text-xs font-semibold truncate max-w-[70px]">
        {player.name.split(' ')[0]}
      </p>

      <div className="flex gap-0.5 flex-wrap justify-center max-w-24">
        {Array.from({ length: Math.min(player.cardCount || 0, 8) }).map((_, i) => (
          <div key={i} className="w-5 h-7 card-back rounded border border-gray-700" />
        ))}
        {(player.cardCount || 0) > 8 && (
          <div className="w-5 h-7 flex items-center justify-center">
            <span className="font-mono text-gray-600 text-[10px]">+{(player.cardCount || 0) - 8}</span>
          </div>
        )}
      </div>

      <span className="font-mono text-[10px] text-gray-600">{player.cardCount || 0} cards</span>

      {onChallenge && (
        <motion.button
          onClick={onChallenge}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="font-display text-[10px] text-neon-pink border border-neon-pink/40 px-2 py-1 rounded-full hover:bg-neon-pink/10 transition-all"
        >
          Challenge UNO!
        </motion.button>
      )}
    </motion.div>
  )
}

function GameOverScreen({ winner, isWinner, players, onLeave }) {
  const sorted = [...(players || [])].sort((a, b) => (a.hand?.length || 0) - (b.hand?.length || 0))

  return (
    <div className="min-h-screen bg-void grid-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass neon-border rounded-3xl p-10 text-center space-y-7 max-w-sm w-full"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-6xl"
        >
          {isWinner ? '🏆' : '😔'}
        </motion.div>

        <div>
          <p className="font-display text-3xl font-black text-white">
            {isWinner ? 'VICTORY!' : 'GAME OVER'}
          </p>
          <p className="text-gray-400 font-body mt-2 text-sm">
            {isWinner ? 'You played all your cards!' : `${winner?.name} wins this round`}
          </p>
        </div>

        <div className="space-y-2 text-left">
          {sorted.map((p, i) => (
            <div
              key={p.uid}
              className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-xl border border-white/5"
            >
              <span className="font-mono text-xs text-gray-600 w-4">{i + 1}</span>
              <img
                src={p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`}
                className="w-6 h-6 rounded-full border border-white/10"
                alt={p.name}
              />
              <span className="font-body text-sm text-white flex-1 truncate">{p.name}</span>
              <span className="font-mono text-xs text-gray-500">
                {p.hand?.length ?? 0} left
              </span>
            </div>
          ))}
        </div>

        <button onClick={onLeave} className="btn-primary w-full">
          Back to Lobby
        </button>
      </motion.div>
    </div>
  )
}
