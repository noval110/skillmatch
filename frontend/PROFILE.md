# Profile completion

The Profile and Public Profile screens reuse the existing profile, photo, skills, showcase, public-profile, team-membership, and direct-message APIs.

Profile completion is a transparent seven-part score. Each completed item has equal weight:

1. Profile photo
2. Bio
3. Experience level
4. Preferred role
5. Availability
6. Competition interest
7. At least one skill

The percentage is `round(completed / 7 * 100)`. Portfolio projects and achievements are optional credibility evidence and never reduce this score. The interface describes them as optional boosters.

The public page renders only the backend's explicit public-profile response: `id`, `name`, `bio`, `experience_level`, `profile_photo_url`, `preferred_role`, `availability`, `project_interest`, `created_at`, `skills`, `teams`, `portfolio`, and `achievements`. Public team entries contain only `id`, `name`, `role`, and `competition_type`. Email, password data, and authentication data are not part of that response.

Portfolio and achievement links are shown only when they are valid HTTP(S) URLs without embedded credentials. The backend remains the final validation and ownership boundary for create, update, and delete operations.
