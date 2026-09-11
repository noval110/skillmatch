export default function TeamPreferenceFields({ team = {}, onChange }) {
  return <div className="team-preference-fields">
    <label className="preference-checkbox">
      <input type="checkbox" name="beginner_friendly" {...(onChange ? { checked: Boolean(team.beginner_friendly), onChange } : { defaultChecked: Boolean(team.beginner_friendly) })} />
      <span>Beginner Friendly<small>Pemula diperbolehkan bergabung dengan tim ini.</small></span>
    </label>
    <label className="preference-checkbox">
      <input type="checkbox" name="willing_to_mentor" {...(onChange ? { checked: Boolean(team.willing_to_mentor), onChange } : { defaultChecked: Boolean(team.willing_to_mentor) })} />
      <span>Mentor Available<small>Anggota berpengalaman bersedia membantu anggota pemula.</small></span>
    </label>
  </div>
}
