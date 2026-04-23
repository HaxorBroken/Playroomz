import { useCallback, useEffect } from 'react'
import { voiceChatManager } from '../firebase/voiceChat'
import { useVoiceStore, useAuthStore } from '../store'
import toast from 'react-hot-toast'

export const useVoiceChat = (roomId, players) => {
  const { user } = useAuthStore()
  const {
    isMuted, isConnected, voiceEnabled,
    setMuted, setConnected, setRemoteStream, removeRemoteStream, setVoiceEnabled,
  } = useVoiceStore()

  useEffect(() => {
    if (!roomId || !user || !voiceEnabled) return

    let active = true

    const initVoice = async () => {
      const success = await voiceChatManager.initialize(roomId, user.uid, (peerId, stream) => {
        if (active) setRemoteStream(peerId, stream)
      })

      if (!active) return

      if (success) {
        setConnected(true)
        if (players) {
          const others = players.filter(p => p.uid !== user.uid)
          for (const player of others) {
            await voiceChatManager.connectToPeer(player.uid)
          }
        }
      } else {
        setVoiceEnabled(false)
        toast.error('Microphone access denied. Please allow mic access and try again.')
      }
    }

    initVoice()

    return () => {
      active = false
      voiceChatManager.disconnect()
      setConnected(false)
    }
  }, [roomId, user?.uid, voiceEnabled])

  const enableVoice = useCallback(async () => {
    setVoiceEnabled(true)
  }, [])

  const disableVoice = useCallback(() => {
    voiceChatManager.disconnect()
    setVoiceEnabled(false)
    setConnected(false)
    toast('Voice chat disabled')
  }, [])

  const toggleMute = useCallback(() => {
    const muted = voiceChatManager.toggleMute()
    setMuted(muted)
    toast(muted ? '🔇 Muted' : '🎙️ Unmuted', { duration: 1500 })
  }, [])

  return { isMuted, isConnected, voiceEnabled, enableVoice, disableVoice, toggleMute }
}
