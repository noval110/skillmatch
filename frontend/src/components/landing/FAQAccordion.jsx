import { ChevronDown } from 'lucide-react'

export default function FAQAccordion({ items, activeIndex, onChange }) {
  return <div className="landing-faq-list">{items.map((item, index) => {
    const open = activeIndex === index
    const answerId = `landing-faq-answer-${index}`
    return <article className={`landing-faq-item ${open ? 'is-open' : ''}`} key={item.question}><button type="button" aria-expanded={open} aria-controls={answerId} onClick={() => onChange(open ? -1 : index)}><span>{item.question}</span><ChevronDown size={15} /></button><div className="landing-faq-answer" id={answerId}><p>{item.answer}</p></div></article>
  })}</div>
}
