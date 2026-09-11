import byteBuilders from '../assets/team-covers/byte-builders.png'
import devNova from '../assets/team-covers/dev-nova.png'
import hackSquad from '../assets/team-covers/hack-squad.png'
import createTeam from '../assets/illustrations/create-team.png'
import dashboard from '../assets/illustrations/dashboard-team.png'
import emptyTeam from '../assets/illustrations/empty-my-team.png'
import login from '../assets/illustrations/login-team-hd.png'
import register from '../assets/illustrations/register-highfive-hd.png'
import logo from '../assets/branding/skillmatch-logo.png'

const assets = { login, register, dashboard, emptyTeam, createTeam, logo, hackSquad, devNova, byteBuilders }

export default function ApprovedAsset({ name, className = '', alt = '' }) {
  const source = assets[name]
  if (!source) return null
  return <div className={`approved-asset approved-asset-${name} ${className}`}><img src={source} alt={alt} /></div>
}
