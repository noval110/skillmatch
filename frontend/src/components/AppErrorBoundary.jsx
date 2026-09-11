import { Component } from 'react'

export default class AppErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('SkillMatch route render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return <main className="route-error"><div><h1>Halaman tidak dapat ditampilkan</h1><p>{this.state.error.message || 'Terjadi kesalahan pada tampilan.'}</p><button className="button button-primary" onClick={() => window.location.reload()}>Muat ulang</button></div></main>
  }
}
