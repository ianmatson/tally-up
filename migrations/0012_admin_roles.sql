ALTER TABLE memberships ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin'));
UPDATE memberships SET role = 'admin'
WHERE user_id = (SELECT owner_id FROM groups WHERE groups.id = memberships.group_id);
CREATE TRIGGER memberships_creator_is_admin AFTER INSERT ON memberships
WHEN NEW.user_id = (SELECT owner_id FROM groups WHERE id = NEW.group_id)
BEGIN
  UPDATE memberships SET role = 'admin' WHERE group_id = NEW.group_id AND user_id = NEW.user_id;
END;
