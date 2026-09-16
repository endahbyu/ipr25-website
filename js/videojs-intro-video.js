/**
 * Video.js Intro/Outro Video Plugin
 * Adds intro and outro video functionality to Video.js players
 * @version 1.0.0
 */

(function(window, videojs) {
  'use strict';

  const Plugin = videojs.getPlugin('plugin');

  class IntroOutroVideo extends Plugin {
    constructor(player, options) {
      super(player, options);

      this.options = videojs.obj.merge({
        intro_video: null,
        outro_video: null,
        intro_skippable: false,
        outro_skippable: false,
        intro_config: {
          skippable: false,
          skip_button_position: 'center',
          skip_button_color: 'rgba(0, 0, 0, 0.7)',
          skip_text_color: '#ffffff',
          skip_text: 'Skip'
        },
        outro_config: {
          skippable: false,
          skip_button_position: 'center',
          skip_button_color: 'rgba(0, 0, 0, 0.7)',
          skip_text_color: '#ffffff',
          skip_text: 'Skip'
        }
      }, options);

      // Merge intro_config and outro_config if provided
      if (options.intro_config) {
        this.options.intro_config = videojs.obj.merge(this.options.intro_config, options.intro_config);
      }
      if (options.outro_config) {
        this.options.outro_config = videojs.obj.merge(this.options.outro_config, options.outro_config);
      }

      // Support legacy intro_skippable and outro_skippable options
      if (options.intro_skippable !== undefined) {
        this.options.intro_config.skippable = options.intro_skippable;
      }
      if (options.outro_skippable !== undefined) {
        this.options.outro_config.skippable = options.outro_skippable;
      }

      this.player = player;
      this.mainVideoSources = null;
      this.currentPhase = 'intro'; // 'intro', 'main', 'outro'
      this.skipButton = null;
      this.hasIntro = !!this.options.intro_video;
      this.hasOutro = !!this.options.outro_video;
      this.mainVideoEnded = false;
      this.introReady = false;
      this.userInitiatedPlay = false;

      if (this.hasIntro || this.hasOutro) {
        this.initialize();
      }
    }

    initialize() {
      // Wait for player to be ready first, then store sources
      this.player.ready(() => {
        // Store the main video source/sources before we change them
        // Get the full source object to preserve type and other properties
        const currentSource = this.player.currentSource();
        const allSources = this.player.currentSources();

        if (allSources && allSources.length > 0) {
          this.mainVideoSources = allSources;
        } else if (currentSource && currentSource.src) {
          this.mainVideoSources = [currentSource];
        } else {
          // Fallback to currentSrc
          this.mainVideoSources = [{
            src: this.player.currentSrc(),
            type: this.getVideoType(this.player.currentSrc())
          }];
        }

        if (this.hasIntro) {
          // Set up intro video but don't play yet
          this.setupIntro();

          // Listen for play event to mark intro as ready
          this.player.one('play', () => {
            this.userInitiatedPlay = true;

            // Check if we're still on the intro or if something changed it
            if (this.currentPhase === 'intro' && this.player.currentSrc() !== this.options.intro_video) {
              this.player.pause();
              this.player.src({
                src: this.options.intro_video,
                type: this.getVideoType(this.options.intro_video)
              });
              this.player.play();
            }

            this.introReady = true;
          });
        }
      });

      // Listen for video ended event
      this.player.on('ended', () => {
        this.handleVideoEnded();
      });
    }

    setupIntro() {
      // Set intro video source without playing
      this.player.src({
        src: this.options.intro_video,
        type: this.getVideoType(this.options.intro_video)
      });

      // Add skip button if intro is skippable
      if (this.options.intro_config.skippable) {
        this.showSkipButton('intro', this.options.intro_config);
      }

      this.currentPhase = 'intro';
    }

    playIntro() {
      this.introReady = true;
      this.currentPhase = 'intro';

      // Intro is already set up, just play it
      this.player.play().catch(err => {
        console.warn('Intro video play failed:', err);
      });
    }

    playMainVideo() {
      this.currentPhase = 'main';
      this.removeSkipButton();

      // Set main video source(s)
      if (this.mainVideoSources && this.mainVideoSources.length > 0) {
        this.player.src(this.mainVideoSources);
      }

      // Play main video
      this.player.play().catch(err => {
        console.warn('Main video autoplay failed:', err);
      });
    }

    playOutro() {
      this.currentPhase = 'outro';

      // Set outro video source
      this.player.src({
        src: this.options.outro_video,
        type: this.getVideoType(this.options.outro_video)
      });

      // Add skip button if outro is skippable
      if (this.options.outro_config.skippable) {
        this.showSkipButton('outro', this.options.outro_config);
      }

      // Play outro
      this.player.play().catch(err => {
        console.warn('Outro video autoplay failed:', err);
      });
    }

    handleVideoEnded() {
      if (this.currentPhase === 'intro') {
        // Intro ended, play main video
        this.playMainVideo();
      } else if (this.currentPhase === 'main' && this.hasOutro) {
        // Main video ended, play outro
        this.mainVideoEnded = true;
        this.playOutro();
      } else if (this.currentPhase === 'outro') {
        // Outro ended, remove skip button
        this.removeSkipButton();
      }
    }

    showSkipButton(phase, config) {
      // Remove existing skip button if any
      this.removeSkipButton();

      // Get config from parameters or use defaults
      const buttonConfig = config || {
        skip_button_position: 'center',
        skip_button_color: 'rgba(0, 0, 0, 0.7)',
        skip_text_color: '#ffffff',
        skip_text: 'Skip'
      };

      // Create skip button
      this.skipButton = videojs.dom.createEl('button', {
        className: 'vjs-intro-outro-skip-button vjs-skip-button-' + buttonConfig.skip_button_position,
        innerHTML: buttonConfig.skip_text || 'Skip'
      });

      // Apply custom colors via inline styles
      this.skipButton.style.backgroundColor = buttonConfig.skip_button_color || 'rgba(0, 0, 0, 0.7)';
      this.skipButton.style.color = buttonConfig.skip_text_color || '#ffffff';

      // Add click handler
      this.skipButton.addEventListener('click', () => {
        this.handleSkip();
      });

      // Add to player
      this.player.el().appendChild(this.skipButton);
    }

    removeSkipButton() {
      if (this.skipButton && this.skipButton.parentNode) {
        this.skipButton.parentNode.removeChild(this.skipButton);
        this.skipButton = null;
      }
    }

    handleSkip() {
      if (this.currentPhase === 'intro') {
        // Skip intro and play main video
        this.player.pause();
        this.playMainVideo();
      } else if (this.currentPhase === 'outro') {
        // Skip outro and end playback
        this.player.pause();
        this.removeSkipButton();
        // Trigger ended event for any listeners
        this.player.trigger('ended');
      }
    }

    getVideoType(src) {
      if (!src) return '';

      const extension = src.split('.').pop().toLowerCase().split('?')[0];
      const typeMap = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'ogv': 'video/ogg',
        'ogg': 'video/ogg',
        'm3u8': 'application/x-mpegURL',
        'mpd': 'application/dash+xml'
      };

      return typeMap[extension] || 'video/mp4';
    }

    dispose() {
      this.removeSkipButton();
      super.dispose();
    }
  }

  // Register the plugin with Video.js
  videojs.registerPlugin('introOutroVideo', IntroOutroVideo);

})(window, window.videojs);
