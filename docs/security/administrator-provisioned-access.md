# Administrator-provisioned access and optional email confirmation (SEC-002)

Approved 5 November 2026: account access comes from authorized administrative
provisioning, a valid explicit Fortify/canonical bridge and active account/profile
eligibility. `email_verified_at = NULL` is not an activation failure.

Public registration remains disabled. Unknown login emails do not create either
a Laravel User or a canonical UserAccount. Ordinary provisioning permits Admin,
Engineer and Viewer, requires active available profiles where already required,
and cannot bootstrap SuperAdmin. Trusted initial SuperAdmin setup remains separate.

Application route groups no longer advertise a mandatory `verified` gate.
Fortify email verification remains an **optional ownership confirmation** feature
with signed links/notification tests. User intentionally does not implement the
mandatory MustVerifyEmail contract. No existing verification timestamp is changed,
and password recovery remains independent of optional confirmation.

Engineer project edit authority remains current LGU scope and existing canonical
policy, **not creator-only ownership**. CreatedBy is historical attribution;
ManagingEngineer governs activity edits. Admin provisioning grants no additional
LGU assignment, manager identity, delete authority or Viewer write rights.

The new PostgreSQL regression provisions real accounts through the administrative
HTTP endpoint, signs in with NULL verification, exercises Engineer scoped project
create/edit, monthly/document/media work and Viewer direct-HTTP denial, and
asserts that role/verification values remain unchanged. Existing role, retirement,
invalid-link, password reset and private-file suites remain required.

## Legacy compatibility boundary

Existing legacy-only public.users credentials/passkeys still authenticate under
the historical Eloquent compatibility path. Unlinked starter users can also
authenticate there, but cannot obtain canonical workspace authority by matching
email or numeric IDs. This patch does not delete/mass-deactivate accounts or
invent historical provisioning provenance. Whether to retire every bare legacy
login is a separate owner decision; no new public registration/invitation or
provisioning table is added. Administrative creation plus the valid explicit
canonical bridge is the current enforceable canonical access boundary.
