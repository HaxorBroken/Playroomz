import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'
import { useRoom } from '../../hooks/useRoom'
import { LogOut, Gamepad2, Users, Mic, Shield, ArrowRight, ChevronRight, Zap } from 'lucide-react'

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const { currentRoom, roomData } = useRoom()
  const navigate = useNavigate()

  const isInGame = currentRoom && roomData?.status === 'in-progress'
  const isInRoom = currentRoom && roomData?.status === 'waiting'

  return (
    <div className="min-h-screen bg-void grid-bg">
      <header className="border-b border-white/5 glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 border border-neon-cyan/30 rounded-lg flex items-center justify-center bg-neon-cyan/5">
              <Gamepad2 size={14} className="text-neon-cyan" />
            </div>
            <span className="font-display font-black tracking-widest text-sm text-white">GAMEPORTAL</span>
          </div>

          <div className="flex items-center gap-3">
            {(isInGame || isInRoom) && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => navigate(isInGame ? `/game/${currentRoom}` : `/room/${currentRoom}`)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-neon-green/40 text-neon-green bg-neon-green/10 hover:bg-neon-green/20 font-mono text-xs tracking-wider transition-all"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                {isInGame ? 'RETURN TO GAME' : 'RETURN TO ROOM'}
                <ChevronRight size={12} />
              </motion.button>
            )}

            <div className="flex items-center gap-2.5">
              <img
                src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                alt="avatar"
                className="w-8 h-8 rounded-full border border-white/10"
              />
              <div className="hidden sm:block">
                <p className="font-body text-white text-sm font-semibold leading-none">{user?.displayName}</p>
                <p className="font-mono text-gray-600 text-[11px] mt-0.5 truncate max-w-[140px]">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-neon-pink transition-colors p-2 rounded-lg hover:bg-neon-pink/10"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-14">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="space-y-14"
        >
          <motion.div variants={fadeUp} className="text-center space-y-3">
            <p className="font-mono text-gray-700 text-xs tracking-[0.3em] uppercase">Welcome back</p>
            <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight">
              <span className="shimmer-text">{user?.displayName?.toUpperCase() || 'PLAYER'}</span>
            </h1>
            <p className="text-gray-600 font-body text-base">Pick a game and challenge your friends.</p>
          </motion.div>

          <motion.div variants={fadeUp} className="grid sm:grid-cols-2 gap-4">
            <GameCard
              icon="🃏"
              title="UNO"
              subtitle="2–4 Players"
              desc="Full rule enforcement — skips, reverses, draw cards, wild colors, UNO challenges."
              features={['Card stacking rules', 'UNO penalty system', 'Wild color picker', 'Real-time sync']}
              color="cyan"
              onClick={() => navigate('/lobby?game=uno')}
            />
            <GameCard
              icon="♠️"
              title="Call Bridge"
              subtitle="4 Players"
              desc="Strategic trick-taking card game. Bid your tricks, pick your trump, outplay opponents."
              features={['Bidding system', 'Trump suit selection', 'Trick tracking', 'Score leaderboard']}
              color="purple"
              onClick={() => navigate('/lobby?game=callbridge')}
            />
          </motion.div>

          <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
            {[
              { icon: <Users size={16} />, label: 'Real-time Multiplayer', color: 'text-neon-cyan', bg: 'border-neon-cyan/15 bg-neon-cyan/5' },
              { icon: <Mic size={16} />, label: 'In-Room Voice Chat', color: 'text-neon-gold', bg: 'border-neon-gold/15 bg-neon-gold/5' },
              { icon: <Shield size={16} />, label: 'Private Rooms', color: 'text-neon-purple', bg: 'border-neon-purple/15 bg-neon-purple/5' },
            ].map(({ icon, label, color, bg }) => (
              <div key={label} className={`flex items-center gap-2.5 p-4 rounded-xl border ${bg}`}>
                <div className={color}>{icon}</div>
                <p className="font-body text-gray-400 text-xs font-semibold leading-snug">{label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </main>
    </div>
  )
}

function GameCard({ icon, title, subtitle, desc, features, color, onClick }) {
  const accent = color === 'cyan'
    ? { border: 'border-neon-cyan/15', hover: 'hover:border-neon-cyan/30', text: 'text-neon-cyan', dot: 'bg-neon-cyan', grad: 'from-neon-cyan/15 to-neon-cyan/5' }
    : { border: 'border-neon-purple/15', hover: 'hover:border-neon-purple/30', text: 'text-neon-purple', dot: 'bg-neon-purple', grad: 'from-neon-purple/15 to-neon-purple/5' }

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`group rounded-2xl border ${accent.border} ${accent.hover} bg-gradient-to-br ${accent.grad} p-7 cursor-pointer transition-all duration-300 space-y-5`}
    >
      <div className="flex items-start justify-between">
        <span className="text-4xl">{icon}</span>
        <span className="font-mono text-[10px] border border-white/10 px-3 py-1 rounded-full text-gray-500">
          {subtitle}
        </span>
      </div>

      <div className="space-y-1.5">
        <h2 className="font-display text-2xl font-black text-white">{title}</h2>
        <p className="text-gray-500 font-body text-sm leading-relaxed">{desc}</p>
      </div>

      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-gray-500 text-xs font-body">
            <div className={`w-1.5 h-1.5 rounded-full ${accent.dot} opacity-50 flex-shrink-0`} />
            {f}
          </li>
        ))}
      </ul>

      <div className={`flex items-center gap-2 font-mono text-xs ${accent.text} group-hover:gap-3 transition-all`}>
        PLAY NOW <ArrowRight size={13} />
      </div>
    </motion.div>
  )
}
