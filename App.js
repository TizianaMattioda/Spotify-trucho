import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

const LOCAL_ASSET = require('./assets/megalovania.mp3');

export default function App() {
  const soundRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useLocal, setUseLocal] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isBuffering, setIsBuffering] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);

  const remoteSource = {
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  };

  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      shouldDuckAndroid: true,
    });

    // Preload initial source to avoid long first-play latency
    preloadCurrentSource();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  async function preloadCurrentSource() {
    try {
      await unloadCurrent();
      const source = useLocal ? LOCAL_ASSET : remoteSource;
      setIsBuffering(true);
      const { sound, status } = await Audio.Sound.createAsync(source, { volume, shouldPlay: false }, onStatusUpdate);
      soundRef.current = sound;
      setIsLoaded(true);
      if (status && status.isLoaded) {
        setDurationMs(status.durationMillis ?? 0);
        setPositionMs(status.positionMillis ?? 0);
      }
    } finally {
      setIsBuffering(false);
    }
  }

  function onStatusUpdate(status) {
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
  }

  async function unloadCurrent() {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setIsLoaded(false);
    setIsPlaying(false);
  }

  async function loadAsync() {
    if (isLoaded) return;
    const source = useLocal ? LOCAL_ASSET : remoteSource;
    setIsBuffering(true);
    const { sound, status } = await Audio.Sound.createAsync(source, { volume }, onStatusUpdate);
    soundRef.current = sound;
    setIsLoaded(true);
    if (status && status.isLoaded) {
      setDurationMs(status.durationMillis ?? 0);
      setPositionMs(status.positionMillis ?? 0);
    }
    setIsBuffering(false);
  }

  async function playAsync() {
    if (!isLoaded) await loadAsync();
    if (!soundRef.current) return;
    await soundRef.current.playAsync();
  }

  async function pauseAsync() {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
  }

  async function stopAsync() {
    if (!soundRef.current) return;
    await soundRef.current.stopAsync();
    await soundRef.current.setPositionAsync(0);
  }

  async function unloadAndSwitchSource(toLocal) {
    await unloadCurrent();
    setUseLocal(toLocal);
    await preloadCurrentSource();
  }

  async function changeVolume(delta) {
    const next = Math.min(1, Math.max(0, Number((volume + delta).toFixed(2))));
    setVolume(next);
    if (soundRef.current) {
      await soundRef.current.setVolumeAsync(next);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reproductor básico (Expo AV)</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, useLocal && styles.toggleActive]}
          onPress={() => unloadAndSwitchSource(true)}
        >
          <Text style={styles.toggleText}>Local</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !useLocal && styles.toggleActive]}
          onPress={() => unloadAndSwitchSource(false)}
        >
          <Text style={styles.toggleText}>Remoto</Text>
        </TouchableOpacity>
      </View>

      {/* Main play/pause control */}
      <View style={styles.mainControlRow}>
        <TouchableOpacity
          style={[styles.roundButton, (isBuffering) && styles.buttonDisabled]}
          onPress={isPlaying ? pauseAsync : playAsync}
          disabled={isBuffering}
        >
          {isBuffering ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={36} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

      {/* Secondary controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.iconButton} onPress={stopAsync}>
          <Ionicons name="stop" size={22} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => changeVolume(-0.1)}>
          <Ionicons name="volume-medium" size={22} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={() => changeVolume(0.1)}>
          <Ionicons name="volume-high" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.info}>Fuente: {useLocal ? 'Archivo local (assets/megalovania.mp3)' : 'URL remota (SoundHelix)'}</Text>
      <Text style={styles.info}>
        {formatTime(positionMs)} / {formatTime(durationMs)}
      </Text>
      <View style={styles.volumeRow}>
        <Text style={styles.volumeText}>Volumen: {(volume * 100).toFixed(0)}%</Text>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f12',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: '#2a2a35',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#17171c',
    marginHorizontal: 6,
  },
  toggleActive: {
    backgroundColor: '#2b2b38',
    borderColor: '#5b5bd6',
  },
  toggleText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  iconButton: {
    backgroundColor: '#3e3e9b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  info: {
    color: '#c9c9d3',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  volumeText: {
    color: '#ffffff',
    fontWeight: '600',
    marginHorizontal: 6,
  },
  mainControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  roundButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#5b5bd6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

function formatTime(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
