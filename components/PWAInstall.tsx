"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import { haptic } from "../lib/haptics";

export function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone
      || document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for Chrome's install prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandaloneMode) setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If iOS and not standalone, show the button
    if (isIOSDevice && !isStandaloneMode) {
      setIsVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [isStandalone]);

  const handleInstallClick = async () => {
    haptic.medium();
    if (isIOS) {
      setShowIOSGuide(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsVisible(false);
      }
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <>
      <div className="mb-6">
        <Button
          variant="primary"
          className="w-full bg-felt-bright border border-white/10 text-white shadow-lg py-4 group"
          onClick={handleInstallClick}
        >
          <span className="mr-2">📲</span>
          Install Pool Tracker App
          <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
        </Button>
      </div>

      <AnimatePresence>
        {showIOSGuide && (
          <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIOSGuide(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Guide Card */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-ink p-6 shadow-2xl"
            >
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-3xl">
                  🎱
                </div>
                <h3 className="font-[var(--font-display)] text-2xl tracking-wider text-white">
                  Add to Home Screen
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  Install this app on your iPhone for the best experience.
                </p>

                <div className="mt-8 space-y-6 text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">1</div>
                    <p className="text-sm text-white/80">Tap the **Share** icon (the square with an arrow) in your browser's toolbar.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">2</div>
                    <p className="text-sm text-white/80">Scroll down and tap <span className="font-bold text-white italic text-xs ml-1">"Add to Home Screen"</span></p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="mt-8 w-full py-4"
                  onClick={() => setShowIOSGuide(false)}
                >
                  Got it
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
