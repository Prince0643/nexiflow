/**
 * Sound Manager for handling notification sounds with proper throttling and visibility checks
 */

class SoundManager {
  private static instance: SoundManager;
  private soundEnabled: boolean = true;
  private lastSoundTime: number = 0;
  private soundCooldown: number = 300; // 300ms cooldown for more responsive sounds
  private pendingSounds: NodeJS.Timeout[] = [];
  private userInteracted: boolean = false;
  private audioContext: AudioContext | null = null;

  private constructor() {
    // Load sound preference from localStorage
    this.soundEnabled = localStorage.getItem('soundNotifications') !== 'false';
    
    // Listen for changes to sound preference
    window.addEventListener('storage', (e) => {
      if (e.key === 'soundNotifications') {
        this.soundEnabled = e.newValue !== 'false';
      }
    });
  }

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Play a notification sound if conditions are met
   */
  playNotificationSound(): void {
    // Check if sounds are enabled
    if (!this.soundEnabled) return;
    
    // Check cooldown period
    const now = Date.now();
    if (now - this.lastSoundTime < this.soundCooldown) {
      // Schedule sound to play after cooldown
      const delay = this.soundCooldown - (now - this.lastSoundTime);
      const timeoutId = setTimeout(() => {
        this.playSound();
        this.lastSoundTime = Date.now();
        // Remove from pending sounds
        this.pendingSounds = this.pendingSounds.filter(id => id !== timeoutId);
      }, delay);
      
      this.pendingSounds.push(timeoutId);
      return;
    }
    
    // Play sound immediately
    this.playSound();
    this.lastSoundTime = now;
  }

  /**
   * Play a specific sound for mention notifications
   */
  playMentionSound(): void {
    console.log('Attempting to play mention sound');
    console.log('Sound enabled:', this.soundEnabled);
    console.log('Document hidden:', document.hidden);
    console.log('User interacted:', this.userInteracted);
    
    // Check if sounds are enabled
    if (!this.soundEnabled) {
      console.log('Sound is disabled, not playing');
      return;
    }
    
    // Check cooldown period
    const now = Date.now();
    if (now - this.lastSoundTime < this.soundCooldown) {
      console.log('In cooldown period, scheduling sound');
      // Schedule sound to play after cooldown
      const delay = this.soundCooldown - (now - this.lastSoundTime);
      const timeoutId = setTimeout(() => {
        this.playMentionSoundEffect();
        this.lastSoundTime = Date.now();
        // Remove from pending sounds
        this.pendingSounds = this.pendingSounds.filter(id => id !== timeoutId);
      }, delay);
      
      this.pendingSounds.push(timeoutId);
      return;
    }
    
    // Play sound immediately
    console.log('Playing mention sound immediately');
    this.playMentionSoundEffect();
    this.lastSoundTime = now;
  }

  /**
   * Play a sound when user sends a message
   */
  playMessageSentSound(): void {
    // For sent messages, we still want to play sound even with cooldown
    // But respect sound settings
    if (!this.soundEnabled) return;
    
    this.playClickSound();
  }

  /**
   * Play a sound for incoming messages (not sent by the current user)
   */
  playMessageReceivedSound(): void {
    // Check if sounds are enabled
    if (!this.soundEnabled) return;
    
    // Check cooldown period
    const now = Date.now();
    if (now - this.lastSoundTime < this.soundCooldown) {
      // Schedule sound to play after cooldown
      const delay = this.soundCooldown - (now - this.lastSoundTime);
      const timeoutId = setTimeout(() => {
        this.playMessageReceivedSoundEffect();
        this.lastSoundTime = Date.now();
        // Remove from pending sounds
        this.pendingSounds = this.pendingSounds.filter(id => id !== timeoutId);
      }, delay);
      
      this.pendingSounds.push(timeoutId);
      return;
    }
    
    // Play sound immediately
    this.playMessageReceivedSoundEffect();
    this.lastSoundTime = now;
  }

  /**
   * Update sound enabled status
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    localStorage.setItem('soundNotifications', enabled.toString());
  }

  /**
   * Register user interaction to allow sound playback
   */
  registerUserInteraction(): void {
    console.log('User interaction registered');
    this.userInteracted = true;
    // Resume audio context if it exists
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        console.log('Audio context resumed');
      }).catch((error) => {
        console.error('Failed to resume audio context:', error);
      });
    }
  }

  /**
   * Clear all pending sounds
   */
  clearPendingSounds(): void {
    this.pendingSounds.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingSounds = [];
  }

  /**
   * Check if sound is enabled
   */
  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  /**
   * Get user interaction status
   */
  hasUserInteracted(): boolean {
    return this.userInteracted;
  }

  /**
   * Private method to play the main notification sound
   */
  private playSound(): void {
    try {
      // Create audio context if needed
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      
      // Try to resume audio context - this might work even without explicit user interaction
      // in some browsers or situations
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('Audio context resumed for notification sound');
          this.playSoundInternal();
        }).catch((error) => {
          console.error('Failed to resume audio context for notification sound:', error);
          // Still try to play the sound even if we can't resume
          this.playSoundInternal();
        });
        return;
      }
      
      this.playSoundInternal();
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  }

  /**
   * Internal method to play the main notification sound
   */
  private playSoundInternal(): void {
    try {
      // Create multiple oscillators for a richer sound
      const oscillator1 = this.audioContext!.createOscillator();
      const oscillator2 = this.audioContext!.createOscillator();
      const gainNode1 = this.audioContext!.createGain();
      const gainNode2 = this.audioContext!.createGain();
      const masterGain = this.audioContext!.createGain();
      
      // Connect oscillators to gain nodes
      oscillator1.connect(gainNode1);
      oscillator2.connect(gainNode2);
      
      // Connect gain nodes to master gain
      gainNode1.connect(masterGain);
      gainNode2.connect(masterGain);
      
      // Connect master gain to destination
      masterGain.connect(this.audioContext!.destination);
      
      // Configure the first oscillator (main tone)
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(880, this.audioContext!.currentTime); // A5 note
      gainNode1.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.4);
      
      // Configure the second oscillator (harmonic)
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1320, this.audioContext!.currentTime); // E6 note (fifth above A5)
      gainNode2.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.005, this.audioContext!.currentTime + 0.4);
      
      // Configure master gain for overall volume control
      masterGain.gain.setValueAtTime(0.8, this.audioContext!.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.4);
      
      // Start oscillators
      oscillator1.start(this.audioContext!.currentTime);
      oscillator2.start(this.audioContext!.currentTime);
      
      // Stop oscillators after duration
      oscillator1.stop(this.audioContext!.currentTime + 0.4);
      oscillator2.stop(this.audioContext!.currentTime + 0.4);
      
      // Clean up resources
      oscillator1.addEventListener('ended', () => {
        oscillator1.disconnect();
        oscillator2.disconnect();
        gainNode1.disconnect();
        gainNode2.disconnect();
        masterGain.disconnect();
      });
    } catch (error) {
      console.error('Failed to play notification sound internally:', error);
    }
  }

  /**
   * Private method to play a distinctive sound for mention notifications
   */
  private playMentionSoundEffect(): void {
    try {
      console.log('Playing mention sound effect');
      
      // Create audio context if needed
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
        console.log('Created new audio context');
      }
      
      // Try to resume audio context - this might work even without explicit user interaction
      // in some browsers or situations
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('Audio context resumed for mention sound');
          this.playMentionSoundEffectInternal();
        }).catch((error) => {
          console.error('Failed to resume audio context for mention sound:', error);
          // Still try to play the sound even if we can't resume
          this.playMentionSoundEffectInternal();
        });
        return;
      }
      
      this.playMentionSoundEffectInternal();
    } catch (error) {
      console.error('Failed to play mention sound:', error);
    }
  }

  /**
   * Internal method to play a distinctive sound for mention notifications
   */
  private playMentionSoundEffectInternal(): void {
    try {
      console.log('Audio context state:', this.audioContext!.state);
      
      // Create multiple oscillators for a chime-like sound
      const oscillator1 = this.audioContext!.createOscillator();
      const oscillator2 = this.audioContext!.createOscillator();
      const gainNode1 = this.audioContext!.createGain();
      const gainNode2 = this.audioContext!.createGain();
      const masterGain = this.audioContext!.createGain();
      
      // Connect oscillators to gain nodes
      oscillator1.connect(gainNode1);
      oscillator2.connect(gainNode2);
      
      // Connect gain nodes to master gain
      gainNode1.connect(masterGain);
      gainNode2.connect(masterGain);
      
      // Connect master gain to destination
      masterGain.connect(this.audioContext!.destination);
      
      // Configure the first oscillator (main chime)
      oscillator1.type = 'sine';
      oscillator1.frequency.setValueAtTime(1046.50, this.audioContext!.currentTime); // C6 note
      gainNode1.gain.setValueAtTime(0.3, this.audioContext!.currentTime);
      gainNode1.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.5);
      
      // Configure the second oscillator (harmonic)
      oscillator2.type = 'sine';
      oscillator2.frequency.setValueAtTime(1318.51, this.audioContext!.currentTime); // E6 note
      gainNode2.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.005, this.audioContext!.currentTime + 0.5);
      
      // Configure master gain for overall volume control
      masterGain.gain.setValueAtTime(0.7, this.audioContext!.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + 0.5);
      
      // Start oscillators
      oscillator1.start(this.audioContext!.currentTime);
      oscillator2.start(this.audioContext!.currentTime);
      
      // Stop oscillators after duration
      oscillator1.stop(this.audioContext!.currentTime + 0.5);
      oscillator2.stop(this.audioContext!.currentTime + 0.5);
      
      // Clean up resources
      oscillator1.addEventListener('ended', () => {
        oscillator1.disconnect();
        oscillator2.disconnect();
        gainNode1.disconnect();
        gainNode2.disconnect();
        masterGain.disconnect();
        console.log('Mention sound effect completed');
      });
      
      console.log('Mention sound effect started');
    } catch (error) {
      console.error('Failed to play mention sound internally:', error);
    }
  }

  /**
   * Private method to play the click sound for sent messages
   */
  private playClickSound(): void {
    try {
      // Create audio context if needed
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      
      // Try to resume audio context - this might work even without explicit user interaction
      // in some browsers or situations
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('Audio context resumed for click sound');
          this.playClickSoundInternal();
        }).catch((error) => {
          console.error('Failed to resume audio context for click sound:', error);
          // Still try to play the sound even if we can't resume
          this.playClickSoundInternal();
        });
        return;
      }
      
      this.playClickSoundInternal();
    } catch (error) {
      console.error('Failed to play click sound:', error);
    }
  }

  /**
   * Internal method to play the click sound for sent messages
   */
  private playClickSoundInternal(): void {
    try {
      // Create oscillator for a subtle click sound
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      // Connect oscillator to gain node and then to destination
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      // Configure the oscillator for a short click
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, this.audioContext!.currentTime);
      gainNode.gain.setValueAtTime(0.1, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.1);
      
      // Start and stop oscillator
      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + 0.1);
      
      // Clean up resources
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        gainNode.disconnect();
      });
    } catch (error) {
      console.error('Failed to play click sound internally:', error);
    }
  }

  /**
   * Private method to play a sound for incoming messages
   */
  private playMessageReceivedSoundEffect(): void {
    try {
      // Create audio context if needed
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }
      
      // Try to resume audio context - this might work even without explicit user interaction
      // in some browsers or situations
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log('Audio context resumed for message received sound');
          this.playMessageReceivedSoundEffectInternal();
        }).catch((error) => {
          console.error('Failed to resume audio context for message received sound:', error);
          // Still try to play the sound even if we can't resume
          this.playMessageReceivedSoundEffectInternal();
        });
        return;
      }
      
      this.playMessageReceivedSoundEffectInternal();
    } catch (error) {
      console.error('Failed to play message received sound:', error);
    }
  }

  /**
   * Internal method to play a sound for incoming messages
   */
  private playMessageReceivedSoundEffectInternal(): void {
    try {
      // Create oscillator for a gentle ping sound
      const oscillator = this.audioContext!.createOscillator();
      const gainNode = this.audioContext!.createGain();
      
      // Connect oscillator to gain node and then to destination
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);
      
      // Configure the oscillator for a gentle ping
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(700, this.audioContext!.currentTime); // Higher pitch
      gainNode.gain.setValueAtTime(0.2, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + 0.3);
      
      // Start and stop oscillator
      oscillator.start(this.audioContext!.currentTime);
      oscillator.stop(this.audioContext!.currentTime + 0.3);
      
      // Clean up resources
      oscillator.addEventListener('ended', () => {
        oscillator.disconnect();
        gainNode.disconnect();
      });
    } catch (error) {
      console.error('Failed to play message received sound internally:', error);
    }
  }
}

export const soundManager = SoundManager.getInstance();