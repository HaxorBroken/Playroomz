import { ref, set, onChildAdded, off, remove } from 'firebase/database'
import { rtdb } from './config'

class VoiceChatManager {
  constructor() {
    this.peerConnections = new Map()
    this.localStream = null
    this.roomId = null
    this.userId = null
    this.isMuted = false
    this.onRemoteStream = null
    this.unsubscribers = []

    this.configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    }
  }

  async initialize(roomId, userId, onRemoteStreamCallback) {
    this.roomId = roomId
    this.userId = userId
    this.onRemoteStream = onRemoteStreamCallback

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
    } catch {
      return false
    }

    await remove(ref(rtdb, `signaling/${roomId}/${userId}`)).catch(() => {})
    this.listenForSignals()
    return true
  }

  listenForSignals() {
    const mySignalsRef = ref(rtdb, `signaling/${this.roomId}/${this.userId}`)

    const unsubSenders = onChildAdded(mySignalsRef, (senderSnap) => {
      const senderId = senderSnap.key
      if (!senderId || senderId === this.userId) return

      const senderRef = ref(rtdb, `signaling/${this.roomId}/${this.userId}/${senderId}`)
      const unsubSignals = onChildAdded(senderRef, async (sigSnap) => {
        const signal = sigSnap.val()
        if (signal) await this.handleSignal(senderId, signal)
      })

      this.unsubscribers.push(unsubSignals)
    })

    this.unsubscribers.push(unsubSenders)
  }

  async handleSignal(senderId, signal) {
    if (signal.type === 'offer') {
      await this.handleOffer(senderId, signal)
    } else if (signal.type === 'answer') {
      await this.handleAnswer(senderId, signal)
    } else if (signal.type === 'ice-candidate') {
      await this.handleIceCandidate(senderId, signal)
    }
  }

  async connectToPeer(peerId) {
    if (this.peerConnections.has(peerId)) return

    const pc = this.createPeerConnection(peerId)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await this.sendSignal(peerId, { type: 'offer', sdp: offer.sdp })
    } catch {
      this.peerConnections.delete(peerId)
    }
  }

  createPeerConnection(peerId) {
    const pc = new RTCPeerConnection(this.configuration)

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream))
    }

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        await this.sendSignal(peerId, {
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        })
      }
    }

    pc.ontrack = (event) => {
      if (this.onRemoteStream && event.streams[0]) {
        this.onRemoteStream(peerId, event.streams[0])
      }
    }

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        this.peerConnections.delete(peerId)
      }
    }

    this.peerConnections.set(peerId, pc)
    return pc
  }

  async handleOffer(senderId, signal) {
    const existing = this.peerConnections.get(senderId)

    if (existing) {
      if (senderId > this.userId) {
        existing.close()
        this.peerConnections.delete(senderId)
      } else {
        return
      }
    }

    const pc = this.createPeerConnection(senderId)

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      await this.sendSignal(senderId, { type: 'answer', sdp: answer.sdp })
    } catch { }
  }

  async handleAnswer(senderId, signal) {
    const pc = this.peerConnections.get(senderId)
    if (pc && pc.signalingState !== 'stable') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }))
      } catch { }
    }
  }

  async handleIceCandidate(senderId, signal) {
    const pc = this.peerConnections.get(senderId)
    if (pc && signal.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate))
      } catch { }
    }
  }

  async sendSignal(targetId, signal) {
    const signalRef = ref(rtdb, `signaling/${this.roomId}/${targetId}/${this.userId}/${Date.now()}`)
    await set(signalRef, signal)
  }

  toggleMute() {
    this.isMuted = !this.isMuted
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted
      })
    }
    return this.isMuted
  }

  disconnect() {
    this.peerConnections.forEach(pc => pc.close())
    this.peerConnections.clear()

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop())
      this.localStream = null
    }

    this.unsubscribers.forEach(fn => { try { fn() } catch { } })
    this.unsubscribers = []
  }
}

export const voiceChatManager = new VoiceChatManager()
