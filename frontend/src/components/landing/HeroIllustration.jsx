import teamworkHero from '../../assets/illustrations/teamwork-hero.jpeg'

import './hero-illustration.css'

export default function HeroIllustration() {
  return (
    <div className="hero-illustration" aria-hidden="true">
      <img src={teamworkHero} alt="" />
    </div>
  )
}
