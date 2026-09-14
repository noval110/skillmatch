import {
  Minus,
  Plus,
} from 'lucide-react'

export default function FAQAccordion({
  items,
  activeIndex,
  onChange,
}) {
  return (
    <div className="landing-faq-list">
      {items.map((item, index) => {
        const open =
          activeIndex === index

        const answerId =
          `landing-faq-answer-${index}`

        const questionId =
          `landing-faq-question-${index}`

        return (
          <article
            className={`landing-faq-item ${
              open ? 'is-open' : ''
            }`}
            key={item.question}
          >
            <h3>
              <button
                type="button"
                id={questionId}
                aria-expanded={open}
                aria-controls={answerId}
                onClick={() =>
                  onChange(
                    open ? -1 : index,
                  )
                }
              >
                <span>
                  {item.question}
                </span>

                {open ? (
                  <Minus size={17} />
                ) : (
                  <Plus size={17} />
                )}
              </button>
            </h3>

            <div
              className="landing-faq-answer"
              id={answerId}
              role="region"
              aria-labelledby={
                questionId
              }
              hidden={!open}
            >
              <p>{item.answer}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}