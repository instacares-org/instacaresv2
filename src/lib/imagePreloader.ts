// Image preloader utility for critical images
export class ImagePreloader {
  private static preloadedImages = new Set<string>();

  static preload(src: string, priority: 'high' | 'low' = 'low'): Promise<void> {
    return new Promise((resolve, reject) => {
      // Skip if already preloaded
      if (this.preloadedImages.has(src)) {
        resolve();
        return;
      }

      const img = new Image();
      
      img.onload = () => {
        this.preloadedImages.add(src);
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`));
      };

      // Set fetchpriority for better loading performance
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority;
      }
      
      img.src = src;
    });
  }

  static preloadMultiple(sources: string[], priority: 'high' | 'low' = 'low'): Promise<void[]> {
    return Promise.all(sources.map(src => this.preload(src, priority)));
  }

  static preloadCriticalImages(): void {
    // Preload logo
    this.preload('/logo.webp', 'high');
  }

  static isPreloaded(src: string): boolean {
    return this.preloadedImages.has(src);
  }

  static clear(): void {
    this.preloadedImages.clear();
  }
}

// Auto-preload critical images when module loads
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ImagePreloader.preloadCriticalImages();
    });
  } else {
    ImagePreloader.preloadCriticalImages();
  }
}