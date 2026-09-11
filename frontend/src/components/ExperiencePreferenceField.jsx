
export default function ExperiencePreferenceField({ value = 'open' }) {
  return <label><span>Experience Preference</span><select name="experience_preference" defaultValue={value || 'open'}>
    <option value="open">Open to All</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
  </select></label>
}
