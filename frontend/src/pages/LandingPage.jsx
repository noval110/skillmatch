import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  ClipboardCheck,
  Code2,
  Gauge,
  MessageCircle,
  Palette,
  Search,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import brandLogo from '../assets/branding/skillmatch-logo.png'
import ApprovedAsset from '../components/ApprovedAsset'
import FAQAccordion from '../components/landing/FAQAccordion'
import LandingNavbar from '../components/landing/LandingNavbar'
import useAuthenticated from '../hooks/useAuthenticated'
import { competitionCategories } from '../config/competitions'

import '../styles/landing.css'

const categories = competitionCategories
  .filter(({ name }) => name !== 'Other')
  .flatMap(({ types, icon }) => types
    .filter((type) => type !== 'Other')
    .slice(0, 2)
    .map((label) => ({ label, icon })))

const signals = [
  {
    icon: UsersRound,
    title: 'Skill Compatibility',
    description:
      'Complement your strengths.',
  },
  {
    icon: Target,
    title: 'Role Fit',
    description:
      'Find your place in the team.',
  },
  {
    icon: Gauge,
    title: 'Team Readiness',
    description:
      'See what still needs work.',
  },
  {
    icon: ClipboardCheck,
    title: 'Competition Workspace',
    description:
      'Make the next step happen.',
  },
]

const steps = [
  {
    number: '01',
    icon: UserRound,
    title: 'Create Your Profile',
    description:
      'Show your skills, experience, and what you want to work on.',
  },
  {
    number: '02',
    icon: Search,
    title: 'Discover Matches',
    description:
      'Explore teams looking for someone with your strengths.',
  },
  {
    number: '03',
    icon: UsersRound,
    title: 'Form Your Team',
    description:
      'Apply for a role and bring the missing skills to the table.',
  },
  {
    number: '04',
    icon: Trophy,
    title: 'Prepare & Compete',
    description:
      'Turn a group of people into a team with a plan.',
  },
]

const features = [
  {
    icon: Target,
    title: 'Explainable Matching',
    description:
      'Understand the skills and needs behind every match.',
  },
  {
    icon: Search,
    title: 'Competition Discovery',
    description:
      'Explore teams by competition, role, and required skills.',
  },
  {
    icon: UsersRound,
    title: 'Role Requirements',
    description:
      'Define the roles and skills your team actually needs.',
  },
  {
    icon: MessageCircle,
    title: 'Team Chat',
    description:
      'Keep ideas and conversations together in your team.',
  },
  {
    icon: ClipboardCheck,
    title: 'Preparation Milestones',
    description:
      'Give your preparation clear steps and shared progress.',
  },
  {
    icon: Bell,
    title: 'Notifications',
    description:
      'Stay on top of requests, messages, and team updates.',
  },
  {
    icon: Gauge,
    title: 'Team Readiness',
    description:
      'Review role coverage, skills, and preparation gaps.',
  },
  {
    icon: UserRound,
    title: 'Competition Profile',
    description:
      'Let your skills, portfolio, and achievements speak.',
  },
]

const faqs = [
  {
    question:
      'What makes SkillMatch different from a normal team search?',
    answer:
      'SkillMatch explains compatibility using skills, roles, experience, availability, and team needs. Once a team is formed, readiness analysis and milestones help you prepare together.',
  },
  {
    question:
      'What competitions can I find teams for?',
    answer:
      'SkillMatch supports student competitions across technology, business, research, design, academics, and creative fields, including hackathons, case competitions, and UI/UX challenges.',
  },
  {
    question:
      'Can I join if I am just getting started?',
    answer:
      'Yes. Matching considers what a team needs, including its experience requirements. Create an honest profile and look for roles that fit your current skills.',
  },
  {
    question: 'What does Team Readiness measure?',
    answer:
      'It reviews team composition, role coverage, required skills, and profile completeness to highlight preparation gaps. It does not predict your chances of winning.',
  },
  {
    question:
      'Can we communicate inside SkillMatch?',
    answer:
      'Yes. Direct messages and Team Chat let you coordinate with other students and your teammates inside the platform.',
  },
]

export default function LandingPage() {
  const isAuthenticated = useAuthenticated()

  const [activeSection, setActiveSection] =
    useState('home')

  const [activeFAQ, setActiveFAQ] =
    useState(-1)

  useEffect(() => {
    const ids = [
      'home',
      'how-it-works',
      'features',
      'explore',
      'about',
      'faq',
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio -
              a.intersectionRatio,
          )[0]

        if (active) {
          setActiveSection(active.target.id)
        }
      },
      {
        rootMargin: '-20% 0px -65%',
        threshold: [0, 0.2, 0.5],
      },
    )

    ids.forEach((id) => {
      const element =
        document.getElementById(id)

      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page">
      <LandingNavbar
        activeSection={activeSection}
        isAuthenticated={isAuthenticated}
      />

      <main>
        <section
          className="landing-hero"
          id="home"
        >
          <div className="landing-container hero-edition">
            <span>THE STUDENT TEAM-FINDING PLATFORM</span>
            <span>DIFFERENT STRENGTHS. SHARED AMBITION. <ArrowUpRight size={14} /></span>
          </div>

          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow">
                Your next competition starts here
              </span>

              <h1>
                Find your<br />
                people.<br />
                <em>Go further.</em>
              </h1>

              <p>
                You bring the ambition. Find university teammates
                who bring the skills you need. Build your team,
                then get competition-ready together.
              </p>

              <div className="landing-hero-actions">
                <Link
                  className="landing-button landing-button-primary"
                  to={
                    isAuthenticated
                      ? '/teams'
                      : '/register'
                  }
                >
                  {isAuthenticated
                    ? 'Explore Teams'
                    : 'Get Started Free'}

                  <ArrowRight size={15} />
                </Link>

                <a
                  className="landing-button landing-button-outline"
                  href="#how-it-works"
                >
                  See How It Works
                </a>
              </div>


            </div>

            <div className="landing-hero-visual">
              <div className="hero-art-caption"><span>BETTER, TOGETHER.</span><ArrowUpRight size={25} /></div>
              <div className="hero-art-frame">
                <ApprovedAsset name="register" alt="Two students high-fiving as they build their team" />
              </div>
              <div className="hero-note hero-note-left">Good things start<br />with the right people.</div>
              <div className="hero-role-label role-design"><Palette size={17} /> The creative eye</div>
              <div className="hero-role-label role-code"><Code2 size={17} /> The technical mind</div>
              <div className="hero-team-stamp" aria-hidden="true"><UsersRound size={26} /><span>ONE<br />SHARED GOAL</span></div>
              <span className="hero-art-index">01 &mdash; FIND YOUR PEOPLE</span>
            </div>
          </div>

          <div className="landing-container hero-competition-types">
            <p>Find teams across</p>
            <div className="hero-category-chips">
              {categories.map(({ label, icon: Icon }) => (
                <span key={label}><Icon size={14} />{label}</span>
              ))}
            </div>
          </div>

        </section>

        <section className="landing-signal-strip">
          <div className="landing-container signal-grid">
            {signals.map(
              ({
                icon: Icon,
                title,
                description,
              }) => (
                <article key={title}>
                  <span>
                    <Icon size={20} />
                  </span>

                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section
          className="landing-challenge"
          id="about"
        >
          <div className="landing-container challenge-grid">
            <article className="challenge-column">
              <span className="landing-kicker">
                The challenge
              </span>

              <h2>
                Big ideas.<br />
                Missing teammates.
              </h2>

              <p>
                Finding the right teammates can
                be harder than building the
                project itself. Different skills,
                schedules, and goals can stop a
                competition journey before it
                starts.
              </p>

              <div className="challenge-list challenge-danger">
                <span>
                  ×
                  <b>
                    Hard to find the right
                    skills
                  </b>
                </span>

                <span>
                  ×
                  <b>
                    Team roles are often unclear
                  </b>
                </span>

                <span>
                  ×
                  <b>
                    Preparation quickly loses
                    direction
                  </b>
                </span>
              </div>
            </article>

            <div className="challenge-arrow">
              <span>
                Here&apos;s a
                <br />
                better way
              </span>

              <svg
                viewBox="0 0 150 100"
                aria-hidden="true"
              >
                <path d="M10 72 C50 90 104 74 126 28" />
                <path d="M112 34 L126 28 L128 43" />
              </svg>
            </div>

            <article className="challenge-column">
              <span className="landing-kicker">
                The solution
              </span>

              <h2>
                Different skills.<br />
                <em>One strong team.</em>
              </h2>

              <p>
                SkillMatch connects team formation
                with preparation, helping students
                understand who they need and what
                their team still lacks.
              </p>

              <div className="challenge-list challenge-success">
                <span>
                  <Check size={12} />
                  <b>
                    Find complementary teammates
                  </b>
                </span>

                <span>
                  <Check size={12} />
                  <b>
                    Match based on real team needs
                  </b>
                </span>

                <span>
                  <Check size={12} />
                  <b>
                    Continue into structured
                    preparation
                  </b>
                </span>
              </div>
            </article>
          </div>
        </section>

        <section
          className="landing-how"
          id="how-it-works"
        >
          <div className="landing-container">
            <div className="landing-heading-row">
              <div>
                <span className="landing-kicker">
                  How it works
                </span>

                <h2>
                  Your ambition.<br />
                  A way forward.
                </h2>
              </div>

              <p>
                Less searching.
                <br />
                More building.
              </p>
            </div>

            <div className="landing-step-grid">
              {steps.map(
                ({
                  number,
                  icon: Icon,
                  title,
                  description,
                }) => (
                  <article key={title}>
                    <header>
                      <span>
                        <Icon size={20} />
                      </span>

                      <small>
                        {number}
                      </small>
                    </header>

                    <h3>{title}</h3>

                    <p>{description}</p>

                    <ArrowRight
                      className="step-arrow"
                      size={15}
                    />
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section
          className="landing-features"
          id="features"
        >
          <div className="landing-container">
            <div className="landing-heading-row">
              <div>
                <span className="landing-kicker">
                  Features
                </span>

                <h2>
                  The tools behind<br />
                  a stronger team.
                </h2>
              </div>

              <p>
                Built around the real competition
                journey.
              </p>
            </div>

            <div className="landing-feature-grid">
              {features.map(
                ({
                  icon: Icon,
                  title,
                  description,
                }) => (
                  <article key={title}>
                    <span>
                      <Icon size={18} />
                    </span>

                    <div>
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </div>
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="landing-match-story">
          <div className="landing-container match-story-grid">
            <div className="match-story-copy">
              <span className="landing-kicker">
                Matching that explains itself
              </span>

              <h2>
                A good match<br />
                should <em>make sense.</em>
              </h2>

              <p>
                Matching should help students make
                decisions, not just display a
                number. SkillMatch shows the
                reasons behind the recommendation.
              </p>

              <Link
                className="landing-text-link"
                to="/teams"
              >
                Explore Teams
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="match-preview-area">
              <div className="match-shadow-card shadow-one" />
              <div className="match-shadow-card shadow-two" />

              <article className="match-preview-card" aria-label="Example matching preview">
                <p className="preview-label">Product preview &middot; Example match</p>
                <header>
                  <div className="match-team">
                    <span>WE</span>

                    <div>
                      <strong>
                        Web Development Team
                      </strong>

                      <small>
                        Looking for Backend
                        Developer
                      </small>
                    </div>
                  </div>

                  <div className="match-score">
                    <strong>86%</strong>
                    <small>Match</small>
                  </div>
                </header>

                <div className="match-factors">
                  <span>
                    Go
                    <b>Strong match</b>
                  </span>

                  <span>
                    PostgreSQL
                    <b>Strong match</b>
                  </span>

                  <span>
                    Availability
                    <b>Compatible</b>
                  </span>

                  <span>
                    React
                    <b className="partial">
                      Partial
                    </b>
                  </span>
                </div>

                <div className="match-reason">
                  <small>
                    WHY THIS MATCH?
                  </small>

                  <p>
                    Your backend skills complement
                    this team&apos;s current
                    frontend-heavy composition.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-readiness">
          <div className="landing-container readiness-layout">
            <div className="readiness-copy">
              <span className="landing-kicker">
                Team readiness
              </span>

              <h2>
                Team assembled.<br />
                Now, get ready.
              </h2>

              <p>
                Understand whether the team has
                enough role coverage, required
                skills, composition, and profile
                readiness to move forward.
              </p>

              <div className="readiness-disclaimer">
                Readiness measures preparation,
                not winning probability.
              </div>
            </div>

            <article className="readiness-panel">
              <header>
                <div>
                  <small>
                    TEAM READINESS
                  </small>

                  <strong>
                    Preparation overview
                  </strong>
                </div>

                <span>EXAMPLE DATA</span>
              </header>

              <div className="readiness-panel-body">
                <div className="readiness-ring">
                  <strong>78</strong>
                  <small>/ 100</small>
                </div>

                <div className="readiness-bars">
                  <div>
                    <span>
                      Team composition
                      <b>92%</b>
                    </span>

                    <i>
                      <em
                        style={{
                          width: '92%',
                        }}
                      />
                    </i>
                  </div>

                  <div>
                    <span>
                      Role coverage
                      <b>75%</b>
                    </span>

                    <i>
                      <em
                        style={{
                          width: '75%',
                        }}
                      />
                    </i>
                  </div>

                  <div>
                    <span>
                      Skill coverage
                      <b>71%</b>
                    </span>

                    <i>
                      <em
                        style={{
                          width: '71%',
                        }}
                      />
                    </i>
                  </div>

                  <div>
                    <span>
                      Profile readiness
                      <b>80%</b>
                    </span>

                    <i>
                      <em
                        style={{
                          width: '80%',
                        }}
                      />
                    </i>
                  </div>
                </div>

                <div className="readiness-priority">
                  <Sparkles size={18} />

                  <small>
                    NEXT PRIORITY
                  </small>

                  <strong>
                    Find someone with pitching
                    experience.
                  </strong>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-workspace">
          <div className="landing-container workspace-layout">
            <article className="workspace-panel">
              <header>
                <div>
                  <small>
                    PREPARATION MILESTONES &middot; EXAMPLE
                  </small>

                  <strong>
                    Competition preparation
                  </strong>
                </div>

                <span>72% complete</span>
              </header>

              <div className="workspace-body">
                <div className="workspace-list">
                  <span className="done">
                    <Check size={12} />
                    Build team
                  </span>

                  <span className="done">
                    <Check size={12} />
                    Select project idea
                  </span>

                  <span className="active">
                    <i />
                    Prototype
                  </span>

                  <span>
                    <i />
                    User testing
                  </span>

                  <span>
                    <i />
                    Final presentation
                  </span>
                </div>

                <div className="workspace-next">
                  <ClipboardCheck size={20} />

                  <small>
                    NEXT MILESTONE
                  </small>

                  <strong>
                    Prototype review
                  </strong>

                  <p>
                    Keep the team aligned before
                    submission.
                  </p>

                  <ArrowRight size={15} />
                </div>
              </div>
            </article>

            <div className="workspace-copy">
              <span className="landing-kicker">
                Competition workspace
              </span>

              <h2>
                Keep preparation
                <br />
                moving forward.
              </h2>

              <p>
                Team formation is only the
                beginning. Preparation milestones
                make the next step visible for
                everyone.
              </p>
            </div>
          </div>
        </section>

        <section
          className="landing-explore"
          id="explore"
        >
          <div className="landing-container">
            <div className="landing-heading-row">
              <div>
                <span className="landing-kicker">
                  Built around collaboration
                </span>

                <h2>
                  One platform.
                  <br />
                  One competition journey.
                </h2>
              </div>

              <Link
                className="landing-text-link"
                to="/teams"
              >
                Explore Teams
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="journey-grid">
              <article>
                <UsersRound size={18} />
                <strong>
                  Discover teammates
                </strong>
                <p>
                  Find complementary strengths.
                </p>
              </article>

              <article>
                <Target size={18} />
                <strong>
                  Explainable matching
                </strong>
                <p>
                  Understand why a match works.
                </p>
              </article>

              <article>
                <Gauge size={18} />
                <strong>
                  Team readiness
                </strong>
                <p>
                  Know what still needs work.
                </p>
              </article>

              <article>
                <ClipboardCheck size={18} />
                <strong>
                  Preparation milestones
                </strong>
                <p>
                  Stay aligned before submission.
                </p>
              </article>

              <article>
                <MessageCircle size={18} />
                <strong>
                  Team collaboration
                </strong>
                <p>
                  Coordinate without leaving the
                  platform.
                </p>
              </article>

              <article>
                <UserRound size={18} />
                <strong>
                  Competition profile
                </strong>
                <p>
                  Present skills and achievements.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          className="landing-faq"
          id="faq"
        >
          <div className="landing-container faq-layout">
            <div className="faq-copy">
              <span className="landing-kicker">
                FAQ
              </span>

              <h2>
                Got questions?
                <br />
                We&apos;ve got answers.
              </h2>

              <p>
                A few things to know before<br />
                you find your next team.
              </p>
            </div>

            <FAQAccordion
              items={faqs}
              activeIndex={activeFAQ}
              onChange={setActiveFAQ}
            />
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-container">
            <div className="final-cta-card">
              <div className="final-cta-copy">
                <span className="landing-kicker">Ready for your next competition?</span>
                <h2>You have the idea.<br />Find your people.</h2>
                <p>Bring your strengths. Build a team around what comes next.</p>
                <div className="final-cta-actions">
                  <Link className="landing-button landing-button-primary" to={isAuthenticated ? '/teams' : '/register'}>
                    {isAuthenticated ? 'Explore Teams' : 'Get Started Free'}
                    <ArrowRight size={15} />
                  </Link>
                  <a className="landing-button landing-button-outline" href="#how-it-works">How It Works</a>
                </div>
              </div>
              <div className="final-cta-paths">
                <span className="cta-paths-label">CHOOSE YOUR NEXT STEP</span>
                <Link className="cta-path" to={isAuthenticated ? '/profile' : '/register'}>
                  <UserRound size={22} />
                  <span><strong>Start with your strengths</strong><small>Add your skills, interests, and experience.</small></span>
                  <ArrowUpRight size={19} />
                </Link>
                <Link className="cta-path" to="/teams">
                  <UsersRound size={22} />
                  <span><strong>Find where you fit</strong><small>Explore teams looking for your skills.</small></span>
                  <ArrowUpRight size={19} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner">
          <div className="landing-footer-brand">
            <span>
              <img
                src={brandLogo}
                alt=""
              />
            </span>

            <div>
              <strong>SkillMatch</strong>

              <small>
                Different strengths. A brighter
                tomorrow.
              </small>
            </div>
          </div>

          <nav aria-label="Footer navigation">
            <a href="#home">Home</a>
            <a href="#how-it-works">
              How It Works
            </a>
            <a href="#features">
              Features
            </a>
            <a href="#explore">
              Explore
            </a>
            <a href="#about">
              About
            </a>
            <a href="#faq">FAQ</a>
          </nav>

          <small>
            © 2026 SkillMatch
          </small>
        </div>
      </footer>
    </div>
  )
}