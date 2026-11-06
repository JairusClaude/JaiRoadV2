# RoadCoverage metadata commit authority (SEC-001)

Baseline: `3e4a5c55d8b929d51b40f6c9983ba6c993315431`.

The new six-case PostgreSQL regression failed on the unchanged application:
three failures (Admin deactivation, Engineer deactivation, Engineer retirement),
three passes (active Admin/Engineer controls and revoked LGU membership),
36 assertions. The HTTP worker actually waited on the road row lock. The
vulnerable requests returned 302 instead of the required 403.

The repair obtains an existing road row **before** taking lifecycle authority.
A request waiting on that row must allow a lifecycle revocation to finish.
After the road wait it takes the existing shared lifecycle advisory key
1927710916, freezes the login/account bridge in password-updater order, then
the linked profile and relevant EngineerLGU membership. Fresh canonical identity,
role and LGU permission checks run after these waits. The locks remain until
the metadata/audit transaction commits. Account lifecycle uses the exclusive
version of that key; assignment administration locks profile then membership.

No municipality reassociation bypass, geometry conversion, new audit policy,
schema change or neighboring project/record workflow is introduced. Existing
road geometry, municipality and assignment tests plus the new race suite passed:
97 tests, 1,035 assertions on disposable PostgreSQL 17 before later repairs.

Other ordinary mutation methods that capture actors before locks require their
own investigation. This change does not claim to fix those adjacent paths.
