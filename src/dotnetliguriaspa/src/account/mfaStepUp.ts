/**
 * Step-up sign-in extras. Only the level is requested: forcing a full re-login
 * (prompt=login/max_age=0) shows the federated login buttons again and a
 * brokered sign-in skips the realm's OTP step. A real step-up reuses the
 * existing session and asks only for the second factor, refreshing auth_time.
 */
export function mfaStepUpExtras(): Record<string, string> {
  return { acr_values: 'mfa' };
}
