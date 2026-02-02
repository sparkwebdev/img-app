/**
 * Art Walk Weekends – Image Preparation Tool
 * Alpine.js application component
 */

function imageApp() {
  return {
    // ---- Step state ----
    currentStep: 'landing',

    // ---- Artist name ----
    artistName: '',
    artistNameError: '',
    artistNameConfirmed: false,

    // ---- 5 image slots ----
    slots: [
      { id: 1, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
      { id: 2, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
      { id: 3, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
      { id: 4, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
      { id: 5, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
    ],

    // ---- Processing state ----
    isProcessing: false,
    processingProgress: 0,
    processingCurrent: 0,

    // ---- UI state ----
    isDragging: false,
    excessMessage: '',
    replaceSlotIndex: null,
    srAnnouncement: '',


    // ========================
    // Getters (computed-like)
    // ========================

    get sanitizedName() {
      return this.artistName
        .trim()
        .toLowerCase()
        .replace(/['']/g, '')           // remove apostrophes/smart quotes
        .replace(/[^a-z0-9\s-]/g, '')  // strip special chars
        .replace(/\s+/g, '-')           // spaces to hyphens
        .replace(/-+/g, '-')            // collapse multiple hyphens
        .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
    },

    /**
     * Build filename for a given slot index.
     */
    filename(index) {
      return this.sanitizedName + '-' + (index + 1) + '.jpg';
    },

    get emptySlotCount() {
      return this.slots.filter(s => s.status === 'empty').length;
    },

    get allSlotsValid() {
      return this.slots.every(s => s.status === 'valid');
    },

    get allSlotsDone() {
      return this.slots.every(s => s.status === 'done');
    },

    // ========================
    // Lifecycle
    // ========================

    init() {
      // Warn before leaving once work has started
      window.addEventListener('beforeunload', (e) => {
        if (this.currentStep !== 'landing') {
          e.preventDefault();
        }
      });

      // Focus management on step changes
      this.$watch('currentStep', (step) => {
        this.$nextTick(() => {
          const refMap = {
            landing: 'landingHeading',
            name: 'nameHeading',
            upload: 'uploadHeading',
            results: 'resultsHeading',
          };
          const ref = this.$refs[refMap[step]];
          if (ref) {
            ref.setAttribute('tabindex', '-1');
            ref.focus();
          }
        });
      });
    },

    // ========================
    // Navigation
    // ========================

    goToStep(step) {
      this.currentStep = step;
    },

    // ========================
    // Step 2: Artist Name
    // ========================

    confirmName() {
      const trimmed = this.artistName.trim();
      if (!trimmed) {
        this.artistNameError = 'Please enter your name.';
        return;
      }
      if (this.sanitizedName.length < 2) {
        this.artistNameError = 'Name must be at least 2 characters.';
        return;
      }
      this.artistNameError = '';
      this.artistNameConfirmed = true;
      this.announce('Name confirmed: ' + this.sanitizedName);
      this.goToStep('upload');
    },

    // ========================
    // Step 3: File handling
    // ========================

    /**
     * Handle files from drop zone or file input (potentially multiple).
     */
    async handleFiles(fileList) {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const emptyIndices = [];

      // Find empty slots
      this.slots.forEach((slot, i) => {
        if (slot.status === 'empty') emptyIndices.push(i);
      });

      if (emptyIndices.length === 0) {
        this.excessMessage = 'All slots are filled. Remove an image first.';
        return;
      }

      const toAssign = files.slice(0, emptyIndices.length);
      const excess = files.length - toAssign.length;

      if (excess > 0) {
        this.excessMessage = excess + ' file' + (excess > 1 ? 's were' : ' was') + ' skipped (no empty slots remaining).';
      } else {
        this.excessMessage = '';
      }

      // Assign files to empty slots sequentially
      for (let i = 0; i < toAssign.length; i++) {
        await this.assignFileToSlot(emptyIndices[i], toAssign[i]);
      }
    },

    /**
     * Check if a file is HEIC/HEIF based on type or extension.
     */
    _isHeic(file) {
      if (file.type === 'image/heic' || file.type === 'image/heif') return true;
      // Some browsers leave type empty for HEIC — check extension
      const name = file.name.toLowerCase();
      return name.endsWith('.heic') || name.endsWith('.heif');
    },

    /**
     * Lazy-load the heic-to library on first use.
     */
    _heicLoaded: false,
    async _loadHeicLib() {
      if (this._heicLoaded || typeof HeicTo !== 'undefined') {
        this._heicLoaded = true;
        return;
      }
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/heic-to@1.3.0/dist/iife/heic-to.js';
        script.onload = () => { this._heicLoaded = true; resolve(); };
        script.onerror = () => reject(new Error('Could not load HEIC support. Please convert to JPG or PNG first.'));
        document.head.appendChild(script);
      });
    },

    /**
     * Convert a HEIC/HEIF file to a JPEG File object using heic-to.
     */
    async _convertHeic(file) {
      await this._loadHeicLib();
      if (typeof HeicTo === 'undefined') {
        throw new Error('HEIC support is not available. Please convert to JPG or PNG first.');
      }
      try {
        const jpegBlob = await HeicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
        const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
        return new File([jpegBlob], newName, { type: 'image/jpeg' });
      } catch (err) {
        console.error('heic-to error:', err);
        throw new Error('Could not convert HEIC file. Please convert to JPG or PNG first.');
      }
    },

    /**
     * Validate and assign a single file to a specific slot.
     */
    async assignFileToSlot(index, file) {
      const slot = this.slots[index];
      this._clearSlot(index);

      slot.status = 'validating';

      try {
        // Check for duplicate file (same name + size already in another slot)
        const isDuplicate = this.slots.some((s, i) =>
          i !== index && s.originalFile &&
          s.originalFile.name === file.name && s.originalFile.size === file.size
        );
        if (isDuplicate) {
          throw new Error('This file has already been added.');
        }

        slot.originalFile = file;

        // Check file size (10MB max for all formats)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
          throw new Error('File is too large (' + sizeMB + 'MB). Maximum is 10MB.');
        }

        // Convert HEIC to JPEG before remaining validation
        let workingFile = file;
        if (this._isHeic(file)) {
          workingFile = await this._convertHeic(file);
        }

        slot.file = workingFile;
        slot.originalUrl = URL.createObjectURL(workingFile);

        await this.validateFile(workingFile);
        slot.status = 'valid';
        slot.error = null;
        this.announce('Image ' + (index + 1) + ' accepted.');
      } catch (err) {
        slot.status = 'error';
        slot.error = err.message;
        if (slot.originalUrl) {
          URL.revokeObjectURL(slot.originalUrl);
          slot.originalUrl = null;
        }
        slot.file = null;
        slot.originalFile = null;
        this.announce('Image ' + (index + 1) + ' error: ' + err.message);
      }
    },

    /**
     * Validate file type, size, and dimensions.
     */
    async validateFile(file) {
      // 1. File type (HEIC already converted to JPEG before reaching here)
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Only JPG, PNG, WebP, and HEIC files are accepted.');
      }

      // 2. Dimensions (longest edge >= 1500px)
      let dims;
      try {
        dims = await ImageProcessor.getDimensions(file);
      } catch {
        throw new Error('This file could not be read as an image.');
      }

      const longest = Math.max(dims.width, dims.height);
      if (longest < 1500) {
        throw new Error('Image is too small (' + longest + 'px). Minimum 1500px on longest edge.');
      }
    },

    /**
     * Click handler for an individual empty slot.
     */
    uploadToSlot(index) {
      if (this.slots[index].status !== 'empty') return;
      this.replaceSlotIndex = index;
      this.$refs.slotFileInput.click();
    },

    /**
     * Clear a valid slot so the user can re-upload.
     */
    clearSlot(index) {
      this._clearSlot(index);
      this.announce('Image ' + (index + 1) + ' removed.');
    },

    /**
     * Open a file picker to replace a specific error slot.
     */
    reUploadSlot(index) {
      this.replaceSlotIndex = index;
      this.$refs.slotFileInput.click();
    },

    /**
     * Handle file selected for slot replacement.
     */
    async handleSlotReplace(fileList) {
      if (!fileList || fileList.length === 0 || this.replaceSlotIndex === null) return;
      const file = fileList[0];
      const index = this.replaceSlotIndex;
      this.replaceSlotIndex = null;
      await this.assignFileToSlot(index, file);
    },

    // ========================
    // Step 3→4: Processing
    // ========================

    async processAllImages() {
      if (!this.allSlotsValid || this.isProcessing) return;

      this.isProcessing = true;
      this.processingProgress = 0;
      this.processingCurrent = 0;

      this.announce('Starting image processing.');

      // Process sequentially to limit memory usage
      for (let i = 0; i < this.slots.length; i++) {
        this.processingCurrent = i + 1;
        this.processingProgress = Math.round((i / this.slots.length) * 100);
        this.slots[i].status = 'processing';

        try {
          const result = await ImageProcessor.process(this.slots[i].file);
          this.slots[i].processedBlob = result.blob;
          this.slots[i].processedUrl = URL.createObjectURL(result.blob);
          this.slots[i].status = 'done';

          if (result.warning) {
            // Note: we still mark as done, but could display warning
            console.warn('Slot ' + (i + 1) + ': ' + result.warning);
          }
        } catch (err) {
          this.slots[i].status = 'error';
          this.slots[i].error = err.message || 'Processing failed.';
          this.isProcessing = false;
          this.announce('Error processing image ' + (i + 1) + '. Please try again.');
          return;
        }
      }

      this.processingProgress = 100;
      this.isProcessing = false;
      this.announce('All images processed successfully.');

      // Small delay then go to results
      setTimeout(() => {
        this.goToStep('results');
      }, 400);
    },

    // ========================
    // Step 4: Downloads
    // ========================

    downloadSingle(index) {
      const slot = this.slots[index];
      if (!slot.processedBlob || !slot.processedUrl) return;
      this._fallbackDownload(slot.processedUrl, this.filename(index));
    },

    async downloadAll() {
      this.announce('Downloading all images.');
      for (let i = 0; i < this.slots.length; i++) {
        this.downloadSingle(i);
        // Stagger downloads so browsers don't block them
        if (i < this.slots.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    },

    /**
     * Fallback download using <a> element.
     */
    _fallbackDownload(url, filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },

    // ========================
    // Reset
    // ========================

    resetApp() {
      // Revoke all object URLs
      this.slots.forEach(slot => {
        if (slot.originalUrl) URL.revokeObjectURL(slot.originalUrl);
        if (slot.processedUrl) URL.revokeObjectURL(slot.processedUrl);
      });

      // Reset slots
      this.slots = [
        { id: 1, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
        { id: 2, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
        { id: 3, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
        { id: 4, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
        { id: 5, status: 'empty', file: null, originalFile: null, originalUrl: null, error: null, processedBlob: null, processedUrl: null },
      ];

      // Reset state
      this.artistName = '';
      this.artistNameError = '';
      this.artistNameConfirmed = false;
      this.isProcessing = false;
      this.processingProgress = 0;
      this.processingCurrent = 0;
      this.isDragging = false;
      this.excessMessage = '';
      this.replaceSlotIndex = null;
      this.announce('Application reset. Starting over.');
      this.goToStep('landing');
    },

    // ========================
    // Helpers
    // ========================

    /**
     * Clear a single slot's data and revoke URLs.
     */
    _clearSlot(index) {
      const slot = this.slots[index];
      if (slot.originalUrl) URL.revokeObjectURL(slot.originalUrl);
      if (slot.processedUrl) URL.revokeObjectURL(slot.processedUrl);
      slot.status = 'empty';
      slot.file = null;
      slot.originalFile = null;
      slot.originalUrl = null;
      slot.error = null;
      slot.processedBlob = null;
      slot.processedUrl = null;
    },

    /**
     * Format bytes to human-readable string.
     */
    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },

    /**
     * Screen reader announcement helper.
     */
    announce(message) {
      this.srAnnouncement = '';
      // Small delay to ensure aria-live picks up the change
      setTimeout(() => {
        this.srAnnouncement = message;
      }, 50);
    },
  };
}
