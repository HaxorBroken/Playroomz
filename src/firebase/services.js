import {
  ref, set, update, get, onValue, off, push, remove, onDisconnect
} from 'firebase/database'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, rtdb } from './config'

const generateId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const saveUserProfile = async (user) => {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    avatar: user.photoURL,
    lastSeen: serverTimestamp(),
  }, { merge: true })
}

export const getUserCurrentRoom = async (userId) => {
  const snap = await get(ref(rtdb, `userRooms/${userId}`))
  return snap.exists() ? snap.val() : null
}

export const createRoom = async (hostUser, gameType, isPrivate, maxPlayers) => {
  const existingRoomId = await getUserCurrentRoom(hostUser.uid)
  if (existingRoomId) {
    await leaveRoom(existingRoomId, hostUser.uid).catch(() => {})
  }

  const roomId = generateId()
  const inviteCode = isPrivate ? generateCode() : null
  const now = Date.now()

  const roomData = {
    id: roomId,
    hostId: hostUser.uid,
    gameType,
    isPrivate,
    inviteCode,
    maxPlayers,
    status: 'waiting',
    players: {
      [hostUser.uid]: {
        uid: hostUser.uid,
        name: hostUser.displayName || 'Player',
        avatar: hostUser.photoURL || null,
        isHost: true,
        isReady: false,
        isConnected: true,
        joinedAt: now,
      },
    },
    createdAt: now,
    gameInitialized: false,
  }

  await set(ref(rtdb, `rooms/${roomId}`), roomData)

  if (inviteCode) {
    await set(ref(rtdb, `inviteCodes/${inviteCode}`), roomId)
  }

  await set(ref(rtdb, `userRooms/${hostUser.uid}`), roomId)

  onDisconnect(ref(rtdb, `rooms/${roomId}/players/${hostUser.uid}/isConnected`)).set(false)
  onDisconnect(ref(rtdb, `userRooms/${hostUser.uid}`)).remove()

  return roomId
}

export const joinRoom = async (roomId, user) => {
  const existingRoomId = await getUserCurrentRoom(user.uid)

  if (existingRoomId) {
    if (existingRoomId === roomId) {
      await update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), { isConnected: true })
      await set(ref(rtdb, `userRooms/${user.uid}`), roomId)
      return roomId
    }
    throw new Error('You are already in a room. Leave it first.')
  }

  const snap = await get(ref(rtdb, `rooms/${roomId}`))
  if (!snap.exists()) throw new Error('Room not found')

  const room = snap.val()
  if (room.status !== 'waiting') throw new Error('Game already in progress')

  const players = room.players || {}
  const playerCount = Object.keys(players).length

  if (playerCount >= room.maxPlayers) throw new Error('Room is full')

  if (players[user.uid]) {
    await set(ref(rtdb, `userRooms/${user.uid}`), roomId)
    await update(ref(rtdb, `rooms/${roomId}/players/${user.uid}`), { isConnected: true })
    return roomId
  }

  const playerData = {
    uid: user.uid,
    name: user.displayName || 'Player',
    avatar: user.photoURL || null,
    isHost: false,
    isReady: false,
    isConnected: true,
    joinedAt: Date.now(),
  }

  await update(ref(rtdb, `rooms/${roomId}/players`), { [user.uid]: playerData })
  await set(ref(rtdb, `userRooms/${user.uid}`), roomId)

  onDisconnect(ref(rtdb, `rooms/${roomId}/players/${user.uid}/isConnected`)).set(false)
  onDisconnect(ref(rtdb, `userRooms/${user.uid}`)).remove()

  return roomId
}

export const joinRoomByInviteCode = async (inviteCode, user) => {
  const snap = await get(ref(rtdb, `inviteCodes/${inviteCode.toUpperCase()}`))
  if (!snap.exists()) throw new Error('Invalid invite code')
  const roomId = snap.val()
  return joinRoom(roomId, user)
}

export const leaveRoom = async (roomId, userId) => {
  const snap = await get(ref(rtdb, `rooms/${roomId}`))

  if (!snap.exists()) {
    await remove(ref(rtdb, `userRooms/${userId}`))
    return
  }

  const room = snap.val()
  const players = room.players || {}
  const remaining = Object.values(players).filter(p => p.uid !== userId)

  if (remaining.length === 0) {
    if (room.inviteCode) {
      await remove(ref(rtdb, `inviteCodes/${room.inviteCode}`))
    }
    await remove(ref(rtdb, `rooms/${roomId}`))
    await remove(ref(rtdb, `games/${roomId}`))
    await remove(ref(rtdb, `actions/${roomId}`))
    await remove(ref(rtdb, `signaling/${roomId}`))
  } else if (room.hostId === userId) {
    const newHost = remaining[0]
    await update(ref(rtdb, `rooms/${roomId}/players/${newHost.uid}`), { isHost: true })
    await update(ref(rtdb, `rooms/${roomId}`), { hostId: newHost.uid })
    await remove(ref(rtdb, `rooms/${roomId}/players/${userId}`))
  } else {
    await remove(ref(rtdb, `rooms/${roomId}/players/${userId}`))
  }

  await remove(ref(rtdb, `userRooms/${userId}`))
}

export const setPlayerReady = async (roomId, userId, isReady) => {
  await update(ref(rtdb, `rooms/${roomId}/players/${userId}`), { isReady })
}

export const startGame = async (roomId) => {
  const snap = await get(ref(rtdb, `rooms/${roomId}`))
  if (!snap.exists()) throw new Error('Room not found')

  const room = snap.val()
  if (room.status !== 'waiting') throw new Error('Game has already started')

  const players = Object.values(room.players || {})
  const nonHosts = players.filter(p => !p.isHost)
  const minPlayers = room.gameType === 'callbridge' ? 4 : 2

  if (players.length < minPlayers) {
    throw new Error(`Need at least ${minPlayers} players`)
  }
  if (nonHosts.length === 0 || !nonHosts.every(p => p.isReady)) {
    throw new Error('All non-host players must be ready')
  }

  await update(ref(rtdb, `rooms/${roomId}`), { status: 'in-progress' })
}

export const subscribeToRoom = (roomId, callback) => {
  const roomRef = ref(rtdb, `rooms/${roomId}`)
  const handler = onValue(roomRef, (snap) => {
    callback(snap.val())
  })
  return () => off(roomRef, 'value', handler)
}

export const subscribeToPublicRooms = (callback) => {
  const roomsRef = ref(rtdb, 'rooms')
  const handler = onValue(roomsRef, (snap) => {
    const data = snap.val() || {}
    const rooms = Object.values(data).filter(r => !r.isPrivate && r.status === 'waiting')
    callback(rooms)
  })
  return () => off(roomsRef, 'value', handler)
}

export const updateGameState = async (roomId, gameState) => {
  await set(ref(rtdb, `games/${roomId}`), { ...gameState, updatedAt: Date.now() })
}

export const subscribeToGameState = (roomId, callback) => {
  const gameRef = ref(rtdb, `games/${roomId}`)
  const handler = onValue(gameRef, (snap) => {
    callback(snap.val())
  })
  return () => off(gameRef, 'value', handler)
}

export const pushPlayerAction = async (roomId, action) => {
  await push(ref(rtdb, `actions/${roomId}`), { ...action, timestamp: Date.now() })
}

export const subscribeToActions = (roomId, callback) => {
  const actionsRef = ref(rtdb, `actions/${roomId}`)
  const handler = onValue(actionsRef, (snap) => {
    const data = snap.val()
    if (data) {
      const actions = Object.entries(data).map(([key, val]) => ({ key, ...val }))
      callback(actions)
    }
  })
  return () => off(actionsRef, 'value', handler)
}

export const endGame = async (roomId) => {
  await update(ref(rtdb, `rooms/${roomId}`), { status: 'finished' })
}
