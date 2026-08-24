UPDATE relationships
SET start_date = '2025-08-28',
    updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
WHERE id = 'primary'
  AND start_date <> '2025-08-28';
