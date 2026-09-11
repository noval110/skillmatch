import { Shapes } from 'lucide-react'
import docker from '../assets/skill-icons/docker.png'
import figma from '../assets/skill-icons/figma.png'
import go from '../assets/skill-icons/go.png'
import javascript from '../assets/skill-icons/javascript.png'
import nodejs from '../assets/skill-icons/nodejs.png'
import python from '../assets/skill-icons/python.png'
import react from '../assets/skill-icons/react.png'
import typescript from '../assets/skill-icons/typescript.png'

const icons = { docker, figma, go, javascript, js: javascript, nodejs, python, react, typescript, ts: typescript }

export default function SkillIcon({ name = '', fallback: Fallback = Shapes }) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  const source = icons[key]
  if (source) return <img className="skill-icon-image" src={source} alt="" />
  return Fallback ? <Fallback className="skill-icon-fallback" size={15} /> : null
}
