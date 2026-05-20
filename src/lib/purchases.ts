// Connect RevenueCat dashboard when ready for production

export async function checkSubscriptionStatus(): Promise<{ isPremium: boolean; trialDaysLeft: number }> {
  // TODO: Replace with real RevenueCat check
  return { isPremium: false, trialDaysLeft: 7 };
}

export function isPremium(): boolean {
  // TODO: Replace with real RevenueCat check
  return false;
}

export async function startCheckout(_productId: string): Promise<void> {
  // TODO: Implement RevenueCat purchase flow
  throw new Error('Purchases not yet configured');
}
