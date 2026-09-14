import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, BookOpen, BrainCircuit, Check, ChevronRight, Compass, Flag, Gamepad2, GraduationCap, Layers, Lightbulb, MessageSquare, Mic, Palette, ScanLine, Sprout, Target, Trophy, UserRound, UsersRound } from 'lucide-react'
import useAuthenticated from '../hooks/useAuthenticated'
import collaboration from '../assets/illustrations/login-team-hd.png'
import highFive from '../assets/illustrations/register-highfive-hd.png'
import brandLogo from '../assets/branding/skillmatch-logo.png'
import LandingNavbar from '../components/landing/LandingNavbar'
import LandingTeamCard from '../components/landing/LandingTeamCard'
import FAQAccordion from '../components/landing/FAQAccordion'
import '../styles/landing.css'

const highlights = [
  [Trophy, 'Every kind of competition', 'One place to find your people'],
  [Sprout, 'Beginners belong here', 'A starting point at every level'],
  [UsersRound, 'A role for your strengths', 'Build a more balanced team'],
  [Target, 'Skills that fit together', 'Discover shared potential'],
]
const problems = [
  ['01', 'The right people are hard to find.', 'Sulit menemukan anggota tim dengan minat, tujuan, dan komitmen yang sejalan.'],
  ['02', 'Great skills. Missing balance.', 'Tim punya banyak ide, tapi belum punya kombinasi skill dan role yang dibutuhkan.'],
  ['03', 'The first step feels the hardest.', 'Pemula sering minder atau tidak tahu tim mana yang terbuka untuk belajar bersama.'],
  ['04', 'The gaps show up too late.', 'Kekurangan tim baru terasa ketika deadline lomba sudah semakin dekat.'],
]
const steps = [
  [UserRound, 'Build your profile', 'Tambahkan skill, minat, tujuan kompetisi, dan waktu yang bisa kamu berikan.'],
  [Compass, 'Discover or create a team', 'Jelajahi beragam kategori lomba, atau bentuk tim dengan role yang kamu butuhkan.'],
  [UsersRound, 'Match, connect, collaborate', 'Lihat kecocokan, isi role yang belum lengkap, dan mulai persiapan bersama.'],
]
const features = [
  [BrainCircuit, 'Smart Team Matching', 'Temukan kecocokan berdasarkan skill, kebutuhan role, dan minat kompetisi.'],
  [Sprout, 'Beginner-Friendly Discovery', 'Cari tim yang menyambut pemula dan membuka kesempatan belajar bersama.'],
  [ScanLine, 'Role & Skill Gap Analysis', 'Pahami skill dan role yang masih dibutuhkan sebelum kompetisi dimulai.'],
  [Target, 'Team Readiness Overview', 'Lihat kesiapan dan keseimbangan tim agar langkah berikutnya lebih jelas.'],
  [Trophy, 'Competition Category Support', 'Dari debat dan business case hingga riset, desain, olahraga, dan teknologi.'],
  [GraduationCap, 'Portfolio & Achievements', 'Tunjukkan proyek, pencapaian, dan pengalaman kompetisi di profilmu.'],
  [MessageSquare, 'Team Collaboration', 'Lanjutkan dari menemukan tim ke percakapan dan persiapan bersama.'],
  [Bell, 'Stay in the Loop', 'Ikuti status permintaan bergabung dan aktivitas tim melalui notifikasi.'],
]
const categories = [
  [Flag, 'Hackathon'], [Layers, 'Web Development'], [ScanLine, 'Mobile App'], [Palette, 'UI/UX Design'],
  [Mic, 'Debate'], [Lightbulb, 'Business Case'], [BookOpen, 'Research / KTI'], [BrainCircuit, 'Data / AI'],
  [Palette, 'Creative Media'], [Gamepad2, 'Esports'], [Trophy, 'Sports'], [Compass, 'Other competitions'],
]
const teams = [
  { name: 'ByteBuilders', initial: 'BB', category: 'Hackathon', description: 'Membangun solusi digital untuk akses pendidikan yang lebih baik.', roles: ['Frontend', 'UI/UX Designer'], members: '3 / 5', beginner: true, tone: 'blue' },
  { name: 'Ruang Riset', initial: 'RR', category: 'Research / KTI', description: 'Meneliti ide pengelolaan sampah yang bisa diterapkan di lingkungan kampus.', roles: ['Researcher', 'Data Analyst'], members: '2 / 4', beginner: true, tone: 'green' },
  { name: 'Case Collective', initial: 'CC', category: 'Business Case', description: 'Merancang strategi bisnis yang berdampak untuk usaha lokal.', roles: ['Strategist', 'Presenter'], members: '2 / 4', beginner: false, tone: 'rose' },
]
const faqs = [
  { question: 'What is SkillMatch?', answer: 'SkillMatch adalah platform untuk membantu mahasiswa menemukan rekan dan membentuk tim kompetisi berdasarkan skill, role, minat, dan tujuan bersama.' },
  { question: 'Is SkillMatch only for coding competitions?', answer: 'Tidak. Kamu bisa menemukan tim untuk debat, business case, riset / KTI, desain, akademik, olahraga, esports, dan berbagai kompetisi lainnya.' },
  { question: 'Can beginners join teams?', answer: 'Bisa. Lengkapi profil dengan kemampuan dan minat belajarmu, lalu cari tim yang terbuka untuk pemula. Baca kebutuhan role dan preferensi pengalaman sebelum mengajukan permintaan bergabung.' },
  { question: 'Can I create my own team?', answer: 'Bisa. Setelah masuk, buka halaman Explore Teams dan pilih Create Team. Tentukan kategori kompetisi, tujuan tim, dan role yang masih dibutuhkan.' },
  { question: 'How does matching work?', answer: 'Kecocokan membandingkan skill dan level pengalaman di profilmu dengan kebutuhan role. Gunakan informasi ini sebagai panduan, lalu diskusikan tujuan dan komitmen dengan tim. Skor bukan jaminan diterima.' },
  { question: 'Do I need to pay to use SkillMatch?', answer: 'Saat ini kamu dapat membuat profil, menjelajahi tim, dan mengirim permintaan bergabung tanpa biaya.' },
  { question: 'Can I use SkillMatch for non-IT competitions?', answer: 'Ya. Pilih kategori yang sesuai dan tambahkan role seperti speaker, peneliti, strategist, desainer, atau atlet. Kamu juga bisa menentukan jenis kompetisi dan kebutuhan role sendiri.' },
]

function SectionHeading({ eyebrow, title, children }) {
  return <div className="landing-section-heading"><span className="landing-kicker">{eyebrow}</span><h2>{title}</h2>{children && <p>{children}</p>}</div>
}
function Actions({ authenticated = false }) {
  return <div className="landing-hero-actions"><Link className="landing-button landing-button-primary" to={authenticated ? '/dashboard' : '/register'}>{authenticated ? 'Go to Dashboard' : 'Get Started'}<ArrowRight size={16} /></Link><Link className="landing-button landing-button-outline" to="/teams">Explore Teams</Link></div>
}

export default function LandingPage() {
  const isAuthenticated = useAuthenticated()
  const [activeSection, setActiveSection] = useState('home')
  const [activeFAQ, setActiveFAQ] = useState(-1)
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) setActiveSection(visible.target.id)
    }, { rootMargin: '-15% 0px -65%', threshold: 0 })
    document.querySelectorAll('[data-landing-nav]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return <div className="landing-page">
    <a className="landing-skip-link" href="#main-content">Skip to content</a>
    <LandingNavbar activeSection={activeSection} isAuthenticated={isAuthenticated} />
    <main id="main-content">
      <section className="landing-hero" id="home" data-landing-nav>
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><span />People. Skills. Shared ambition.</span>
            <h1>Find the right team<br />for your next<br /><em>competition.</em></h1>
            <p>SkillMatch membantu mahasiswa menemukan partner dan anggota tim berdasarkan skill, role, minat, dan tingkat kecocokan.</p>
            <div className="landing-hero-actions"><Link className="landing-button landing-button-primary" to="/teams">Explore Teams<ArrowRight size={17} /></Link><Link className="landing-button landing-button-outline" to={isAuthenticated ? '/dashboard' : '/register'}>{isAuthenticated ? 'Dashboard' : 'Get Started'}<ChevronRight size={16} /></Link></div>
            <p className="landing-hero-context">From hackathons and research competitions to debate, business case, design, and more.</p>
            <div className="landing-context-chips">{['Technology', 'Academic', 'Business', 'Research', 'Creative', 'Design', 'Sports', 'Esports', 'Other'].map((label) => <span className="landing-chip" key={label}>{label}</span>)}</div>
          </div>
          <figure className="landing-hero-media"><div className="landing-media-label"><span className="landing-live-dot" />Different strengths. One shared goal.<span>01 / COLLABORATE</span></div><img src={collaboration} alt="Dua mahasiswa bekerja bersama menggunakan laptop" width="1423" height="1108" fetchPriority="high" /><figcaption><span className="landing-icon"><UsersRound size={22} /></span><div><strong>Your next chapter starts with a team.</strong><span>Find people to learn, build, and compete with.</span></div><ArrowRight size={20} /></figcaption></figure>
        </div>
        <div className="landing-container landing-highlights">{highlights.map(([Icon, title, text]) => <div key={title}><span className="landing-icon"><Icon size={22} /></span><div><strong>{title}</strong><p>{text}</p></div></div>)}</div>
      </section>

      <section className="landing-section landing-problem"><div className="landing-container"><SectionHeading eyebrow="A familiar challenge" title="Ambition is everywhere. The right team isn't.">Why forming the right team is still so hard.</SectionHeading><div className="landing-problem-grid">{problems.map(([number, title, text]) => <article className="landing-card" key={number}><span className="landing-number">{number}</span><h3>{title}</h3><p>{text}</p></article>)}</div><p className="landing-section-note">Good ideas deserve a team that can bring them to life.<span>That's where SkillMatch comes in. <ArrowRight size={15} /></span></p></div></section>

      <section className="landing-section" id="how-it-works" data-landing-nav><div className="landing-container"><SectionHeading eyebrow="From introduction to collaboration" title="How SkillMatch works">A clearer path from “I have an idea” to “we have a team.”</SectionHeading><div className="landing-steps">{steps.map(([Icon, title, text], index) => <article key={title}><div className="landing-step-top"><span className="landing-icon"><Icon size={25} /></span><span>STEP 0{index + 1}</span>{index < 2 && <ArrowRight size={20} />}</div><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="landing-section landing-features" id="features" data-landing-nav><div className="landing-container"><div className="landing-heading-row"><SectionHeading eyebrow="Purpose-built for better teamwork" title="More than a list of teams.">Understand where you fit, what your team needs, and what comes next.</SectionHeading><span className="landing-small-label">FIND YOUR PEOPLE. BUILD WITH PURPOSE.</span></div><div className="landing-feature-grid">{features.map(([Icon, title, text]) => <article className="landing-card" key={title}><span className={`landing-icon ${Icon === Sprout ? 'is-green' : ''}`}><Icon size={23} /></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

      <section className="landing-section"><div className="landing-container landing-inclusive"><figure className="landing-secondary-media"><img src={highFive} alt="Dua mahasiswa merayakan kemajuan bersama dengan high-five" width="1483" height="1061" loading="lazy" /><figcaption><Sprout size={18} />Room to learn. People to grow with.</figcaption></figure><div><SectionHeading eyebrow="Potential belongs on the team, too" title="You don't have to be an expert to get started.">Built not only for experts, but for learners who want to grow.</SectionHeading><p className="landing-body-copy">Setiap orang mulai dari suatu tempat. Temukan tim yang menghargai semangat belajar, bukan hanya pengalaman yang sudah kamu punya.</p><ul className="landing-check-list">{['Temukan tim yang menyambut pemula.', 'Kenali skill yang ingin kamu kembangkan.', 'Belajar dari mentor dan rekan yang lebih berpengalaman.', 'Tumbuh bersama dalam tim dengan beragam kemampuan.'].map((text) => <li key={text}><Check size={16} />{text}</li>)}</ul><Link className="landing-text-link" to="/teams">Find your starting point<ArrowRight size={17} /></Link></div></div></section>

      <section className="landing-section landing-categories"><div className="landing-container"><SectionHeading eyebrow="Different disciplines. Shared drive." title="Whatever your arena, find your team.">Not just for developers. For students with something to contribute.</SectionHeading><div className="landing-category-grid">{categories.map(([Icon, label]) => <Link to="/teams" className="landing-category" key={label}><Icon size={20} /><span>{label}</span><ChevronRight size={14} /></Link>)}</div></div></section>

      <section className="landing-section" id="explore" data-landing-nav><div className="landing-container"><div className="landing-heading-row"><SectionHeading eyebrow="A look at the possibilities" title="Different ideas. A place for you.">Contoh tim untuk menggambarkan pengalaman di SkillMatch.</SectionHeading><Link className="landing-text-link" to="/teams">Explore real teams<ArrowRight size={16} /></Link></div><div className="landing-team-grid">{teams.map((team) => <LandingTeamCard team={team} key={team.name} />)}</div><p className="landing-demo-note">Sample teams only. Team availability and requirements on Explore Teams may differ.</p></div></section>

      <section className="landing-section" id="about" data-landing-nav><div className="landing-container landing-impact"><div><span className="landing-kicker">Why we're building SkillMatch</span><h2>More students deserve<br />the chance to <em>compete,<br />contribute, and grow.</em></h2></div><div><p>Kesempatan tidak seharusnya berhenti karena kamu belum punya koneksi atau belum tahu harus mulai dari mana.</p><p>SkillMatch membuka jalan untuk kolaborasi lintas disiplin, membangun kepercayaan diri, dan belajar melalui proyek nyata. Pengalaman yang kamu bangun bersama tim bisa menjadi bekal untuk kompetisi berikutnya, dan karier setelahnya.</p><span className="landing-impact-signoff"><UsersRound size={19} />Better opportunities begin with better connections.</span></div></div></section>

      <section className="landing-section" id="faq" data-landing-nav><div className="landing-container landing-faq-grid"><SectionHeading eyebrow="A little clarity before you start" title="Good questions. Clear answers.">Everything you need to take your first step.</SectionHeading><FAQAccordion items={faqs} activeIndex={activeFAQ} onChange={setActiveFAQ} /></div></section>

      <section className="landing-cta-section"><div className="landing-container"><div className="landing-cta"><div><span className="landing-kicker">Your next competition starts here</span><h2>Ready to find the right team?</h2><p>Build your profile, discover teammates, and start preparing for your next competition.</p></div><Actions authenticated={isAuthenticated} /></div></div></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div className="footer-grid"><div className="footer-brand"><a href="#home" className="landing-brand"><span className="landing-brand-mark"><img src={brandLogo} alt="" /></span><strong>SkillMatch</strong></a><p>Find teammates. Build your future.<br />A place for students to grow together.</p></div><div><h3>Discover</h3><a href="#how-it-works">How It Works</a><a href="#features">Features</a><Link to="/teams">Explore Teams</Link></div><div><h3>SkillMatch</h3><a href="#about">About</a><a href="#faq">FAQ</a></div><div><h3>Your next step</h3><Link to={isAuthenticated ? '/dashboard' : '/register'}>{isAuthenticated ? 'Dashboard' : 'Get Started'}</Link><Link to={isAuthenticated ? '/profile' : '/login'}>{isAuthenticated ? 'Profile' : 'Login'}</Link></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} SkillMatch. All rights reserved.</span><span>Built for people who build together.<span className="footer-heart"> ♥</span></span></div></div></footer>
  </div>
}
