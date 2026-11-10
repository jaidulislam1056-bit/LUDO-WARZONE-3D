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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="max-w-md w-full bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-scaleUp text-center space-y-4">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40 mx-auto shadow-lg">
          <Shield className="w-6 h-6" />
        </div>

        <div>
          <h2
            className="text-lg sm:text-2xl font-black text-white tracking-wide"
            style={{ fontFamily: "'Chakra Petch', sans-serif" }}
          >
            COMMANDER VERIFICATION
          </h2>
          <p className="text-xs text-sky-400 font-semibold mt-0.5">
            লুডু ওয়ারজোন ৩ডি ব্যাটেলফিল্ডে স্বাগতম!
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 mt-1 leading-relaxed">
            গুগল ক্লাউডে আপনার এক্সপি (XP), কয়েন ও আনলক করা আইটেম সেভ রাখতে গুগল সাইন-ইন করুন, অথবা অফলাইনে খেলুন।
          </p>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-500/40 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <div className="space-y-3 pt-1">
          {/* PRIMARY OPTION 1 (ON TOP): GOOGLE SIGN-IN WITH OFFICIAL LOGO */}
          <div className="p-4 rounded-xl bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-sky-500/40 text-left space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Official Google G Logo */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span className="text-xs font-bold text-white tracking-wide">
                  Google Cloud Account
                </span>
              </div>
              <span className="text-[10px] text-amber-400 font-extrabold uppercase flex items-center gap-1 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                <Sparkles className="w-3 h-3" /> Recommended
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-normal">
              আপনার কয়েন, এক্সপি (XP), পোশাক (Outfits), গান স্কিন ও ম্যাচ হিস্ট্রি ক্লাউডে সংরক্ষিত থাকবে।
            </p>

            <button
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-98 transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{isSigningIn ? 'Connecting Google Cloud...' : 'Sign in with Google'}</span>
            </button>
          </div>

          {/* SECONDARY OPTION 2 (UNDERNEATH): PLAY OFFLINE (GUEST MODE) */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                অফলাইনে খেলুন / Play Offline (Guest Mode)
              </span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                তাৎক্ষণিক খেলা
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              অ্যাকাউন্ট ছাড়াই সরাসরি গেস্ট হিসেবে ম্যাচ খেলুন (প্রগ্রেস লোকাল মেমরিতে থাকবে)।
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={25}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="কলসাইন / নাম লিখুন"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleContinueAsGuest}
                className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer shadow active:scale-95 transition-all shrink-0"
              >
                গেস্ট হিসেবে শুরু
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
