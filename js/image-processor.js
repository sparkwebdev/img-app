/**
 * Image Processor — Canvas-based resize + iterative JPEG compression
 *
 * Usage:
 *   const { blob, width, height } = await ImageProcessor.process(file);
 *
 * Pipeline:
 *   1. Load file into Image via object URL
 *   2. Calculate target dimensions (longest edge capped at 2000px)
 *   3. Draw to canvas with high-quality smoothing
 *   4. Iterative JPEG compression until <= 1MB (or minimum quality floor)
 *   5. Return final JPEG Blob + dimensions
 */

window.ImageProcessor = {
  MAX_EDGE: 2000,
  TARGET_SIZE: 1 * 1024 * 1024, // 1MB
  INITIAL_QUALITY: 0.92,
  QUALITY_STEP: 0.05,
  MIN_QUALITY: 0.30,

  /**
   * Process a single image file.
   * @param {File} file - The image file to process
   * @returns {Promise<{blob: Blob, width: number, height: number, quality: number, warning: string|null}>}
   */
  process(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);

        try {
          // Calculate target dimensions
          const { width: targetW, height: targetH } = this._calcDimensions(
            img.naturalWidth,
            img.naturalHeight
          );

          // Draw to canvas
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context. Try closing other tabs to free memory.'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          // Iterative JPEG compression
          this._compress(canvas, targetW, targetH)
            .then(resolve)
            .catch(reject);

        } catch (err) {
          reject(new Error('Processing failed. Try closing other tabs to free memory.'));
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('This file could not be read as an image.'));
      };

      img.src = url;
    });
  },

  /**
   * Calculate target dimensions, capping longest edge at MAX_EDGE.
   */
  _calcDimensions(origW, origH) {
    const longest = Math.max(origW, origH);
    if (longest <= this.MAX_EDGE) {
      return { width: origW, height: origH };
    }

    const scale = this.MAX_EDGE / longest;
    return {
      width: Math.round(origW * scale),
      height: Math.round(origH * scale),
    };
  },

  /**
   * Iterative JPEG compression until blob is under TARGET_SIZE.
   */
  async _compress(canvas, width, height) {
    let quality = this.INITIAL_QUALITY;
    let blob = null;
    let warning = null;

    while (quality >= this.MIN_QUALITY) {
      blob = await this._canvasToBlob(canvas, quality);

      if (blob.size <= this.TARGET_SIZE) {
        return { blob, width, height, quality, warning: null };
      }

      quality -= this.QUALITY_STEP;
      quality = Math.round(quality * 100) / 100; // avoid float drift
    }

    // Final attempt at minimum quality
    blob = await this._canvasToBlob(canvas, this.MIN_QUALITY);

    if (blob.size > this.TARGET_SIZE) {
      warning = 'Image could not be compressed below 1MB at minimum quality. It has been saved at the smallest achievable size.';
    }

    return { blob, width, height, quality: this.MIN_QUALITY, warning };
  },

  /**
   * Promisified canvas.toBlob for JPEG.
   */
  _canvasToBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas compression failed. Try closing other tabs to free memory.'));
          }
        },
        'image/jpeg',
        quality
      );
    });
  },

  /**
   * Get image dimensions from a file (used during validation).
   * @param {File} file
   * @returns {Promise<{width: number, height: number}>}
   */
  getDimensions(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('This file could not be read as an image.'));
      };

      img.src = url;
    });
  }
};
