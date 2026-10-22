import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>RangeSieve couldn’t complete this analysis</h1>
        <p>
          Copy your input somewhere safe, then reload to try again. Reloading clears this session.
          RangeSieve does not upload datasets or save analyses automatically.
        </p>
        <button onClick={() => location.reload()}>Reload RangeSieve</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>,
);
