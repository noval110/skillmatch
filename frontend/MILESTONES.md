# Team competition milestones

The Milestones tab is a private competition-preparation workspace. It measures
work completion; it does not change Team Readiness V1 or recommendation matching.

## API and permissions

All routes use the existing JWT middleware:

- `GET /api/teams/:id/milestones`: owner and current team members.
- `POST /api/teams/:id/milestones`: team owner.
- `PUT /api/teams/:id/milestones/:milestone_id`: team owner.
- `DELETE /api/teams/:id/milestones/:milestone_id`: team owner.

The server validates title and description length, status, progress, calendar
date, team ownership, milestone/team relationship, and active membership.
Completed milestones always have 100% progress. A 100% update becomes completed,
and positive progress moves a not-started milestone to in-progress.

## Calculations and ordering

Overall preparation is the rounded arithmetic mean of every stored milestone's
`progress`. An empty workspace returns `overall_progress: null`. Unfinished
milestones are returned first, ordered by due date; milestones without a deadline
follow dated work, and completed items appear last.

Deadline labels are calendar-based: completed, overdue, due within three days,
upcoming, or no deadline. The database uses `DATE` because the product captures a
day rather than a due time, avoiding date shifts between browser time zones.

Creating a milestone and first marking it completed notify the other current team
members in the same database transaction. Re-saving a completed milestone does
not duplicate that event. Automated reminder jobs are intentionally excluded.
