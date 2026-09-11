import avatar1 from '../assets/avatars/avatar-1.png'
import avatar2 from '../assets/avatars/avatar-2.png'
import avatar3 from '../assets/avatars/avatar-3.png'
import avatar4 from '../assets/avatars/avatar-4.png'
import avatar5 from '../assets/avatars/avatar-5.png'

const avatars = [avatar1, avatar2, avatar3, avatar4, avatar5]

export default function Avatar({ name = '', className = '', size = 'medium', src = '' }) {
  const index = [...name].reduce((total, character) => total + character.charCodeAt(0), 0) % avatars.length
  return <span className={`avatar avatar-image avatar-${size} ${className}`} title={name}><img src={src || avatars[index]} alt="" /><span className="sr-only">{name}</span></span>
}
