ALTER TABLE memberships ADD COLUMN role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin'));
UPDATE memberships SET role = 'admin'
WHERE user_id = (SELECT owner_id FROM groups WHERE groups.id = memberships.group_id);
CREATE TRIGGER memberships_creator_is_admin AFTER INSERT ON memberships
WHEN NEW.user_id = (SELECT owner_id FROM groups WHERE id = NEW.group_id)
BEGIN
  UPDATE memberships SET role = 'admin' WHERE group_id = NEW.group_id AND user_id = NEW.user_id;
END;
CREATE TRIGGER groups_owner_is_admin AFTER UPDATE OF owner_id ON groups
BEGIN
  UPDATE memberships SET role = 'admin' WHERE group_id = NEW.id AND user_id = NEW.owner_id;
END;
CREATE TRIGGER memberships_keep_admin_on_demote BEFORE UPDATE OF role ON memberships
WHEN OLD.role = 'admin' AND NEW.role != 'admin'
  AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = OLD.group_id AND o.user_id != OLD.user_id AND o.role = 'admin')
BEGIN
  SELECT RAISE(ABORT, 'A group needs at least one admin');
END;
CREATE TRIGGER memberships_keep_admin_on_delete BEFORE DELETE ON memberships
WHEN OLD.role = 'admin'
  AND EXISTS (SELECT 1 FROM groups WHERE id = OLD.group_id)
  AND EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = OLD.group_id AND o.user_id != OLD.user_id)
  AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = OLD.group_id AND o.user_id != OLD.user_id AND o.role = 'admin')
BEGIN
  SELECT RAISE(ABORT, 'A group needs at least one admin');
END;
