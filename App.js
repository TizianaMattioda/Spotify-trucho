import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, ScrollView, TextInput, Modal } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const SAMPLE_SONGS = [
  { id: '1', title: 'Megalovania', artist: 'Toby Fox', duration: 120000, cover: '🎵', source: require('./assets/megalovania.mp3') },
  { id: '2', title: 'Vlog Beat Background', artist: 'Unknown Artist', duration: 180000, cover: '🎶', source: require('./assets/vlog-beat-background-349853.mp3') },
  { id: '3', title: 'The Last Point Beat', artist: 'Electronic Digital', duration: 150000, cover: '🎼', source: require('./assets/the-last-point-beat-electronic-digital-394291.mp3') },
  { id: '4', title: 'Running Night', artist: 'Unknown Artist', duration: 200000, cover: '🎤', source: require('./assets/running-night-393139.mp3') },
  { id: '5', title: 'Retro Lounge', artist: 'Unknown Artist', duration: 160000, cover: '🎧', source: require('./assets/retro-lounge-389644.mp3') },
  { id: '6', title: 'Deep Abstract Ambient', artist: 'Snowcap', duration: 220000, cover: '🌌', source: require('./assets/deep-abstract-ambient_snowcap-401656.mp3') }
];

const DEFAULT_PLAYLIST = { id: 'default', name: 'Playlist Default', songs: SAMPLE_SONGS, createdAt: new Date().toISOString() };

export default function App() {
  const soundRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isBuffering, setIsBuffering] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const [currentPlaylist, setCurrentPlaylist] = useState(DEFAULT_PLAYLIST);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState(DEFAULT_PLAYLIST.songs[0]);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [shuffledIndices, setShuffledIndices] = useState([]);
  const [playlists, setPlaylists] = useState([DEFAULT_PLAYLIST]);
  const [activeTab, setActiveTab] = useState('player');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false, interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX, shouldDuckAndroid: true });
    loadSong(0);
    return () => { if (soundRef.current) soundRef.current.unloadAsync(); };
  }, []);

  const unloadCurrent = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setIsLoaded(false); setIsPlaying(false); setPositionMs(0); setDurationMs(0);
  };

  const loadSong = async (index, autoplay = false) => {
    await unloadCurrent();
    const song = currentPlaylist.songs[index];
    if (!song) return;
    try {
      setIsBuffering(true);
      const { sound, status } = await Audio.Sound.createAsync(song.source, { volume, shouldPlay: autoplay }, onStatusUpdate);
      soundRef.current = sound;
      setIsLoaded(true);
      setCurrentSong(song);
      setCurrentSongIndex(index);
      if (status?.isLoaded) {
        setDurationMs(status.durationMillis ?? 0);
        setPositionMs(status.positionMillis ?? 0);
      }
    } catch {
      setIsLoaded(false);
    } finally {
      setIsBuffering(false);
    }
  };

  const onStatusUpdate = (status) => {
    if (!status) return;
    if (status.isLoaded) {
      setIsPlaying(Boolean(status.isPlaying));
      setIsBuffering(Boolean(status.isBuffering));
      setDurationMs(status.durationMillis ?? 0);
      setPositionMs(status.positionMillis ?? 0);
    } else {
      setIsPlaying(false);
      setIsBuffering(false);
    }
  };

  const nextSong = async () => {
    if (currentPlaylist.songs.length === 0) return;
    const nextIndex = shuffleMode && shuffledIndices.length > 0 ? (currentSongIndex + 1) % shuffledIndices.length : (currentSongIndex + 1) % currentPlaylist.songs.length;
    const realIndex = shuffleMode ? shuffledIndices[nextIndex] : nextIndex;
    await loadSong(realIndex, true);
  };

  const previousSong = async () => {
    if (currentPlaylist.songs.length === 0) return;
    if (positionMs < 3000) {
      const prevIndex = shuffleMode && shuffledIndices.length > 0 ? (currentSongIndex - 1 + shuffledIndices.length) % shuffledIndices.length : (currentSongIndex - 1 + currentPlaylist.songs.length) % currentPlaylist.songs.length;
      const realIndex = shuffleMode ? shuffledIndices[prevIndex] : prevIndex;
      await loadSong(realIndex, true);
    } else {
      if (soundRef.current) { await soundRef.current.setPositionAsync(0); if (isPlaying) await soundRef.current.playAsync(); }
    }
  };

  const changePlaylist = async (playlist) => { await unloadCurrent(); setCurrentPlaylist(playlist); await loadSong(0); };

  const toggleShuffle = () => {
    const newMode = !shuffleMode;
    setShuffleMode(newMode);
    setShuffledIndices(newMode ? Array.from({ length: currentPlaylist.songs.length }, (_, i) => i).sort(() => Math.random() - 0.5) : []);
  };

  const playAsync = async () => { if (!isLoaded) await loadSong(currentSongIndex); if (soundRef.current) await soundRef.current.playAsync(); };
  const pauseAsync = async () => { if (soundRef.current) await soundRef.current.pauseAsync(); };
  const changeVolume = async (delta) => { const next = Math.min(1, Math.max(0, Number((volume + delta).toFixed(2)))); setVolume(next); if (soundRef.current) await soundRef.current.setVolumeAsync(next); };

  const addSongToPlaylist = (song) => { if (!selectedSongs.find(s => s.id === song.id)) setSelectedSongs([...selectedSongs, song]); };
  const createPlaylist = () => { if (newPlaylistName.trim() && selectedSongs.length > 0) { const newPlaylist = { id: Date.now().toString(), name: newPlaylistName.trim(), songs: selectedSongs, createdAt: new Date().toISOString() }; setPlaylists([...playlists, newPlaylist]); setNewPlaylistName(''); setSelectedSongs([]); setActiveTab('playlists'); } };
  const deletePlaylist = (playlistId) => { if (playlistId === 'default') return; setPlaylists(playlists.filter(p => p.id !== playlistId)); if (currentPlaylist.id === playlistId) changePlaylist(DEFAULT_PLAYLIST); setShowDeleteModal(false); setPlaylistToDelete(null); };

  const nextSongData = currentPlaylist.songs.length > 0 ? currentPlaylist.songs[(currentSongIndex + 1) % currentPlaylist.songs.length] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerTitle}>{currentPlaylist.name}</Text></View>
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'player' && styles.activeTab]} onPress={() => setActiveTab('player')}><Ionicons name="musical-notes" size={20} color={activeTab === 'player' ? '#00ff00' : '#666666'} /><Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText]}>Reproductor</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'create' && styles.activeTab]} onPress={() => setActiveTab('create')}><Ionicons name="add-circle" size={20} color={activeTab === 'create' ? '#00ff00' : '#666666'} /><Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>Crear</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'playlists' && styles.activeTab]} onPress={() => setActiveTab('playlists')}><Ionicons name="list" size={20} color={activeTab === 'playlists' ? '#00ff00' : '#666666'} /><Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>Playlists</Text></TouchableOpacity>
      </View>
      {activeTab === 'player' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {currentSong && (<View style={styles.songInfo}><Text style={styles.songCover}>{currentSong.cover}</Text><Text style={styles.songTitle}>{currentSong.title}</Text><Text style={styles.songArtist}>{currentSong.artist}</Text></View>)}
          <View style={styles.mainControls}>
            <TouchableOpacity style={styles.navButton} onPress={previousSong}><Ionicons name="play-skip-back" size={24} color="#ffffff" /></TouchableOpacity>
            <TouchableOpacity style={[styles.playButton, isBuffering && styles.buttonDisabled]} onPress={isPlaying ? pauseAsync : playAsync} disabled={isBuffering}>{isBuffering ? (<ActivityIndicator color="#ffffff" />) : (<Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#ffffff" />)}</TouchableOpacity>
            <TouchableOpacity style={styles.navButton} onPress={nextSong}><Ionicons name="play-skip-forward" size={24} color="#ffffff" /></TouchableOpacity>
          </View>
          <View style={styles.secondaryControls}>
            <TouchableOpacity style={[styles.shuffleButton, shuffleMode && styles.shuffleActive]} onPress={toggleShuffle}><Ionicons name="shuffle" size={20} color={shuffleMode ? '#00ff00' : '#ffffff'} /></TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => changeVolume(-0.1)}><Ionicons name="volume-medium" size={20} color="#ffffff" /></TouchableOpacity>
            <TouchableOpacity style={styles.controlButton} onPress={() => changeVolume(0.1)}><Ionicons name="volume-high" size={20} color="#ffffff" /></TouchableOpacity>
          </View>
          <View style={styles.infoContainer}><Text style={styles.timeInfo}>{formatTime(positionMs)} / {formatTime(durationMs)}</Text><Text style={styles.volumeInfo}>Volumen: {(volume * 100).toFixed(0)}%</Text></View>
        </ScrollView>
      )}
      {activeTab === 'create' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Crear Nueva Playlist</Text>
          <TextInput style={styles.input} placeholder="Nombre de la playlist" placeholderTextColor="#444444" value={newPlaylistName} onChangeText={setNewPlaylistName} />
          <Text style={styles.sectionTitle}>Seleccionar Canciones</Text>
          {SAMPLE_SONGS.map((song) => (
            <TouchableOpacity key={song.id} style={[styles.songItem, selectedSongs.find(s => s.id === song.id) && styles.songItemSelected]} onPress={() => addSongToPlaylist(song)}>
              <Text style={styles.songCover}>{song.cover}</Text>
              <View style={styles.songDetails}><Text style={styles.songTitle}>{song.title}</Text><Text style={styles.songArtist}>{song.artist}</Text><Text style={styles.songDuration}>{formatTime(song.duration)}</Text></View>
              {selectedSongs.find(s => s.id === song.id) && (<Ionicons name="checkmark-circle" size={24} color="#00ff00" />)}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.createButton, (!newPlaylistName.trim() || selectedSongs.length === 0) && styles.buttonDisabled]} onPress={createPlaylist} disabled={!newPlaylistName.trim() || selectedSongs.length === 0}><Text style={styles.createButtonText}>Crear Playlist</Text></TouchableOpacity>
        </ScrollView>
      )}
      {activeTab === 'playlists' && (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Mis Playlists</Text>
          {playlists.map((playlist) => (
            <TouchableOpacity key={playlist.id} style={[styles.playlistItem, currentPlaylist.id === playlist.id && styles.playlistItemActive]} onPress={() => changePlaylist(playlist)}>
              <View style={styles.playlistInfo}><Text style={styles.playlistName}>{playlist.name}</Text><Text style={styles.playlistSongs}>{playlist.songs.length} canciones</Text></View>
              <View style={styles.playlistActions}>
                <TouchableOpacity style={styles.playButton} onPress={() => changePlaylist(playlist)}><Ionicons name="play" size={20} color="#ffffff" /></TouchableOpacity>
                {playlist.id !== 'default' && (<TouchableOpacity style={styles.deleteButton} onPress={() => { setPlaylistToDelete(playlist); setShowDeleteModal(true); }}><Ionicons name="trash" size={20} color="#ff4444" /></TouchableOpacity>)}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {nextSongData && (<View style={styles.footer}><Text style={styles.footerText}>Próxima canción: {nextSongData.title} - {nextSongData.artist}</Text></View>)}
      <Modal visible={showDeleteModal} transparent={true} animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Eliminar Playlist</Text>
            <Text style={styles.modalMessage}>¿Estás seguro de que quieres eliminar "{playlistToDelete?.name}"?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowDeleteModal(false)}><Text style={styles.cancelButtonText}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={() => deletePlaylist(playlistToDelete?.id)}><Text style={styles.confirmButtonText}>Eliminar</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { backgroundColor: '#0a0a0a', paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  headerTitle: { color: '#00ff00', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, paddingHorizontal: 10 },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#00ff00' },
  tabText: { color: '#666666', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  activeTabText: { color: '#00ff00' },
  content: { flex: 1, paddingHorizontal: 20 },
  songInfo: { alignItems: 'center', paddingVertical: 30 },
  songCover: { fontSize: 80, marginBottom: 20 },
  songTitle: { color: '#00ff00', fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  songArtist: { color: '#888888', fontSize: 16, textAlign: 'center' },
  mainControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 30 },
  navButton: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, borderWidth: 1, borderColor: '#00ff00' },
  playButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#00ff00', alignItems: 'center', justifyContent: 'center' },
  secondaryControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 20 },
  shuffleButton: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, borderWidth: 1, borderColor: '#333333' },
  shuffleActive: { backgroundColor: '#0a0a0a', borderWidth: 2, borderColor: '#00ff00' },
  controlButton: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8, borderWidth: 1, borderColor: '#333333' },
  infoContainer: { alignItems: 'center', marginVertical: 20 },
  timeInfo: { color: '#888888', fontSize: 16, marginBottom: 8 },
  volumeInfo: { color: '#00ff00', fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: '#00ff00', fontSize: 20, fontWeight: '700', marginVertical: 20 },
  input: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#333333', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, color: '#00ff00', fontSize: 16, marginBottom: 20 },
  songItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#333333' },
  songItemSelected: { borderColor: '#00ff00', backgroundColor: '#0a0a0a' },
  songDetails: { flex: 1, marginLeft: 15 },
  songDuration: { color: '#888888', fontSize: 12, marginTop: 4 },
  createButton: { backgroundColor: '#00ff00', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginVertical: 30 },
  createButtonText: { color: '#000000', fontSize: 16, fontWeight: '700' },
  playlistItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#333333' },
  playlistItemActive: { borderColor: '#00ff00', backgroundColor: '#0a0a0a' },
  playlistInfo: { flex: 1 },
  playlistName: { color: '#00ff00', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  playlistSongs: { color: '#888888', fontSize: 14 },
  playlistActions: { flexDirection: 'row', alignItems: 'center' },
  deleteButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', marginLeft: 10, borderWidth: 1, borderColor: '#ff4444' },
  footer: { backgroundColor: '#0a0a0a', paddingVertical: 15, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  footerText: { color: '#888888', fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#1a1a1a', borderRadius: 15, padding: 25, marginHorizontal: 30, borderWidth: 1, borderColor: '#333333' },
  modalTitle: { color: '#00ff00', fontSize: 20, fontWeight: '700', marginBottom: 15, textAlign: 'center' },
  modalMessage: { color: '#888888', fontSize: 16, textAlign: 'center', marginBottom: 25, lineHeight: 22 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  cancelButton: { backgroundColor: '#333333', borderWidth: 1, borderColor: '#666666' },
  confirmButton: { backgroundColor: '#ff4444' },
  cancelButtonText: { color: '#888888', fontSize: 16, fontWeight: '600' },
  confirmButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 }
});

function formatTime(ms) { const totalSeconds = Math.floor((ms || 0) / 1000); const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0'); const seconds = (totalSeconds % 60).toString().padStart(2, '0'); return `${minutes}:${seconds}`; }
