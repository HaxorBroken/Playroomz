import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth'

export default function AuthPage() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  return (
    <div className="min-h-screen bg-void flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />

      <div className="absolute inset-0 pointer-events-none">
        {[
          { w: 400, h: 400, x: 10, y: 20, color: 'cyan' },
          { w: 300, h: 300, x: 70, y: 60, color: 'purple' },
          { w: 250, h: 250, x: 30, y: 75, color: 'pink' },
        ].map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-[0.07]"
            style={{
              width: orb.w,
              height: orb.h,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              background: `radial-gradient(circle, var(--orb-${orb.color}), transparent 70%)`,
              '--orb-cyan': '#00f5ff',
              '--orb-purple': '#bf00ff',
              '--orb-pink': '#ff0080',
              backgroundColor: orb.color === 'cyan' ? '#00f5ff' : orb.color === 'purple' ? '#bf00ff' : '#ff0080',
              filter: 'blur(60px)',
            }}
            animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 6 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[420px] px-4"
      >
        <div className="glass neon-border rounded-3xl p-9 space-y-8">
          <div className="text-center space-y-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              className="w-14 h-14 mx-auto border border-dashed border-neon-cyan/40 rounded-2xl flex items-center justify-center"
            >
              <span className="text-2xl">🎮</span>
            </motion.div>

            <div>
              <h1 className="font-display font-black text-5xl tracking-tight leading-none">
                <span className="shimmer-text">GAME</span>
                <br />
                <span className="text-white">PORTAL</span>
              </h1>
              <p className="font-mono text-gray-600 text-xs tracking-[0.25em] mt-3 uppercase">
                Multiplayer Gaming Hub
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/5" />
              <span className="font-mono text-gray-700 text-[10px] tracking-widest">AVAILABLE GAMES</span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: '🃏', name: 'UNO', desc: '2–4 Players', color: 'cyan' },
                { icon: '♠️', name: 'Call Bridge', desc: '4 Players', color: 'purple' },
              ].map((game) => (
                <div
                  key={game.name}
                  className={`rounded-xl p-4 border text-center ${
                    game.color === 'cyan'
                      ? 'border-neon-cyan/15 bg-neon-cyan/5'
                      : 'border-neon-purple/15 bg-neon-purple/5'
                  }`}
                >
                  <div className="text-2xl mb-1.5">{game.icon}</div>
                  <div className="font-display text-white text-sm font-bold">{game.name}</div>
                  <div className="font-mono text-gray-600 text-[10px] mt-0.5">{game.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <motion.button
              onClick={signInWithGoogle}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-display font-bold text-sm tracking-wider py-4 rounded-xl hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </motion.button>

            <p className="text-center font-mono text-gray-700 text-[10px] tracking-wider">
              By signing in, you agree to our Terms of Service
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
