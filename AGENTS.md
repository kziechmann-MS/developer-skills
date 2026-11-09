# Repository contribution policy

## Branches and pull requests

- Make all changes on a feature branch whose name differs from the repository's
  default branch, and propose them through a pull request.
- Never push changes directly to the default branch. The source-name rule also
  applies to pull requests from forks, even when the fork's default differs.

## Human approval and merging

- Only the human owner, `kziechmann-MS`, approves changes and performs merges.
- Agents must never submit approving reviews on the owner's behalf, merge pull
  requests, or enable auto-merge. They may implement changes and open or update
  pull requests when requested.
- Passing checks, a request to create a PR, and release/IP clearance are not
  approval to merge.
- Approval applies only to the changes the owner reviewed. Additional changes
  require renewed owner review before merging.

## Enforcement limits

GitHub cannot reliably distinguish a human from an agent using the same account
credentials. GitHub also prevents a PR author from formally approving their own
PR. For an owner-authored PR, an explicit human review decision for the current
revision is still required by this workflow policy; do not fabricate a formal
self-approval or treat green checks as that decision.

The `Non-default PR source` check validates only the source branch name against
the target repository's default branch. It does not establish human approval or
identity. Server-side PR/status requirements are separate from this policy and
do not remove these shared-credential and self-approval limitations.
