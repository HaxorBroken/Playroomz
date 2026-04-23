import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRoom } from '../../hooks/useRoom'
import { useAuth } from '../../hooks/useAuth'
import { useVoiceChat } from '../../hooks/useVoiceChat'
import {
  ArrowLeft, Copy, Check, Crown, Mic, MicOff,
  Play, PhoneCall, Users, LogOut, Wifi, WifiOff,
  Shield, Loader2, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function RoomPage() {
  const { roomId } = useParams()
  const { user } = useAuth()
  const { roomData, leaveRoom, toggleReady, startGame, initRoomFromUrl } = useRoom()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [togglingReady, setTogglingReady] = useState(false)

  useEffect(() => {
    initRoomFromUrl(roomId)
  }, [roomId])

  const players = roomData?.players ? Object.values(roomData.players) : []
  const maxPlayers = roomData?.maxPlayers || 2
  const myPlayer = players.find((p) => p.uid === user?.uid)
  const isHost = myPlayer?.isHost || false
  const isCB = roomData?.gameType === 'callbridge'
  const minRequired = isCB ? 4 : 2
  const enoughPlayers = players.length >= minRequired
  const nonHostPlayers = players.filter((p) => !p.isHost)
  const allReady = nonHostPlayers.length > 0 && nonHostPlayers.every((p) => p.isReady)
  const canStart = isHost && allReady && enoughPlayers && !starting

  const { isMuted, voiceEnabled, isConnected, enableVoice, disableVoice, toggleMute } =
    useVoiceChat(roomId, players)

  const statusInfo = (() => {
    if (!enoughPlayers) {
      const need = minRequired - players.length
      return {
        text: `Waiting for ${need} more player${need !== 1 ? 's' : ''}`,
        color: 'text-gray-500',
      }
    }
    if (!allReady) {
      const notReady = nonHostPlayers.filter((p) => !p.isReady).length
      return {
        text: `${notReady} player${notReady !== 1 ? 's' : ''} not ready`,
        color: 'text-neon-gold',
      }
    }
    return { text: 'All ready — host can start!', color: 'text-neon-green' }
  })()

  const handleLeave = async () => {
    if (leaving) return
    setLeaving(true)
    await leaveRoom()
  }

  const handleToggleReady = async () => {
    if (togglingReady) return
    setTogglingReady(true)
    await toggleReady()
    setTogglingReady(false)
  }

  const handleStartGame = async () => {
    if (!canStart || starting) return
    setStarting(true)
    await startGame()
    setStarting(false)
  }

  const copyInviteCode = () => {
    if (!roomData?.inviteCode) return
    navigator.clipboard.writeText(roomData.inviteCode)
    setCopied(true)
    toast.success('Invite code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId)
    setCopiedId(true)
    toast.success('Room ID copied!')
    setTimeout(() => setCopiedId(false), 2000)
  }

  const gameLabel = isCB ? 'Call Bridge' : 'UNO'
  const gameIcon = isCB ? '♠️' : '🃏'
  const accentColor = isCB ? 'purple' : 'cyan'
  const accent = {
    border: accentColor === 'cyan' ? 'border-neon-cyan/20' : 'border-neon-purple/20',
    text: accentColor === 'cyan' ? 'text-neon-cyan' : 'text-neon-purple',
    bg: accentColor === 'cyan' ? 'bg-neon-cyan/8' : 'bg-neon-purple/8',
    dot: accentColor === 'cyan' ? 'bg-neon-cyan' : 'bg-neon-purple',
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-void grid-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-11 h-11 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-gray-500 text-xs tracking-widest">LOADING ROOM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-void grid-bg flex flex-col">
      <header className="border-b border-white/5 glass sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center gap-3">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex items-center gap-1.5 text-gray-500 hover:text-neon-pink transition-colors group"
          >
            <LogOut size={15} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="font-mono text-xs hidden sm:block">LEAVE</span>
          </button>

          <div className="flex items-center gap-2 ml-1">
            <span className="text-lg">{gameIcon}</span>
            <div>
              <p className="font-display text-white font-bold tracking-wider text-sm leading-none">
                {gameLabel.toUpperCase()}
              </p>
              <p className="font-mono text-gray-600 text-[10px] mt-0.5">WAITING ROOM</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {voiceEnabled ? (
              <div className="flex items-center gap-2">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isConnected ? 'bg-neon-green animate-pulse' : 'bg-gray-600'
                  }`}
                />
                <button
                  onClick={toggleMute}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    isMuted
                      ? 'border-neon-pink/35 text-neon-pink bg-neon-pink/8'
                      : 'border-neon-green/35 text-neon-green bg-neon-green/8'
                  }`}
                >
                  {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                  {isMuted ? 'MUTED' : 'LIVE'}
                </button>
                <button
                  onClick={disableVoice}
                  className="text-gray-600 hover:text-gray-400 text-xs font-mono px-2 py-1.5 rounded-lg border border-white/8 hover:border-white/15 transition-all"
                >
                  OFF
                </button>
              </div>
            ) : (
              <button
                onClick={enableVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-500 hover:border-neon-cyan/35 hover:text-neon-cyan text-xs font-mono transition-all"
              >
                <PhoneCall size={12} /> VOICE
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-5 py-8 w-full space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border ${accent.border} bg-white/[0.025] p-5`}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">
                Room ID
              </p>
              <div className="flex items-center gap-2">
                <p className={`font-display text-2xl font-black tracking-widest ${accent.text}`}>
                  {roomId}
                </p>
                <button
                  onClick={copyRoomId}
                  className="text-gray-600 hover:text-white transition-colors p-1"
                >
                  {copiedId ? (
                    <Check size={12} className="text-neon-green" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {roomData?.isPrivate && roomData?.inviteCode && (
              <div className="text-right">
                <div className="flex items-center gap-1.5 justify-end mb-1.5">
                  <Shield size={10} className="text-neon-gold" />
                  <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider">
                    Invite Code
                  </p>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <p className="font-display text-2xl font-black tracking-widest text-neon-gold">
                    {roomData.inviteCode}
                  </p>
                  <button
                    onClick={copyInviteCode}
                    className="text-gray-600 hover:text-neon-gold transition-colors p-1"
                  >
                    {copied ? (
                      <Check size={12} className="text-neon-green" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-gray-600" />
              <span className="font-mono text-xs text-gray-500">
                <span className="text-white font-bold">{players.length}</span>
                <span className="text-gray-700">/{maxPlayers}</span>
              </span>
              <div className="flex gap-1 ml-1">
                {Array.from({ length: maxPlayers }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      i < players.length ? accent.dot : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={11} className={statusInfo.color} />
              <span className={`font-mono text-xs ${statusInfo.color}`}>{statusInfo.text}</span>
            </div>
          </div>
        </motion.div>

        <div className="space-y-2.5">
          <p className="font-mono text-[10px] text-gray-600 uppercase tracking-wider px-1">
            Players
          </p>

          <AnimatePresence mode="popLayout">
            {players.map((player, i) => (
              <PlayerCard
                key={player.uid}
                player={player}
                index={i}
                isMe={player.uid === user?.uid}
                accentColor={accentColor}
              />
            ))}
          </AnimatePresence>

          {players.length < maxPlayers && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl border border-dashed border-white/8 p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full border border-dashed border-white/12 flex items-center justify-center">
                <span className="text-gray-700 text-xs font-mono">
                  {maxPlayers - players.length}
                </span>
              </div>
              <p className="font-mono text-xs text-gray-700 tracking-wider">
                WAITING FOR {maxPlayers - players.length} MORE PLAYER
                {maxPlayers - players.length !== 1 ? 'S' : ''}
              </p>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-3 pt-2"
        >
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex items-center gap-2 px-5 py-3.5 rounded-xl border border-neon-pink/25 text-neon-pink bg-neon-pink/5 hover:bg-neon-pink/12 font-mono text-xs tracking-wider transition-all disabled:opacity-50"
          >
            {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
            LEAVE
          </button>

          {!isHost && myPlayer && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleToggleReady}
              disabled={togglingReady}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border font-mono text-xs tracking-wider font-bold transition-all disabled:opacity-60 ${
                myPlayer.isReady
                  ? 'border-neon-gold/35 text-neon-gold bg-neon-gold/8 hover:bg-neon-gold/15'
                  : 'border-neon-green/35 text-neon-green bg-neon-green/8 hover:bg-neon-green/15'
              }`}
            >
              {togglingReady ? (
                <Loader2 size={13} className="animate-spin" />
              ) : myPlayer.isReady ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-neon-gold" />
                  READY — CLICK TO UNREADY
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                  CLICK TO READY UP
                </>
              )}
            </motion.button>
          )}

          {isHost && (
            <motion.button
              whileTap={canStart ? { scale: 0.97 } : {}}
              onClick={handleStartGame}
              disabled={!canStart}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl border font-mono text-xs tracking-wider font-bold transition-all ${
                canStart
                  ? 'border-neon-green/40 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 cursor-pointer'
                  : 'border-white/8 text-gray-700 cursor-not-allowed bg-white/[0.02]'
              }`}
            >
              {starting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Play size={13} />
              )}
              {starting
                ? 'STARTING...'
                : canStart
                ? 'START GAME'
                : !enoughPlayers
                ? 'NEED MORE PLAYERS'
                : 'WAITING FOR READY'}
            </motion.button>
          )}
        </motion.div>

        {isHost && !canStart && enoughPlayers && nonHostPlayers.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center font-mono text-xs text-gray-700"
          >
            Waiting for all players to ready up before you can start
          </motion.p>
        )}
      </main>
    </div>
  )
}

function PlayerCard({ player, index, isMe, accentColor }) {
  const avatarSrc =
    player.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.uid}`

  const meBorder =
    accentColor === 'cyan'
      ? 'border-neon-cyan/20 bg-neon-cyan/5'
      : 'border-neon-purple/20 bg-neon-purple/5'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12, scale: 0.96 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      className={`flex items-center gap-3.5 rounded-xl p-3.5 border transition-all ${
        isMe ? meBorder : 'border-white/5 bg-white/[0.018]'
      }`}
    >
      <div className="relative flex-shrink-0">
        <img
          src={avatarSrc}
          alt={player.name}
          className="w-10 h-10 rounded-full border border-white/10"
        />
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#060610] ${
            player.isConnected !== false ? 'bg-neon-green' : 'bg-gray-700'
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-body text-white font-semibold text-sm truncate">{player.name}</p>
          {isMe && (
            <span
              className={`font-mono text-[10px] ${
                accentColor === 'cyan' ? 'text-neon-cyan' : 'text-neon-purple'
              }`}
            >
              (you)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {player.isConnected !== false ? (
            <Wifi size={9} className="text-neon-green opacity-50" />
          ) : (
            <WifiOff size={9} className="text-gray-700" />
          )}
          <p className="font-mono text-[10px] text-gray-700 truncate">
            {player.uid.slice(0, 10)}…
          </p>
        </div>
      </div>

      <div className="flex-shrink-0">
        {player.isHost ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neon-gold/25 bg-neon-gold/8">
            <Crown size={10} className="text-neon-gold" />
            <span className="font-mono text-[10px] text-neon-gold">HOST</span>
          </div>
        ) : (
          <motion.div
            animate={
              player.isReady
                ? { boxShadow: ['0 0 0px rgba(0,255,136,0)', '0 0 8px rgba(0,255,136,0.4)', '0 0 0px rgba(0,255,136,0)'] }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              player.isReady
                ? 'border-neon-green/30 bg-neon-green/8 text-neon-green'
                : 'border-white/8 bg-white/[0.03] text-gray-600'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                player.isReady ? 'bg-neon-green animate-pulse' : 'bg-gray-700'
              }`}
            />
            <span className="font-mono text-[10px]">
              {player.isReady ? 'READY' : 'NOT READY'}
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
