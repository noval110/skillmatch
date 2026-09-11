"""One-time conversion of existing interface colors; leaves layout and images intact."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
index = root / 'src/index.css'
landing = root / 'src/styles/landing.css'
s = index.read_text(encoding='utf-8')
start, end = s.index(':root {'), s.index('\n}', s.index(':root {')) + 2
s = s[:start] + ''':root {
  font-family: 'Inter', sans-serif;
  color: var(--text);
  background: var(--bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}''' + s[end:]
s = s.replace("* {", "@import './styles/tokens.css';\n\n* {", 1)
s = re.sub(r'  --primary-soft: #fff7f7;\n  --primary-border: #e8cccc;\n', '', s)
s = s.replace('.auth-page { --primary-soft: var(--primary-softer); --primary-border: #e8cccc; }', '')
index.write_text(s, encoding='utf-8')
s = landing.read_text(encoding='utf-8')
for old, new in [('primary', 'primary'), ('dark', 'primary-dark'), ('soft', 'primary-soft'), ('softer', 'primary-softer')]:
    s = re.sub(r'--landing-' + old + r': [^;]+;', '--landing-' + old + ': var(--' + new + ');', s)
landing.write_text(s, encoding='utf-8')

backgrounds = {
 '#fff': 'surface', 'white': 'surface', '#fafafa': 'surface-soft', '#f8fafc': 'surface-hover',
 '#f1f5f9': 'chip', '#f3f4f6': 'chip', '#f4f1f2': 'chip',
 '#e5e7eb': 'track', '#eef0f3': 'track', '#d7dce2': 'track',
 '#ecfdf5': 'success-soft', '#fffbeb': 'warning-soft', '#fff7ed': 'warning-soft',
 '#fff7f7': 'primary-soft', '#fffafa': 'bg-secondary', '#fff1f3': 'surface-soft',
 '#fff5f6': 'primary-softer', '#fff6f7': 'surface-soft',
 '#edf2f8': 'category-technology-soft', '#f0eef7': 'category-academic-soft',
 '#f7f2e8': 'category-business-soft', '#eaf4f1': 'category-research-soft',
 '#f7edf1': 'category-creative-soft', '#f7eee8': 'category-design-soft', '#f1edf6': 'category-esports-soft',
 '#641621': 'primary-dark', '#8f2433': 'primary', '#92273a': 'primary', '#851f31': 'primary-dark',
 '#b23a4a': 'primary', '#bd5262': 'progress-fill', '#f1f2f4': 'skeleton',
}
foregrounds = {
 '#fff': 'text', 'white': 'text', '#111827': 'text', '#1f2937': 'text', '#334155': 'text', '#374151': 'text',
 '#475569': 'text-secondary', '#4b5563': 'text-secondary', '#64748b': 'text-secondary', '#667085': 'text-secondary',
 '#94a3b8': 'muted', '#67535a': 'text-secondary', '#756b70': 'text-secondary', '#766c71': 'text-secondary',
 '#b4232d': 'danger', '#dc3545': 'danger', '#047857': 'success', '#10b981': 'success',
 '#b45309': 'warning', '#c2410c': 'warning', '#8b304b': 'accent-text', '#6c3647': 'accent-text',
 '#c24358': 'accent-text', '#df667a': 'accent-text', '#d85d71': 'accent-text', '#da5b70': 'accent-text',
 '#f4c5cc': 'accent-text', '#f4dce0': 'chip-text', '#eecbd1': 'text-secondary',
 '#456180': 'category-technology', '#60567c': 'category-academic', '#7d6740': 'category-business',
 '#466f66': 'category-research', '#835b6b': 'category-creative', '#89654d': 'category-design', '#6e5882': 'category-esports',
}
gradients = {
 'linear-gradient(100deg, #fff 0%, #fffafa 45%, #fff1f3 100%)': 'hero-gradient',
 'linear-gradient(90deg, #fff6f7, #fff 50%, #fff5f6)': 'hero-gradient',
 'linear-gradient(135deg, #fff, #fffafa)': 'section-gradient',
 'linear-gradient(145deg, #641621, #8f2433)': 'cta-gradient',
 'linear-gradient(135deg, #641621, #b23a4a)': 'cover-gradient',
 'linear-gradient(140deg, #641621, #851f31)': 'footer-gradient',
 'radial-gradient(circle at 85% 10%, rgba(255,255,255,.13), transparent 24%), linear-gradient(135deg, #641621, #92273a)': 'cta-gradient',
}
def convert(match):
    prop, value, ending = match.groups()
    if prop.startswith('--'): return match[0]
    if prop == 'color':
        value = value.replace('var(--primary)', 'var(--accent-text)').replace('var(--primary-hover)', 'var(--accent-text)').replace('var(--landing-primary)', 'var(--accent-text)')
    def color(token):
        literal = token[0].lower()
        if prop == 'color': var = foregrounds.get(literal)
        elif 'background' in prop:
            var = backgrounds.get(literal)
            if literal.startswith('rgba'):
                if '255' in literal: var = 'nav-glass' if '.94' in literal else 'surface'
                elif '251' in literal or '127' in literal: var = 'decoration'
                else: var = 'overlay'
        elif 'border' in prop or prop == 'outline':
            var = 'primary-border' if literal in ['#d9c4c8', '#d6aab1', '#e3bec5', '#8b304b'] or literal.startswith('rgba(218') else 'border'
        elif prop == 'box-shadow':
            var = 'focus-ring' if '127' in literal or '122' in literal else 'shadow-color'
        else: var = None
        return f'var(--{var})' if var else token[0]
    value = re.sub(r'#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|\bwhite\b', color, value)
    return f'{prop}: {value}{ending}'

for path in [index, landing]:
    s = path.read_text(encoding='utf-8')
    for old, token in gradients.items(): s = s.replace(old, f'var(--{token})')
    s = re.sub(r'([\w-]+)\s*:\s*([^;{}]+)([;}])', convert, s)
    path.write_text(s, encoding='utf-8')
