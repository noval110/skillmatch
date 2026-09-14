package handlers

import (
	"context"
	"fmt"
	"testing"
)

func TestTeamMilestoneIntegration(t *testing.T) {
	s := newCommunityTest(t)
	ctx := context.Background()
	if _, err := s.pool.Exec(ctx, `INSERT INTO team_members(team_id,user_id,role) VALUES(1,2,'Member')`); err != nil {
		t.Fatal(err)
	}

	empty := decodeTest[milestoneList](t, s.request(1, "GET", "/teams/1/milestones", "", 200))
	if len(empty.Milestones) != 0 || empty.Summary.OverallProgress != nil || !empty.CanManage {
		t.Fatalf("unexpected empty owner workspace: %+v", empty)
	}
	memberView := decodeTest[milestoneList](t, s.request(2, "GET", "/teams/1/milestones", "", 200))
	if memberView.CanManage {
		t.Fatal("regular member must not receive manage permission")
	}
	s.request(3, "GET", "/teams/1/milestones", "", 403)
	s.request(2, "POST", "/teams/1/milestones", `{"title":"Member write"}`, 403)
	s.request(1, "POST", "/teams/1/milestones", `{"title":"Invalid","progress":101}`, 400)
	s.request(1, "POST", "/teams/1/milestones", `{"title":"Invalid date","due_date":"17-10-2026"}`, 400)

	created := decodeTest[TeamMilestone](t, s.request(1, "POST", "/teams/1/milestones", `{"title":" Proposal ","description":"Prepare the problem statement.","status":"not_started","progress":0,"due_date":"2026-10-17"}`, 201))
	if created.Title != "Proposal" || created.Status != "not_started" || created.Progress != 0 || created.DueDate == nil || *created.DueDate != "2026-10-17" || created.CreatedBy == nil || *created.CreatedBy != 1 {
		t.Fatalf("unexpected created milestone: %+v", created)
	}

	list := decodeTest[milestoneList](t, s.request(2, "GET", "/teams/1/milestones", "", 200))
	if len(list.Milestones) != 1 || list.Summary.NotStarted != 1 || list.Summary.OverallProgress == nil || *list.Summary.OverallProgress != 0 || list.Summary.NextMilestone == nil {
		t.Fatalf("member could not read milestone summary: %+v", list)
	}
	var createdNotifications int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id=2 AND type='milestone_created' AND related_team_id=1`).Scan(&createdNotifications); err != nil || createdNotifications != 1 {
		t.Fatalf("created notification: count=%d err=%v", createdNotifications, err)
	}

	path := fmt.Sprintf("/teams/1/milestones/%d", created.ID)
	s.request(2, "PUT", path, `{"title":"Proposal","status":"in_progress","progress":65}`, 403)
	updated := decodeTest[TeamMilestone](t, s.request(1, "PUT", path, `{"title":"Proposal","description":"Prepare and review the proposal.","status":"in_progress","progress":65,"due_date":"2026-10-18"}`, 200))
	if updated.Status != "in_progress" || updated.Progress != 65 || updated.DueDate == nil || *updated.DueDate != "2026-10-18" {
		t.Fatalf("milestone was not updated: %+v", updated)
	}
	progressed := decodeTest[milestoneList](t, s.request(1, "GET", "/teams/1/milestones", "", 200))
	if progressed.Summary.OverallProgress == nil || *progressed.Summary.OverallProgress != 65 || progressed.Summary.InProgress != 1 {
		t.Fatalf("progress summary was not recalculated: %+v", progressed.Summary)
	}
	completed := decodeTest[TeamMilestone](t, s.request(1, "PUT", path, `{"title":"Proposal","description":"Ready","status":"completed","progress":65,"due_date":"2026-10-18"}`, 200))
	if completed.Status != "completed" || completed.Progress != 100 {
		t.Fatalf("completion must produce 100%% progress: %+v", completed)
	}
	// Repeating a completed write must not send another completion event.
	s.request(1, "PUT", path, `{"title":"Proposal","description":"Ready","status":"completed","progress":100,"due_date":"2026-10-18"}`, 200)
	var completedNotifications int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE user_id=2 AND type='milestone_completed' AND related_team_id=1`).Scan(&completedNotifications); err != nil || completedNotifications != 1 {
		t.Fatalf("completion notification: count=%d err=%v", completedNotifications, err)
	}
	finished := decodeTest[milestoneList](t, s.request(2, "GET", "/teams/1/milestones", "", 200))
	if finished.Summary.OverallProgress == nil || *finished.Summary.OverallProgress != 100 || finished.Summary.Completed != 1 || finished.Summary.NextMilestone != nil {
		t.Fatalf("completed summary was not recalculated: %+v", finished.Summary)
	}

	s.request(3, "DELETE", path, "", 403)
	s.request(1, "DELETE", path, "", 204)
	s.request(1, "DELETE", path, "", 404)

	second := decodeTest[TeamMilestone](t, s.request(1, "POST", "/teams/1/milestones", `{"title":"No date","status":"in_progress","progress":40}`, 201))
	if second.ID == 0 {
		t.Fatal("second milestone was not created")
	}
	s.request(1, "POST", "/teams/1/milestones", `{"title":"Dated","status":"not_started","progress":0,"due_date":"2026-11-01"}`, 201)
	s.request(1, "POST", "/teams/1/milestones", `{"title":"Completed","status":"completed","progress":100,"due_date":"2026-10-01"}`, 201)
	ordered := decodeTest[milestoneList](t, s.request(2, "GET", "/teams/1/milestones", "", 200))
	if len(ordered.Milestones) != 3 || ordered.Milestones[0].Title != "Dated" || ordered.Milestones[1].Title != "No date" || ordered.Milestones[2].Title != "Completed" || ordered.Summary.NextMilestone.Title != "Dated" {
		t.Fatalf("milestones are not sorted by unfinished due date: %+v", ordered.Milestones)
	}
	s.request(1, "DELETE", "/teams/1", "", 200)
	var remaining int
	if err := s.pool.QueryRow(ctx, `SELECT COUNT(*) FROM team_milestones WHERE team_id=1`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("team deletion did not cascade milestones: count=%d err=%v", remaining, err)
	}
}
