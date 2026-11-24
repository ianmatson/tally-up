const otherMember = 'o.user_id != ?1'

export function handOverSql(scope: 'group' | 'account'): string[] {
  const groups = scope === 'group' ? '(?2)' : '(SELECT group_id FROM memberships WHERE user_id = ?1)'
  return [
    `DELETE FROM groups WHERE id IN ${groups}
      AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = groups.id AND ${otherMember})`,
    `UPDATE memberships SET role = 'admin' WHERE group_id IN ${groups}
      AND user_id = (SELECT o.user_id FROM memberships o WHERE o.group_id = memberships.group_id AND ${otherMember}
        ORDER BY o.joined_at, o.user_id LIMIT 1)
      AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.group_id = memberships.group_id AND ${otherMember} AND o.role = 'admin')`,
    `UPDATE groups SET owner_id = (SELECT o.user_id FROM memberships o WHERE o.group_id = groups.id AND ${otherMember}
        AND o.role = 'admin' ORDER BY o.joined_at, o.user_id LIMIT 1)
      WHERE owner_id = ?1 AND id IN ${groups}`,
  ]
}

const GROUP_ENTRIES = 'SELECT e.id FROM entries e JOIN goals go ON go.id = e.goal_id WHERE go.group_id = ?2'
const ACTOR_IS_ADMIN = "EXISTS (SELECT 1 FROM memberships a WHERE a.group_id = ?2 AND a.user_id = ?3 AND a.role = 'admin')"

export function removeMemberSql(by: 'self' | 'admin'): string[] {
  const guard = by === 'admin' ? ` AND ${ACTOR_IS_ADMIN}` : ''
  return [
    `DELETE FROM comments WHERE user_id = ?1 AND entry_id IN (${GROUP_ENTRIES})${guard}`,
    `DELETE FROM reactions WHERE user_id = ?1 AND entry_id IN (${GROUP_ENTRIES})${guard}`,
    `DELETE FROM entries WHERE user_id = ?1 AND goal_id IN (SELECT id FROM goals WHERE group_id = ?2)${guard}`,
    `DELETE FROM memberships WHERE user_id = ?1 AND group_id = ?2${guard}`,
  ]
}

export const OWNER_TO_ACTOR_SQL = `UPDATE groups SET owner_id = ?3 WHERE id = ?2 AND owner_id = ?1 AND ${ACTOR_IS_ADMIN}`

export const SET_ROLE_SQL = `UPDATE memberships SET role = ?4 WHERE group_id = ?2 AND user_id = ?1 AND ${ACTOR_IS_ADMIN}`
