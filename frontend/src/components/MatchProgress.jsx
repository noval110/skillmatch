export default function MatchProgress({ score = 0 }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0))
  return (
    <div className="match-progress">
      <div className="match-progress-label"><span>Match</span><strong>{safeScore}%</strong></div>
      <div className="progress-track"><span style={{ width: `${safeScore}%` }} /></div>
    </div>
  )
}
