import useAuthenticated from '../hooks/useAuthenticated'
import CompetitionCategories from '../components/CompetitionCategories'
import { ArrowRight, BarChart3, BrainCircuit, Check, ChevronRight, ClipboardList, Code2, Lightbulb, Mail, PenTool, Rocket, ShieldCheck, Sparkles, Target, UserRound, UserSearch, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import brandLogo from '../assets/branding/skillmatch-logo.png'
import byteBuilders from '../assets/team-covers/byte-builders.png'
import devNova from '../assets/team-covers/dev-nova.png'
import hackSquad from '../assets/team-covers/hack-squad.png'
import ApprovedAsset from '../components/ApprovedAsset'
import SkillIcon from '../components/SkillIcon'
import FAQAccordion from '../components/landing/FAQAccordion'
import LandingNavbar from '../components/landing/LandingNavbar'
import LandingTeamCard from '../components/landing/LandingTeamCard'
import '../styles/landing.css'

const steps = [
  { icon: UserRound, title: 'Buat Profile', text: 'Tambahkan skill, level, dan pengalamanmu.' },
  { icon: UsersRound, title: 'Pilih Kompetisi', text: 'Temukan team berdasarkan jenis lomba.' },
  { icon: Target, title: 'Lihat Match', text: 'Cari role yang cocok dengan kemampuanmu.' },
  { icon: Rocket, title: 'Join & Compete', text: 'Gabung dan persiapkan kompetisi bersama.' },
]

const features = [
  { icon: BrainCircuit, title: 'Smart Matching', text: 'Temukan role berdasarkan skill dan levelmu.' },
  { icon: UserSearch, title: 'Team Discovery', text: 'Cari team sesuai bidang yang kamu minati.' },
  { icon: ClipboardList, title: 'Role Requirements', text: 'Lihat skill yang diperlukan setiap role.' },
  { icon: ShieldCheck, title: 'Match Score', text: 'Ketahui seberapa cocok kamu dengan sebuah role.' },
  { icon: UsersRound, title: 'Join Requests', text: 'Owner dapat mengelola calon anggota team.' },
  { icon: UserRound, title: 'Member Profile', text: 'Tampilkan skill dan pengalamanmu.' },
]

const audiences = [
  { icon: Code2, label: 'Developer' }, { icon: PenTool, label: 'UI/UX Designer' },
  { icon: UserRound, label: 'Debater / Speaker' }, { icon: BarChart3, label: 'Business Strategist' },
  { icon: BrainCircuit, label: 'Researcher' }, { icon: Lightbulb, label: 'Creator / Esports Player' },
]

const comparisons = [
  ['Cari manual/random', 'Berdasarkan skill'], ['Role tidak jelas', 'Role jelas'],
  ['Match tebak-tebakan', 'Ada match score'], ['Skill cuma nama', 'Ada experience level'],
  ['Join lewat chat', 'Join request terstruktur'],
]

const faqs = [
  { question: 'Kompetisi apa saja yang didukung?', answer: 'Hackathon, debat, business case, KTI, desain, video, esports, olahraga, dan lainnya. Kamu juga dapat mengetik jenis kompetisi serta role sendiri.' },
  { question: 'Apakah SkillMatch gratis?', answer: 'Ya. Kamu dapat membuat profil, mencari team, dan mengirim join request tanpa biaya.' },
  { question: 'Apakah harus punya team dulu?', answer: 'Tidak. Kamu bisa melengkapi profil lalu mencari team yang membutuhkan skill milikmu.' },
  { question: 'Bagaimana match score dihitung?', answer: 'Match score membandingkan skill dan level pengalaman pada profilmu dengan kebutuhan setiap role.' },
  { question: 'Bisa mencari role tertentu?', answer: 'Bisa. Gunakan filter role dan skill pada halaman Explore Teams.' },
  { question: 'Apakah saya bisa membuat team sendiri?', answer: 'Bisa. Setelah login, pilih Create Team dan pilih kompetisi serta role yang dibutuhkan.' },
  { question: 'Apakah owner bisa memilih anggota?', answer: 'Bisa. Owner menerima atau menolak setiap join request melalui halaman pengelolaan team.' },
]

const teams = [
  { name: 'HackSquad', initial: 'H', category: 'Hackathon · Technology', members: '3 / 5', skills: ['React', 'Node.js', 'TypeScript'], people: ['Raka', 'Sinta', 'Niko'], extra: 2, match: 86, cover: hackSquad },
  { name: 'ArgueMasters', initial: 'A', category: 'Debate · Academic', members: '2 / 3', skills: ['Public Speaking', 'Argumentation', 'Research'], people: ['Maya', 'Arif'], extra: 1, match: 78, cover: devNova },
  { name: 'CaseMinds', initial: 'C', category: 'Business Case · Business', members: '3 / 5', skills: ['Business Analysis', 'Strategy', 'Presentation'], people: ['Tia', 'Dimas', 'Fani'], extra: 2, match: 72, cover: byteBuilders },
]

export default function LandingPage() {
  const isAuthenticated = useAuthenticated()
  const [activeSection, setActiveSection] = useState('home')
  const [activeFAQ, setActiveFAQ] = useState(-1)

  useEffect(() => {
    const ids = ['home', 'how-it-works', 'features', 'explore', 'about', 'faq']
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveSection(visible.target.id)
    }, { rootMargin: '-20% 0px -65%', threshold: [0, .2, .5] })
    ids.forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element) })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page">
      <LandingNavbar activeSection={activeSection} isAuthenticated={isAuthenticated} />
      <main>
        <section className="landing-hero" id="home"><div className="landing-container landing-hero-grid"><div className="landing-hero-copy"><span className="landing-eyebrow">Find • Connect • Build</span><h1>Find the right team<br /><b>for your next competition.</b></h1><p>SkillMatch membantu kamu menemukan partner dan anggota tim berdasarkan skill, role, minat, dan tingkat kecocokan.</p><div className="landing-hero-actions"><Link className="landing-button landing-button-primary" to="/teams">Explore Teams <ArrowRight size={15} /></Link><Link className="landing-button landing-button-outline" to={isAuthenticated ? "/dashboard" : "/register"}>{isAuthenticated ? "Dashboard" : "Get Started"}</Link></div><p className="competition-examples">Hackathon · Debate · Business Case · Research · Design · Creative · Esports</p><CompetitionCategories /><div className="landing-proof"><span><b>100+</b><small>Active Teams</small></span><span><b>500+</b><small>Talented Members</small></span><span><b>90%</b><small>Match Accuracy</small></span></div></div><div className="landing-hero-art"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><ApprovedAsset name="dashboard" alt="Tim SkillMatch berkolaborasi" /></div></div></section>

        <section className="landing-problem"><div className="landing-container landing-problem-grid"><div className="problem-copy"><span className="landing-kicker">The Problem</span><h2>Susah cari anggota tim<br />yang tepat?</h2><p>Banyak peserta kompetisi kesulitan menemukan partner dengan skill, role, dan tujuan yang sama.</p><ul>{['Skill tidak sesuai', 'Role team belum lengkap', 'Tidak tahu pengalaman anggota', 'Sulit menemukan orang dengan tujuan yang sama'].map((item) => <li key={item}><X size={12} />{item}</li>)}</ul></div><ArrowRight className="problem-arrow" size={30} /><div className="solution-card"><div><span className="landing-kicker">The Solution</span><h2>SkillMatch hadir!</h2><p>Platform yang menghubungkan kamu dengan team yang tepat berdasarkan skill, role, dan kecocokan yang terukur.</p></div><ApprovedAsset name="emptyTeam" alt="Mencari anggota team yang sesuai" /></div></div></section>

        <section className="landing-section" id="how-it-works"><div className="landing-container"><div className="landing-section-heading centered"><span className="landing-kicker">How It Works</span><h2>Cara Kerja SkillMatch</h2><p>Mudah, cepat, dan efektif. Hanya dalam beberapa langkah, kamu bisa menemukan tim yang tepat.</p></div><div className="landing-steps">{steps.map(({ icon: Icon, title, text }, index) => <article key={title}><span className="step-icon"><Icon size={21} /></span><small>0{index + 1}</small><h3>{title}</h3><p>{text}</p>{index < steps.length - 1 && <ChevronRight className="step-arrow" size={20} />}</article>)}</div></div></section>

        <section className="landing-section landing-features" id="features"><div className="landing-container landing-feature-layout"><div className="landing-section-heading"><span className="landing-kicker">Features</span><h2>Fitur Utama</h2><p>Semua yang kamu butuhkan untuk menemukan dan membangun team yang solid.</p></div><div className="landing-feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><span><Icon size={19} /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div></section>

        <section className="landing-matching"><div className="landing-container"><div className="landing-section-heading"><span className="landing-kicker">Smart Matching</span><h2>Sistem Matching yang Cerdas</h2><p>Kami menganalisis skill, pengalaman, dan preferensimu untuk memberikan rekomendasi yang paling sesuai.</p></div><div className="matching-flow"><article className="matching-skills"><h3>Your Skills</h3>{[['Public Speaking', 'Advanced'], ['Argumentation', 'Intermediate'], ['Research', 'Intermediate']].map(([skill, level]) => <div key={skill}><SkillIcon name={skill} /><span><b>{skill}</b><small>{level}</small></span></div>)}</article><ArrowRight className="matching-arrow" size={24} /><div className="matching-engine"><BrainCircuit size={27} /><b>Match Engine</b></div><ArrowRight className="matching-arrow" size={24} /><article className="matching-result"><header><h3>Second Speaker</h3><b>86%</b></header><i><em /></i>{[['Public Speaking', true], ['Argumentation', true], ['Research', true], ['Rebuttal', false]].map(([skill, matched]) => <p key={skill}>{matched ? <Check size={13} /> : <X size={13} />}<span>{skill}</span></p>)}</article><ApprovedAsset name="createTeam" className="matching-illustration" alt="Menyusun kebutuhan team" /></div></div></section>

        <section className="landing-section" id="explore"><div className="landing-container"><div className="landing-section-heading heading-row"><div><span className="landing-kicker">Explore Teams</span><h2>Temukan Team yang Cocok</h2><small>Contoh team dan ilustrasi match</small><p>Lihat berbagai tim yang sedang mencari anggota baru dan temukan yang paling sesuai dengan skill dan tujuanmu.</p></div><Link to="/teams">Lihat semua team <ArrowRight size={14} /></Link></div><div className="landing-team-grid">{teams.map((team) => <LandingTeamCard team={team} key={team.name} />)}</div></div></section>

        <section className="landing-section landing-about" id="about"><div className="landing-container landing-about-grid"><div><div className="landing-section-heading"><span className="landing-kicker">Who Is It For?</span><h2>Untuk Siapa SkillMatch?</h2><p>Untuk peserta debat, bisnis, riset, desain, teknologi, olahraga, dan kompetisi kreatif.</p></div><div className="audience-grid">{audiences.map(({ icon: Icon, label }) => <article key={label}><span><Icon size={18} /></span><p>{label}</p></article>)}</div></div><div><div className="landing-section-heading"><span className="landing-kicker">Why SkillMatch?</span><h2>Kenapa Pilih SkillMatch?</h2></div><div className="comparison-card"><header><span>Tanpa SkillMatch</span><span>Dengan SkillMatch</span></header>{comparisons.map(([before, after]) => <div key={before}><span><X size={12} />{before}</span><span><Check size={12} />{after}</span></div>)}</div></div></div></section>

        <section className="landing-section landing-faq" id="faq"><div className="landing-container landing-faq-grid"><div className="landing-section-heading"><span className="landing-kicker">FAQ</span><h2>Pertanyaan yang Sering Diajukan</h2><p>Masih ada yang ingin kamu ketahui? Temukan jawabannya di sini.</p></div><FAQAccordion items={faqs} activeIndex={activeFAQ} onChange={setActiveFAQ} /></div></section>

        <section className="landing-cta-section"><div className="landing-container"><div className="landing-cta"><div><span><Sparkles size={14} /> Join Now</span><h2>Ready for<br />your next competition?</h2><p>Find the right people.<br />Build the right team.</p><div><Link className="landing-button cta-light" to={isAuthenticated ? "/teams/create" : "/register"}>{isAuthenticated ? "Create Team" : "Create Account"} <ArrowRight size={14} /></Link><Link className="landing-button cta-outline" to="/teams">Explore Teams</Link></div></div><ApprovedAsset name="register" alt="Mulai membangun team" /></div></div></section>
      </main>

      <footer className="landing-footer"><div className="landing-container footer-grid"><div className="footer-brand"><div className="landing-brand"><span className="footer-logo-mark"><img src={brandLogo} alt="" /></span><strong>SkillMatch</strong></div><p>Find • Connect • Build</p></div><div><h3>Product</h3><a href="#explore">Explore Teams</a><a href="#features">Features</a><a href="#how-it-works">How It Works</a></div><div><h3>Resources</h3><a href="#faq">FAQ</a><a href="#about">About</a></div><div><h3>Account</h3>{isAuthenticated ? <><Link to="/dashboard">Dashboard</Link><Link to="/profile">Profile</Link></> : <><Link to="/login">Login</Link><Link to="/register">Register</Link></>}</div><div className="footer-contact"><Mail size={17} /><p>© 2026 SkillMatch.<br />All rights reserved.</p></div></div></footer>
    </div>
  )
}
