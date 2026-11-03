export function getCurrentSubscription(subscriptions = [], now = new Date()) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return subscriptions
    .filter((subscription) => (
      subscription?.status === 'active' &&
      (!subscription.starts_at || new Date(subscription.starts_at).getTime() <= currentTime) &&
      Number.isFinite(new Date(subscription.expires_at).getTime()) &&
      new Date(subscription.expires_at).getTime() > currentTime
    ))
    .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0] || null;
}

export function getSubscriptionSummary(subscriptions = [], now = new Date()) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const current = getCurrentSubscription(subscriptions, now);
  const latestExpired = subscriptions
    .filter((subscription) => (
      subscription?.status === 'active' &&
      (!subscription.starts_at || new Date(subscription.starts_at).getTime() <= currentTime)
    ))
    .sort((a, b) => new Date(b.expires_at) - new Date(a.expires_at))[0] || null;
  return {
    isVip: Boolean(current),
    expiresAt: current?.expires_at || latestExpired?.expires_at || null,
    planName: current?.plan_name || null,
  };
}
