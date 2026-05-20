import { useAuthStore } from '../stores/authStore';

const TRIAL_DAYS = 7;

export function useTrial() {
  const profile = useAuthStore((s) => s.profile);

  if (!profile?.trial_started_at) {
    return { isInTrial: false, daysLeft: 0, trialExpired: true };
  }

  const started = new Date(profile.trial_started_at);
  const now = new Date();
  const diffMs = now.getTime() - started.getTime();
  const daysUsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);

  return {
    isInTrial: daysLeft > 0,
    daysLeft,
    trialExpired: daysLeft === 0,
  };
}
