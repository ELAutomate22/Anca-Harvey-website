-- Backstop the application-level count check under concurrent page uploads.
CREATE TRIGGER future_letter_page_limit_before_insert
BEFORE INSERT ON future_letter_media
WHEN NEW.media_role = 'page' AND (
  SELECT COUNT(*) FROM future_letter_media
  WHERE future_letter_id = NEW.future_letter_id AND media_role = 'page'
) >= 12
BEGIN
  SELECT RAISE(ABORT, 'future letter page limit reached');
END;
