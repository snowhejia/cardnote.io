-- 已有库升级：提醒时间与提醒备注
ALTER TABLE cards ADD COLUMN IF NOT EXISTS reminder_time TEXT;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS reminder_note TEXT;
