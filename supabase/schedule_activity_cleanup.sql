-- Optional: first enable pg_cron in Supabase Database > Extensions.
-- Run once after 20261102_activity_history.sql, then check cron.job_run_details.
-- Re-running updates the named job. Deletes only activity records older than 90 days.
select cron.schedule(
  'koleksiyonum-activity-retention',
  '15 1 * * *',
  'select collection_private.prune_activity_history();'
);
