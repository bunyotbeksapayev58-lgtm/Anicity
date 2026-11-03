const ALLOWED_FAILURE_ACTIONS = new Set([
  'anime_create', 'anime_update', 'anime_delete',
  'episode_create', 'episode_update', 'episode_delete', 'episode_replace', 'video_source_change',
]);

// Best-effort failure audit. The database derives actor identity from auth.uid().
export async function logAssistantContentFailure(supabase, action, targetRecordId = null, targetAnimeId = null, failureCode = 'operation_failed') {
  if (!ALLOWED_FAILURE_ACTIONS.has(action)) return;
  try {
    await supabase.rpc('assistant_log_content_failure', {
      p_action: action,
      p_target_record_id: targetRecordId || null,
      p_target_anime_id: targetAnimeId || null,
      p_failure_code: failureCode,
    });
  } catch {
    // The original operation result takes precedence; never echo database errors.
  }
}
