import { useId, useState } from 'react'
import { competitionCategories, typesFor } from '../config/competitions'

export default function CompetitionFields({ team = {}, onChange, filter = false }) {
  const [category, setCategory] = useState(team.competition_category || '')
  const [type, setType] = useState(team.competition_type || '')
  const listId = useId()
  const selectedCategory = onChange ? team.competition_category || '' : category
  const selectedType = onChange ? team.competition_type || '' : type
  const changeCategory = (event) => {
    setCategory(event.target.value); setType('')
    onChange?.({ ...team, competition_category: event.target.value, competition_type: '' })
  }
  const changeType = (event) => {
    setType(event.target.value)
    onChange?.({ ...team, competition_type: event.target.value })
  }
  return <>
    <label><span>Competition Category</span><select name="competition_category" value={selectedCategory} onChange={changeCategory}>
      <option value="">{filter ? 'All Categories' : 'General Competition'}</option>
      {selectedCategory && !competitionCategories.some(item => item.name === selectedCategory) && <option>{selectedCategory}</option>}
      {competitionCategories.map(item => <option key={item.name}>{item.name}</option>)}
    </select></label>
    <label><span>Competition Type</span><input name="competition_type" list={listId} value={selectedType} onChange={changeType} maxLength={100} placeholder={filter ? 'All types — or enter a custom type' : 'Choose a suggestion or type your own'} />
      <datalist id={listId}>{typesFor(selectedCategory).map(type => <option key={type} value={type} />)}</datalist>
    </label>
  </>
}
