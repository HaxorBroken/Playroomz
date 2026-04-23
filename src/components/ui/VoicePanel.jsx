import { motion } from 'framer-motion'
import { Mic, MicOff, PhoneCall } from 'lucide-react'

export default function VoicePanel({ isMuted, isConnected, voiceEnabled, onEnable, onToggleMute }) {
  if (!voiceEnabled) {
    return (
      <motion.button
        onClick={onEnable}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-gray-500 hover:border-neon-cyan/30 hover:text-neon-cyan transition-all text-xs font-mono"
      >
        <PhoneCall size={12} />
        <span>Voice</span>
      </motion.button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isConnected ? 'bg-neon-green animate-pulse' : 'bg-gray-600'
        }`}
      />
      <motion.button
        onClick={onToggleMute}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-xs font-mono ${
          isMuted
            ? 'border-neon-pink/35 text-neon-pink bg-neon-pink/8'
            : 'border-neon-green/35 text-neon-green bg-neon-green/8'
        }`}
      >
        {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
        <span>{isMuted ? 'Muted' : 'Live'}</span>
      </motion.button>
    </div>
  )
}
