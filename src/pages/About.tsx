import { Info, Shield, ExternalLink, Heart } from 'lucide-react';

export default function About() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="flex items-center gap-3 mb-6" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <Info size={28} style={{ color: 'var(--primary-accent)' }} />
        <h1 className="page-title" style={{ margin: 0 }}>About</h1>
      </div>

      <div className="glass-panel p-8" style={{ padding: '2rem' }}>
        <div className="text-center mb-8" style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', background: 'linear-gradient(to right, var(--primary-accent), var(--secondary-accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AnyFile Convert
          </h2>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>v1.0.0 (First Public Release)</p>
        </div>

        <div className="grid gap-6 mb-8" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-panel p-5" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary-accent)' }}>
              <Shield size={20} />
              <h3 style={{ fontWeight: 600 }}>Privacy First</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Your files never leave your device. All processing is done locally on your CPU and disk. 100% offline capability.
            </p>
          </div>

          <div className="glass-panel p-5" style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary-accent)' }}>
              <Heart size={20} />
              <h3 style={{ fontWeight: 600 }}>Open Source</h3>
            </div>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Built with Rust and React. Licensed under GPL-3.0-or-later to ensure it remains free forever.
            </p>
          </div>
        </div>

        <div className="border-t border-light pt-6" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Third-Party Licenses</h3>
          <p className="text-muted mb-4" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            AnyFile Convert is built on the shoulders of giants. We are grateful to the authors of:
          </p>
          <ul className="text-muted" style={{ fontSize: '0.85rem', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <li><strong>Tauri</strong> (MIT / Apache-2.0) - Desktop framework</li>
            <li><strong>Tokio</strong> (MIT) - Async runtime</li>
            <li><strong>image</strong> (MIT) - Image processing</li>
            <li><strong>lopdf</strong> (MIT) - PDF manipulation</li>
            <li><strong>zip</strong> (MIT) - Archive creation</li>
            <li><strong>React</strong> (MIT) - UI library</li>
            <li><strong>Zustand</strong> (MIT) - State management</li>
          </ul>
        </div>

        <div className="mt-8 text-center" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <a href="https://github.com/anyfile-org/Anyfile-Converter" target="_blank" rel="noreferrer" className="btn btn-secondary inline-flex items-center gap-2">
            <ExternalLink size={18} />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
