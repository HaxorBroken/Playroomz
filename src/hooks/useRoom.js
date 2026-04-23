import { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createRoom, joinRoom, joinRoomByInviteCode, leaveRoom,
  setPlayerReady, subscribeToPublicRooms, subscribeToRoom,
  startGame, getUserCurrentRoom,
} from '../firebase/services'
import { useRoomStore, useAuthStore } from '../store'
import toast from 'react-hot-toast'

export const useRoom = () => {
  const { user } = useAuthStore()
  const {
    currentRoom, roomData, publicRooms,
    setCurrentRoom, setRoomData, setPublicRooms, clearRoom,
  } = useRoomStore()
  const navigate = useNavigate()
  const startingRef = useRef(false)

  useEffect(() => {
    const unsubscribe = subscribeToPublicRooms((rooms) => setPublicRooms(rooms))
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!currentRoom) return
    const unsubscribe = subscribeToRoom(currentRoom, (data) => {
      if (!data) {
        clearRoom()
        navigate('/lobby')
        toast.error('Room was closed')
        return
      }
      setRoomData(data)
      if (data.status === 'in-progress') {
        const path = window.location.pathname
        if (path.startsWith('/room/') || path === '/lobby' || path === '/') {
          navigate(`/game/${currentRoom}`)
        }
      }
    })
    return unsubscribe
  }, [currentRoom])

  const initRoomFromUrl = useCallback(async (roomId) => {
    if (!user || !roomId) return
    if (currentRoom === roomId) return

    try {
      const serverRoom = await getUserCurrentRoom(user.uid)
      if (serverRoom === roomId) {
        setCurrentRoom(roomId)
      }
    } catch { }
  }, [user, currentRoom])

  const handleCreateRoom = useCallback(async (gameType, isPrivate, maxPlayers) => {
    if (!user) return
    try {
      const roomId = await createRoom(user, gameType, isPrivate, maxPlayers)
      setCurrentRoom(roomId)
      navigate(`/room/${roomId}`)
      toast.success('Room created!')
      return roomId
    } catch (error) {
      toast.error(error.message || 'Failed to create room')
    }
  }, [user])

  const handleJoinRoom = useCallback(async (roomId) => {
    if (!user) return
    try {
      await joinRoom(roomId, user)
      setCurrentRoom(roomId)
      navigate(`/room/${roomId}`)
      toast.success('Joined room!')
    } catch (error) {
      toast.error(error.message || 'Failed to join room')
    }
  }, [user])

  const handleJoinByCode = useCallback(async (code) => {
    if (!user) return
    try {
      const roomId = await joinRoomByInviteCode(code, user)
      setCurrentRoom(roomId)
      navigate(`/room/${roomId}`)
      toast.success('Joined private room!')
    } catch (error) {
      toast.error(error.message || 'Invalid invite code')
    }
  }, [user])

  const handleLeaveRoom = useCallback(async () => {
    if (!currentRoom || !user) return
    try {
      await leaveRoom(currentRoom, user.uid)
      clearRoom()
      navigate('/lobby')
    } catch {
      toast.error('Failed to leave room')
    }
  }, [currentRoom, user])

  const handleToggleReady = useCallback(async () => {
    if (!currentRoom || !user || !roomData) return
    const players = roomData.players || {}
    const player = players[user.uid]
    const isReady = player?.isReady || false
    try {
      await setPlayerReady(currentRoom, user.uid, !isReady)
    } catch {
      toast.error('Failed to update ready status')
    }
  }, [currentRoom, user, roomData])

  const handleStartGame = useCallback(async () => {
    if (!currentRoom || startingRef.current) return
    startingRef.current = true
    try {
      await startGame(currentRoom)
    } catch (error) {
      toast.error(error.message || 'Failed to start game')
    } finally {
      startingRef.current = false
    }
  }, [currentRoom])

  return {
    currentRoom,
    roomData,
    publicRooms,
    createRoom: handleCreateRoom,
    joinRoom: handleJoinRoom,
    joinByCode: handleJoinByCode,
    leaveRoom: handleLeaveRoom,
    toggleReady: handleToggleReady,
    startGame: handleStartGame,
    initRoomFromUrl,
  }
}
