import { hasPermission } from '@/config/permissions';
import { ForbiddenError } from '@/lib/errors';
import type { Role } from '@/types/user';

type Status = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

const LIVE_STATUSES: ReadonlySet<Status> = new Set(['PUBLISHED', 'SCHEDULED']);

/**
 * Status changes need more than `content:edit` (rule.md 7.10):
 *  - going live (PUBLISHED / SCHEDULED) or taking content off live → `content:publish`
 *  - archiving or restoring from the archive                       → `content:archive`
 *
 * Only an actual change is checked. Autosave re-sends the current status on every
 * save, so editing an already-published post stays allowed for anyone with `content:edit`.
 */
export function assertCanChangeStatus(role: Role, from: Status, to: Status | undefined): void {
  if (!to || to === from) return;

  if ((LIVE_STATUSES.has(to) || LIVE_STATUSES.has(from)) && !hasPermission(role, 'content:publish')) {
    throw new ForbiddenError('Your role cannot publish or unpublish content. Ask a Content Manager to publish it.');
  }

  if ((to === 'ARCHIVED' || from === 'ARCHIVED') && !hasPermission(role, 'content:archive')) {
    throw new ForbiddenError('Your role cannot archive or restore content.');
  }
}
