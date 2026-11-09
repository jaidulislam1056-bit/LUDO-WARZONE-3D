import { useEffect, useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';
import { GameLogo } from './GameLogo';
import { useGameStore } from '../store/useGameStore';

const LOADING_TIPS = [
  'টিপস: স্টার (Star) চিহ্নিত সেফ জোনে থাকলে শত্রু কমান্ডো আপনাকে গুলি করতে পারবে না।',
  'টিপস: স্কাই ওয়ারজোন (Sky Warzone) মোডে জেটপ্যাক দিয়ে আকাশে উড়ে শত্রু নিধন করুন!',
  'টিপস: একে-৪৭ রাইফেলের রেঞ্জ ৩টি সেল। সঠিক দূরত্ব বজায় রেখে ফায়ার করুন।',
  'টিপস: হোম বেস থেকে বের হতে ডাইসে ৬ ফেলতে হবে।',
  'টিপস: গ্রেনেড ছুড়ে শত্রুর একগুচ্ছ কমান্ডোকে একসাথে উড়িয়ে দিন!',
  'Tip: Star cells grant absolute immunity from enemy sniper and rifle fire.',
  'Tip: Switch to Shoulder TPS or Free 360° Cam to get the best shooting angle.',
];

export function LoadingScreen() {
  const { isLoadingScreenActive, setIsLoadingScreenActive } = useGameStore();
  const [progress, setProgress] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);
  const [loadingText, setLoadingText] = useState('Initializing Warzone 3D Engine...');

  useEffect(() => {
    if (!isLoadingScreenActive) return;

    // Cycle tips
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 2200);

    // Realistic progressive loading
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsLoadingScreenActive(false);
          }, 350);
          return 100;
        }

        const delta = Math.floor(Math.random() * 12) + 6;
        const next = Math.min(100, prev + delta);

        if (next < 25) {
          setLoadingText('Loading Sky Arena & 3D Islands...');
        } else if (next < 55) {
          setLoadingText('Rigging 16 Commando Humanoid Skeletons & Jetpacks...');
        } else if (next < 80) {
          setLoadingText('Calibrating AK-47 Ballistics & Sky Bird Flocks...');
        } else {
          setLoadingText('Connecting Authoritative Multiplayer Matrix...');
        }

        return next;
      });
    }, 120);

    return () => {
      clearInterval(interval);
      clearInterval(tipInterval);
    };
  }, [isLoadingScreenActive, setIsLoadingScreenActive]);

  if (!isLoadingScreenActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-between p-6 select-none animate-fadeIn">
      {/* Top Brand Tag */}
      <div className="flex items-center gap-2 pt-4 text-xs font-bold text-amber-400 uppercase tracking-widest">
        <Shield className="w-4 h-4 text-amber-400" />
        <span>Military 3D Tactical Ludo Arena</span>
      </div>

      {/* Center Cinematic Logo & Military Radar */}
      <div className="flex flex-col items-center text-center max-w-md w-full">
        <div className="transform scale-90 sm:scale-105 transition-transform duration-300">
          <GameLogo />
        </div>

        {/* Tactical Status Text */}
        <div className="mt-8 flex items-center gap-2 text-xs font-mono font-bold text-sky-400">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>{loadingText}</span>
        </div>

        {/* Futuristic Military Progress Bar */}
        <div className="mt-3 w-full bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-2xl">
          <div className="w-full h-3 bg-slate-950 rounded-lg overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-150 rounded-lg shadow-[0_0_12px_rgba(251,191,36,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Progress Percentage */}
        <div className="mt-2 flex items-center justify-between w-full text-xs font-mono text-slate-400">
          <span>INITIALIZING</span>
          <span className="text-amber-400 font-extrabold tabular-nums">{progress}%</span>
        </div>
      </div>

      {/* Bottom Tip Card */}
      <div className="max-w-lg w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-center shadow-xl">
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">
          <Sparkles className="w-3 h-3" />
          <span>Combat Intelligence</span>
        </div>
        <p className="text-xs text-slate-300 leading-snug font-medium">
          {LOADING_TIPS[currentTip]}
        </p>
      </div>
    </div>
  );
}
