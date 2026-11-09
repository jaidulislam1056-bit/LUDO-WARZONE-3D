import { useState } from 'react';
import { LogIn, UserCheck, Shield, Sparkles } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import {
  signInWithGooglePopup,
  loadOrCreatePlayerProfile,
  fetchMatchHistoryFromFirestore,
} from '../services/firebase';

export function FirstTimeAuthModal() {
  const {
    hasCompletedOnboarding,
    setHasCompletedOnboarding,
    isLoadingScreenActive,
    isAuthenticated,
    profile,
    setAuthenticatedProfile,
    setMatchHistory,
  } = useGameStore();

  const [callsign, setCallsign] = useState(profile.displayName || 'Commander');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Only display after loading screen finishes and when user hasn't onboarded and isn't authenticated
  if (isLoadingScreenActive || hasCompletedOnboarding || isAuthenticated) {
    return null;
  }

  const handleContinueAsGuest = () => {
    const cleanName = callsign.trim().slice(0, 30) || 'Commander Guest';
    useGameStore.getState().updateDisplayName(cleanName);
    setHasCompletedOnboarding(true);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGooglePopup();
      if (user) {
        const loaded = await loadOrCreatePlayerProfile(user, profile);
        setAuthenticatedProfile(loaded, true);
        const hist = await fetchMatchHistoryFromFirestore(user.uid);
        setMatchHistory(hist);
        setHasCompletedOnboarding(true);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed or cancelled:', err);
      setErrorMsg('গুগল সাইন-ইন সম্পন্ন হয়নি বা বাতিল করা হয়েছে। গেস্ট হিসেবে খেলতে পারেন।');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden animate-scaleUp text-center space-y-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-400/20 text-amber-400 border border-amber-400/40 mx-auto shadow-lg">
          <Shield className="w-7 h-7" />
        </div>

        <div>
          <h2
            className="text-xl sm:text-2xl font-black text-white tracking-wide"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            COMMANDER VERIFICATION
          </h2>
          <p className="text-xs text-sky-400 font-semibold mt-0.5">
            লুডু ওয়ারজোন ৩ডি ব্যাটেলফিল্ডে স্বাগতম!
          </p>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            গেমপ্লে শুরু করতে গেস্ট অ্যাকাউন্ট বেছে নিন অথবা গুগল ক্লাউডে প্রগ্রেস ও কয়েন সেভ রাখতে গুগল সাইন-ইন করুন।
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/40 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3 pt-2">
          {/* Option 1: Continue as Guest */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                অ্যাকাউন্ট ছাড়াই খেলুন (Guest)
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase">তাত্ক্ষণিক</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={25}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="আপনার নাম লিখুন"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleContinueAsGuest}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer shadow active:scale-95 transition-all"
              >
                গেস্ট হিসেবে প্রবেশ
              </button>
            </div>
          </div>

          {/* Option 2: Sign In with Google */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-sky-400" />
                গুগল ক্লাউড সাইন-ইন (Google Cloud)
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> ক্লাউড সেভ
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              আপনার কয়েন, এক্সপি (XP) এবং ম্যাচ হিস্ট্রি সব ডিভাইসে সুরক্ষিত রাখতে গুগল দিয়ে যুক্ত হোন।
            </p>
            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all"
            >
              <LogIn className="w-4 h-4" />
              {isSigningIn ? 'কানেক্টিং...' : 'গুগল দিয়ে সাইন-ইন করুন'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
