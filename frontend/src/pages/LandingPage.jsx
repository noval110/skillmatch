import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  Code2,
  Gamepad2,
  Gauge,
  GraduationCap,
  Lightbulb,
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

import '../styles/landing.css'

const categories = [
  { label: 'Technology', icon: Code2 },
  { label: 'Academic', icon: GraduationCap },
  { label: 'Business', icon: BriefcaseBusiness },
  { label: 'Research', icon: Search },
  { label: 'Creative', icon: Lightbulb },
  { label: 'Design', icon: Palette },
  { label: 'Esports', icon: Gamepad2 },
  { label: 'Other', icon: Trophy },
]

const signals = [
  {
    icon: UsersRound,
    title: 'Skill Compatibility',
    description:
      'Temukan orang yang melengkapi kemampuan team.',
  },
  {
    icon: Target,
    title: 'Role Fit',
    description:
      'Cocokkan kebutuhan role dengan kandidat.',
  },
  {
    icon: Gauge,
    title: 'Team Readiness',
    description:
      'Lihat apa yang masih kurang sebelum kompetisi.',
  },
  {
    icon: ClipboardCheck,
    title: 'Competition Workspace',
    description:
      'Kelola persiapan setelah team terbentuk.',
  },
]

const steps = [
  {
    number: '01',
    icon: UserRound,
    title: 'Create Your Profile',
    description:
      'Bangun profil lewat skill, pengalaman, role interest, dan tujuan kompetisi.',
  },
  {
    number: '02',
    icon: Search,
    title: 'Discover Matches',
    description:
      'Temukan team dan role yang relevan dengan kemampuanmu.',
  },
  {
    number: '03',
    icon: UsersRound,
    title: 'Form Your Team',
    description:
      'Bergabung dan lengkapi komposisi team yang masih kurang.',
  },
  {
    number: '04',
    icon: Trophy,
    title: 'Prepare & Compete',
    description:
      'Pantau readiness dan milestone sampai team siap bergerak.',
  },
]

const features = [
  {
    icon: Target,
    title: 'Explainable Matching',
    description:
      'Ketahui kenapa sebuah team atau role cocok untukmu, bukan cuma sebuah score.',
  },
  {
    icon: Search,
    title: 'Competition Discovery',
    description:
      'Cari team berdasarkan kategori kompetisi, role, dan kebutuhan skill.',
  },
  {
    icon: UsersRound,
    title: 'Role Requirements',
    description:
      'Team dapat menentukan role dan skill yang sedang benar-benar dibutuhkan.',
  },
  {
    icon: MessageCircle,
    title: 'Team Chat',
    description:
      'Koordinasi bersama anggota team langsung dari SkillMatch.',
  },
  {
    icon: ClipboardCheck,
    title: 'Preparation Milestones',
    description:
      'Track progress persiapan dari team formation hingga submission.',
  },
  {
    icon: Sparkles,
    title: 'Notifications',
    description:
      'Ikuti join request, pesan, dan update penting lainnya.',
  },
  {
    icon: Gauge,
    title: 'Readiness Analysis',
    description:
      'Evaluasi composition, role coverage, skill coverage, dan profile readiness.',
  },
  {
    icon: UserRound,
    title: 'Competition Profile',
    description:
      'Tampilkan skill, portfolio, pengalaman, dan achievement secara terstruktur.',
  },
]

const faqs = [
  {
    question:
      'Apa yang membedakan SkillMatch dari platform pencarian team biasa?',
    answer:
      'SkillMatch tidak hanya menampilkan daftar team. Platform membantu mahasiswa memahami kecocokan berdasarkan skill, role, experience, availability, dan kebutuhan team setelah terbentuk.',
  },
  {
    question:
      'Jenis kompetisi apa yang bisa menggunakan SkillMatch?',
    answer:
      'SkillMatch dirancang untuk berbagai kompetisi mahasiswa seperti hackathon, web development, UI/UX, business case, riset, karya tulis, debat, hingga kompetisi kreatif.',
  },
  {
    question:
      'Apakah mahasiswa pemula tetap bisa mencari team?',
    answer:
      'Bisa. Matching berfokus pada kecocokan kebutuhan dan bukan sekadar senioritas. Team juga dapat menentukan kebutuhan experience untuk setiap role.',
  },
  {
    question: 'Apa fungsi Team Readiness?',
    answer:
      'Team Readiness membantu anggota memahami kondisi team melalui composition, role coverage, required skill coverage, dan profile readiness. Nilainya bukan prediksi kemenangan.',
  },
  {
    question:
      'Apakah anggota team bisa berkomunikasi di SkillMatch?',
    answer:
      'Bisa. SkillMatch menyediakan direct message dan Team Chat agar koordinasi dapat dilakukan di dalam platform.',
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
          <div className="hero-background-orb orb-left" />
          <div className="hero-background-orb orb-right" />

          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <span className="landing-eyebrow">
                Different strengths. One shared goal.
              </span>

              <h1>
                Find the right team
                <br />
                for{' '}
                <em>competitions.</em>
              </h1>

              <p>
                SkillMatch helps students connect,
                collaborate, and build better
                competition teams based on real
                skills, roles, and team needs.
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

              <div className="hero-category-chips">
                {categories
                  .slice(0, 6)
                  .map(({ label }) => (
                    <span key={label}>
                      {label}
                    </span>
                  ))}
              </div>
            </div>

            <div className="landing-hero-visual">
              <div className="hero-illustration-glow" />

              <ApprovedAsset
                name="login"
                alt="Mahasiswa berkolaborasi menggunakan SkillMatch"
              />

              <div className="hero-note hero-note-left">
                Better
                <br />
                ideas
                <br />
                together.
              </div>

              <div className="hero-note hero-note-right">
                Students
                <br />
                build
                <br />
                amazing
                <br />
                things.
              </div>

              <span className="hero-star star-one">
                ✦
              </span>

              <span className="hero-star star-two">
                ✦
              </span>

              <span className="hero-star star-three">
                ✦
              </span>
            </div>
          </div>

          <div className="landing-container landing-competition-band">
            <div className="competition-band-copy">
              <span className="landing-kicker">
                Explore every direction
              </span>

              <strong>
                Your competition doesn&apos;t
                define your potential.
              </strong>
            </div>

            <div className="competition-category-grid">
              {categories.map(
                ({
                  label,
                  icon: Icon,
                }) => (
                  <span key={label}>
                    <Icon size={14} />
                    {label}
                  </span>
                ),
              )}
            </div>

            <div className="competition-band-art">
              <div className="competition-mini-card">
                <span>
                  <Trophy size={18} />
                </span>

                <div>
                  <small>
                    NEXT COMPETITION
                  </small>

                  <strong>
                    Find the missing piece.
                  </strong>

                  <p>
                    Build around complementary
                    strengths.
                  </p>
                </div>
              </div>

              <div className="competition-orbit orbit-small" />
              <div className="competition-orbit orbit-large" />
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
                Great ideas often
                <br />
                don&apos;t happen alone.
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
                SkillMatch makes
                <br />
                team-building{' '}
                <em>clearer.</em>
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
                  From solo to squad in
                  <br />
                  four simple steps.
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
                  Everything you need to
                  build, prepare, and grow.
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
                Know why a team
                <br />
                <em>fits you.</em>
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

              <article className="match-preview-card">
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
                Don&apos;t just build a team.
                <br />
                Prepare it.
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

                <span>LIVE FEATURE</span>
              </header>

              <div className="readiness-panel-body">
                <div className="readiness-ring">
                  <strong>78</strong>
                  <small>READY</small>
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
                    PREPARATION MILESTONES
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
                Hal-hal penting sebelum mulai
                membangun team di SkillMatch.
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
              <div>
                <span className="landing-kicker">
                  Ready when you are
                </span>

                <h2>
                  Your next competition starts
                  with a team.
                </h2>

                <p>
                  Find people who complement what
                  you already bring.
                </p>
              </div>

              <div className="final-cta-actions">
                <Link
                  className="landing-button landing-button-primary"
                  to="/teams"
                >
                  Explore Teams
                  <ArrowRight size={14} />
                </Link>

                <Link
                  className="landing-button landing-button-outline"
                  to={
                    isAuthenticated
                      ? '/profile'
                      : '/register'
                  }
                >
                  {isAuthenticated
                    ? 'View Profile'
                    : 'Get Started'}
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

          <nav>
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